/**
 * LYRA LEARNING SYNC — Extracts hidden learning data from AI coaching responses
 * and writes it silently to persistent storage.
 *
 * The AI appends a hidden JSON block to coaching messages:
 *   <!--LYRA_LEARNING_DATA { ... } LYRA_LEARNING_DATA-->
 *
 * The student never sees this. The app strips it before display.
 */

import { reportWords, reportSameMoment, isGrammarCritiqueText, stripLeakedAuthor } from "./report-utils.js";
import { QUICK_ACTION_MESSAGES } from "./constants.js";
// §95: dedup identities live in ONE module (they become the server-side dedup keys
// in P0 Phase 1). normGrowthText also feeds isAuthenticGrowth below.
import { normGrowthText, grammarKey, skillKey, growthKey, structureKey, vocabKey, reportKey } from "./content-keys.js";

const MARKER = /<!--LYRA_LEARNING_DATA\n?([\s\S]*?)\nLYRA_LEARNING_DATA-->/;

// ── Authentic-growth validation ───────────────────────────────────────
// A growth entry is a trophy ONLY if it records a literal sentence rewrite:
// `before` must trace to text the student actually typed, and `after` must be
// a sentence — not third-person meta-commentary about the student. Without
// this, conversational "wins" (the model coupling rule fires on any insight)
// minted fake Achievements cards and fed the Growth Report fake practices.

const META_PATTERNS = [
  // §34/H3: verb-anchored — "the/this student <cognition verb>" is Lyra
  // observing growth, NOT student writing. The old noun-only form matched
  // ordinary prose ("the student next to me…") and both silently rejected
  // legit rewrites and fed the one-time purge.
  /\b(the|this)\s+(student|learner)\s+(?:\w+\s+){0,2}(understands?|realis\w+|realiz\w+|learn(?:ed|ing|s|t)|knows?|grasp\w*|recogni[sz]\w+|demonstrat\w+|sees?\s+that)\b/i,
  /\bstudent (now )?(understands|realises|realizes|learned|knows)\b/i,
];

/** Third-person observation about the student, not student writing. */
export const isMetaGrowthText = (s) => META_PATTERNS.some(re => re.test(s || ""));

/**
 * Pure provenance validator for one growth entry. ALL checks must pass:
 *  1. before/after non-empty and different (normalized)
 *  2. before is not a canned quick-action chip message (chips arrive AS user
 *     messages, so the traceability check alone would pass them)
 *  3. before traces to something the student actually authored this session:
 *     substring of a studentText, or ≥0.6 content-word overlap with one
 *     (same threshold as the practice-moment dedup). No provenance, no trophy.
 *  4. neither side is meta-commentary ("The student understands…")
 *  5. after is sentence-shaped (≤600 chars — a rewrite, not a pasted paragraph)
 *
 * @param {{before, after}} g - one growth entry from LYRA_LEARNING_DATA
 * @param {string[]} studentTexts - texts the student authored this session
 */
export function isAuthenticGrowth(g, studentTexts) {
  if (!g) return false;
  const before = normGrowthText(g.before);
  const after = normGrowthText(g.after);
  // 1. non-empty, genuinely different
  if (!before || !after || before === after) return false;
  // 2. not a canned chip message (equals or contains a chip prefix)
  if (QUICK_ACTION_MESSAGES.some(m => {
    const n = normGrowthText(m);
    return n && (before === n || before.includes(n));
  })) return false;
  // 4. not meta-commentary on either side
  if (isMetaGrowthText(g.before) || isMetaGrowthText(g.after)) return false;
  // 5. a rewrite, not a paragraph dump
  if ((g.after || "").length > 600) return false;
  // 3. traceable to the student's own words — fail closed on no provenance
  const texts = (studentTexts || []).filter(t => typeof t === "string" && t.trim());
  if (!texts.length) return false;
  const beforeWords = reportWords(g.before);
  return texts.some(t =>
    normGrowthText(t).includes(before) || reportSameMoment(beforeWords, reportWords(t))
  );
}

/**
 * Extract hidden learning data from an AI response.
 * Returns { displayText, learningData } where displayText is clean
 * (no JSON block) and learningData is the parsed object or null.
 */
export function extractLearningData(response) {
  const match = response.match(MARKER);
  if (!match) return { displayText: response, learningData: null };

  const displayText = response.replace(MARKER, "").trim();

  let learningData = null;
  try {
    learningData = JSON.parse(match[1].trim());
  } catch (e) {
    console.warn("Failed to parse learning data:", e);
  }

  return { displayText, learningData };
}

/**
 * Strip the hidden LYRA_LEARNING_DATA block (and any other HTML comments) from
 * AI output that is rendered directly — e.g. the style analysis, which does NOT
 * go through the chat extract/display split. LYRA_BRAIN tells the model to
 * append this block on coaching turns, and it sometimes appends it to analysis
 * output too, where it would otherwise leak into the last rendered section.
 * Handles a complete block, an unterminated trailing block (mid-stream), and
 * stray HTML comments.
 */
export function stripLearningData(text) {
  return (text || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!--[\s\S]*$/, "")
    .trimEnd();
}

/**
 * Sync learning data to persistent storage.
 *
 * @param {object} data - The parsed learning data object
 * @param {object} ctx  - Context from the app:
 *   ctx.setGrammarLog — React state setter for grammar log
 *   ctx.topic         — current writing topic (for tagging entries)
 */
export function syncLearningData(data, ctx) {
  if (!data || data.type !== "learning_sync") return;

  const { setGrammarLog, topic, forcedTechnique } = ctx;

  // Provenance gate: only growth entries that trace to the student's own
  // writing reach the growth log, the regen counter, and the Achievements
  // card. Grammar/vocabulary/structures/skills sync UNCHANGED below — they
  // have their own dedup and the Growth Report brain judges them by rate.
  const growthAll = data.growth || [];
  const authentic = growthAll.filter(g => isAuthenticGrowth(g, ctx.studentTexts || []));
  if (growthAll.length && !authentic.length) {
    console.warn("[lyra-sync] rejected inauthentic growth:", growthAll.map(g => ({
      before: (g.before || "").slice(0, 80),
      after: (g.after || "").slice(0, 80),
    })));
  }

  // 1. Grammar → existing Grammar Log
  if (data.grammar?.length && setGrammarLog) {
    const newEntries = data.grammar.map(g => ({
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      phrase: g.phrase,
      correction: g.correction,
      rule: g.rule,
      explanation: g.explanation,
      example_wrong: g.example_wrong || "",
      example_correct: g.example_correct || "",
      chinese: g.chinese || "",
      source: "coaching",
    }));
    // §56/A2: dedup by phrase+correction so a Reload (re-running sync on the
    // regenerated reply) doesn't append duplicate grammar entries.
    setGrammarLog(prev => {
      const seen = new Set(prev.map(grammarKey));
      const fresh = newEntries.filter(e => !seen.has(grammarKey(e)));
      return [...fresh, ...prev];
    });
  }

  // 2. Skills deployed → skill deployment log
  if (data.skills_deployed?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-skill-deployments") || "[]");
      const newEntries = data.skills_deployed.map(s => ({
        id: "deploy_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        // §78: a writer's name belongs in sourceAuthor, never welded into the skill name.
        skillName: stripLeakedAuthor(s.skill_name || ""),
        sourceAuthor: s.source_author || "",
        sourceContext: s.source_context || "",
        studentApplication: s.student_application || "",
        mastery: s.mastery_signal || "partial",
        topic: topic?.slice(0, 80) || "",
        date: new Date().toISOString(),
      }));
      // §56/A2: dedup by skillName+studentApplication (reload re-sync safety).
      const seen = new Set(existing.map(skillKey));
      const fresh = newEntries.filter(s => !seen.has(skillKey(s)));
      if (fresh.length) localStorage.setItem("lyra-skill-deployments", JSON.stringify([...fresh, ...existing]));
    } catch (e) { /* silent */ }
  }

  // 3. Growth → before/after evolution log (authentic entries only)
  if (authentic.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-growth-log") || "[]");
      const newEntries = authentic.map(g => ({
        id: "growth_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString(),
        before: g.before,
        after: g.after,
        technique: g.technique_used,
        why: g.why_better,
        topic: topic?.slice(0, 80) || "",
      }));
      // §56/A2: dedup by before+after so a Reload doesn't append duplicate growth
      // entries AND doesn't double-count the practice toward the regen cadence.
      const seen = new Set(existing.map(growthKey));
      const fresh = newEntries.filter(e => !seen.has(growthKey(e)));
      if (fresh.length) {
        localStorage.setItem("lyra-growth-log", JSON.stringify([...fresh, ...existing]));
        // Growth Report cadence: count this practice moment toward the next regen
        // (only when a genuinely new growth entry survived dedup).
        // The Report tab regenerates when this reaches REGEN_EVERY_N_PRACTICES.
        try {
          const n = (Number(localStorage.getItem("lyra-growth-pending")) || 0) + 1;
          localStorage.setItem("lyra-growth-pending", String(n));
        } catch (e2) { /* silent */ }
      }
    } catch (e) { /* silent */ }
  }

  // 4. Structures learned → structure library
  if (data.structures_learned?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-structures") || "[]");
      const newEntries = data.structures_learned.map(s => ({
        id: "struct_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name: s.name,
        description: s.description,
        example: s.student_example,
        effect: s.effect,
        chinese: s.chinese || "",
        learnedAt: new Date().toISOString(),
      }));
      // Deduplicate by name
      const names = new Set(existing.map(structureKey));
      const unique = newEntries.filter(s => !names.has(structureKey(s)));
      if (unique.length) {
        localStorage.setItem("lyra-structures", JSON.stringify([...unique, ...existing]));
      }
    } catch (e) { /* silent */ }
  }

  // 5. Vocabulary acquired → vocabulary arsenal
  if (data.vocabulary_acquired?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-vocabulary") || "[]");
      const newEntries = data.vocabulary_acquired.map(v => ({
        id: "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        weak: v.weak,
        strong: v.strong,
        chinese: v.chinese || "",
        collocation: v.collocation || "",
        category: v.category || "",
        learnedAt: new Date().toISOString(),
      }));
      // Deduplicate by strong word
      const words = new Set(existing.map(vocabKey));
      const unique = newEntries.filter(v => !words.has(vocabKey(v)));
      if (unique.length) {
        localStorage.setItem("lyra-vocabulary", JSON.stringify([...unique, ...existing]));
      }
    } catch (e) { /* silent */ }
  }

  // 6. Masterclass Report (auto) — when there's a growth before/after pair
  //    (a real sentence upgrade), bundle the whole learning moment into a
  //    single self-contained Achievements card. We trigger on ANY growth
  //    event, not only mastery "achieved" — during coaching the AI usually
  //    marks mastery "partial" while the student is still learning, so an
  //    "achieved"-only gate almost never fired and the Achievements tab
  //    stayed empty. A growth before/after pair is itself the milestone:
  //    the student improved a real sentence. The individual logs above
  //    still record everything; this is the curated trophy view. Returns
  //    true so the caller knows a structured report was saved and can skip
  //    the visible-report fallback.
  if (authentic.length) {
    const g = authentic[0];
    saveMasterclassReport({
      source: "auto",
      topic: topic?.slice(0, 80) || "",
      before: g.before || "",
      after: g.after || "",
      technique: forcedTechnique || g.technique_used || (data.skills_deployed?.[0] && data.skills_deployed[0].skill_name) || "",
      why_better: g.why_better || "",
      skills: (data.skills_deployed || []).map(s => ({
        skillName: forcedTechnique || s.skill_name || "",
        sourceAuthor: s.source_author || "",
        studentApplication: s.student_application || "",
        mastery: s.mastery_signal || "",
      })),
      structures: (data.structures_learned || []).map(s => ({
        name: s.name || "",
        description: s.description || "",
        example: s.student_example || "",
        effect: s.effect || "",
        chinese: s.chinese || "",
      })),
      vocabulary: (data.vocabulary_acquired || []).map(v => ({
        weak: v.weak || "",
        strong: v.strong || "",
        chinese: v.chinese || "",
        collocation: v.collocation || "",
      })),
      grammar: (data.grammar || []).map(gr => ({
        phrase: gr.phrase || "",
        correction: gr.correction || "",
        rule: gr.rule || "",
        explanation: gr.explanation || "",
        chinese: gr.chinese || "",
      })),
    });
    return { savedReport: true };
  }
  return { savedReport: false };
}

/**
 * One-time purge (v1) of junk growth that predates the authenticity gate:
 * entries/cards whose before/after/reportText is third-person meta-commentary
 * about the student (the META check only — traceability can't be evaluated
 * retroactively, the student's session texts are gone). Idempotent via the
 * lyra-growth-purge-v1 flag. Does NOT touch grammar-log/vocabulary/structures
 * and does not recompute lyra-growth-pending (the next regen resets it).
 * Call at app boot AFTER autoRestoreFromBackup; snapshots after cleaning so
 * the backup reflects the cleaned state.
 *
 * @param {{ snapshot?: Function }} deps - injectable snapshotBackup for tests
 * @returns {{ ran: boolean, removedLog: number, removedReports: number }}
 */
export function purgeInauthenticGrowthV1({ snapshot } = {}) {
  try {
    if (localStorage.getItem("lyra-growth-purge-v1")) return { ran: false, removedLog: 0, removedReports: 0 };
    const removedAfters = [];

    let removedLog = 0;
    try {
      const log = JSON.parse(localStorage.getItem("lyra-growth-log") || "[]");
      const bad = (e) => isMetaGrowthText(e.before) || isMetaGrowthText(e.after);
      const keep = log.filter(e => !bad(e));
      removedLog = log.length - keep.length;
      if (removedLog) {
        log.filter(bad).forEach(e => removedAfters.push(e.after || ""));
        localStorage.setItem("lyra-growth-log", JSON.stringify(keep));
      }
    } catch (e) { /* silent */ }

    let removedReports = 0;
    try {
      const reports = JSON.parse(localStorage.getItem("lyra-masterclass-reports") || "[]");
      const bad = (r) => isMetaGrowthText(r.before) || isMetaGrowthText(r.after) || isMetaGrowthText(r.reportText);
      const keep = reports.filter(r => !bad(r));
      removedReports = reports.length - keep.length;
      if (removedReports) {
        reports.filter(bad).forEach(r => removedAfters.push(r.after || r.technique || ""));
        localStorage.setItem("lyra-masterclass-reports", JSON.stringify(keep));
      }
    } catch (e) { /* silent */ }

    localStorage.setItem("lyra-growth-purge-v1", "done");
    if (removedAfters.length) {
      console.info(`[lyra-purge] removed ${removedLog} growth-log entr${removedLog === 1 ? "y" : "ies"} + ${removedReports} report card(s) with meta-commentary:`, removedAfters);
      if (snapshot) snapshot();
    }
    return { ran: true, removedLog, removedReports };
  } catch (e) {
    return { ran: false, removedLog: 0, removedReports: 0 };
  }
}

/**
 * Detect a visible MASTERCLASS REPORT in a Lyra coaching message and save it
 * as a freeform Achievements card. This is the robust fallback for when the
 * AI prints a full report in the chat (numbered SKILLS DEPLOYED / SENTENCE
 * STRUCTURES / BEFORE & AFTER / GRAMMAR sections) but forgets — or only
 * partially emits — the hidden LYRA_LEARNING_DATA JSON block. Without this,
 * a clearly report-shaped turn would never reach the Achievements tab.
 *
 * @param {string} displayText - the cleaned (JSON-stripped) Lyra message
 * @param {object} ctx - { topic }
 * @returns {object|null} the saved entry or null if no report detected
 */
export function maybeSaveVisibleReport(displayText, ctx) {
  if (!displayText) return null;
  // Require the unmistakable report header OR at least two of the four
  // numbered section labels, so ordinary coaching turns don't get saved.
  const hasHeader = /MASTERCLASS\s+REPORT/i.test(displayText);
  const sectionHits = [
    /SKILLS\s+DEPLOYED/i,
    /SENTENCE\s+STRUCTURES|RHYTHM\s+MAP/i,
    /BEFORE\s*&?\s*AFTER/i,
    /GRAMMAR\s*&?\s*PROOFREAD/i,
  ].filter(re => re.test(displayText)).length;
  if (!hasHeader && sectionHits < 2) return null;

  const afterMatch = displayText.match(/After:\s*([^\n]+)/i);
  const after = afterMatch ? afterMatch[1].trim().replace(/^["“]|["”]$/g, "") : "";
  // A visible report whose "After:" line is meta-commentary about the student
  // ("The student understands…") is a conversational summary, not a rewrite —
  // it must not become a card. (The manual ★ Save button is untouched: that's
  // the student-controlled override.)
  if (after && isMetaGrowthText(after)) return null;
  const techMatch = displayText.match(/(?:You used|deployed|technique)\s+(?:the\s+)?["'“]?([A-Z][\w '\-]{2,40})["'”]?/);
  return saveMasterclassReport({
    source: "auto-visible",
    topic: ctx?.topic?.slice(0, 80) || "",
    after,
    technique: ctx?.forcedTechnique || (techMatch ? techMatch[1].trim() : ""),
    reportText: displayText,
  });
}

/**
 * Save a Masterclass Report card to localStorage (key: lyra-masterclass-reports).
 * Two shapes are supported:
 *   - STRUCTURED (source "auto"): before/after/technique/why_better + skills/
 *     structures/vocabulary/grammar arrays, harvested from LYRA_LEARNING_DATA.
 *   - FREEFORM (source "manual"): `reportText` = verbatim Lyra message + `after`
 *     = the student's sentence, captured when the student clicks "Save this
 *     turn" (backstop for when the AI forgets the hidden JSON block).
 * The Achievements tab renders whichever shape is present.
 *
 * @param {object} report
 * @returns {object|null} the saved entry (with id+date) or null on failure
 */
export function saveMasterclassReport(report) {
  try {
    // §72: a grammar critique is never a skill achievement — don't store a freeform
    // critique message (manual ★ save, or the visible-report fallback) as a card.
    if (report && report.reportText && isGrammarCritiqueText(report.reportText)) return null;
    // §78: a writer's name must never live in a skill / technique TITLE (anti-bias,
    // §67 — the reported "Analogy / Maxine Eggenberger style" leak). Strip any leaked
    // author attribution before storing — the root-cause guard for EVERY save path
    // (auto sync, training, manual ★, visible-report fallback). The source author is
    // still kept in skills[].sourceAuthor for the "learned from …" detail.
    report = {
      ...report,
      ...(report.technique ? { technique: stripLeakedAuthor(report.technique) } : {}),
      ...(Array.isArray(report.skills) ? { skills: report.skills.map((s) => ({ ...s, skillName: stripLeakedAuthor(s.skillName || "") })) } : {}),
    };
    const existing = JSON.parse(localStorage.getItem("lyra-masterclass-reports") || "[]");
    // Dedup: the auto-save, the visible-report fallback, and the manual
    // "Save this turn" button can all fire for the SAME turn. If this exact
    // upgraded sentence is already saved, don't add a second card.
    const after = reportKey(report);
    if (after && existing.some(r => reportKey(r) === after)) return null;
    const entry = {
      id: "report_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      ...report,
    };
    localStorage.setItem("lyra-masterclass-reports", JSON.stringify([entry, ...existing]));
    return entry;
  } catch (e) {
    return null;
  }
}

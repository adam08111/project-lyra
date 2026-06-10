/**
 * LYRA LEARNING SYNC — Extracts hidden learning data from AI coaching responses
 * and writes it silently to persistent storage.
 *
 * The AI appends a hidden JSON block to coaching messages:
 *   <!--LYRA_LEARNING_DATA { ... } LYRA_LEARNING_DATA-->
 *
 * The student never sees this. The app strips it before display.
 */

import { reportWords, reportSameMoment } from "./report-utils.js";
import { QUICK_ACTION_MESSAGES } from "./constants.js";

const MARKER = /<!--LYRA_LEARNING_DATA\n?([\s\S]*?)\nLYRA_LEARNING_DATA-->/;

// ── Authentic-growth validation ───────────────────────────────────────
// A growth entry is a trophy ONLY if it records a literal sentence rewrite:
// `before` must trace to text the student actually typed, and `after` must be
// a sentence — not third-person meta-commentary about the student. Without
// this, conversational "wins" (the model coupling rule fires on any insight)
// minted fake Achievements cards and fed the Growth Report fake practices.

const normGrowthText = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

const META_PATTERNS = [
  /\b(the|this)\s+(student|learner)\b/i,
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
    setGrammarLog(prev => [...newEntries, ...prev]);
  }

  // 2. Skills deployed → skill deployment log
  if (data.skills_deployed?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-skill-deployments") || "[]");
      const newEntries = data.skills_deployed.map(s => ({
        id: "deploy_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        skillName: s.skill_name,
        sourceAuthor: s.source_author || "",
        sourceContext: s.source_context || "",
        studentApplication: s.student_application || "",
        mastery: s.mastery_signal || "partial",
        topic: topic?.slice(0, 80) || "",
        date: new Date().toISOString(),
      }));
      localStorage.setItem("lyra-skill-deployments", JSON.stringify([...newEntries, ...existing]));
    } catch (e) { /* silent */ }
  }

  // 3. Growth → before/after evolution log
  if (data.growth?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-growth-log") || "[]");
      const newEntries = data.growth.map(g => ({
        id: "growth_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString(),
        before: g.before,
        after: g.after,
        technique: g.technique_used,
        why: g.why_better,
        topic: topic?.slice(0, 80) || "",
      }));
      localStorage.setItem("lyra-growth-log", JSON.stringify([...newEntries, ...existing]));
      // Growth Report cadence: count this practice moment toward the next regen.
      // The Report tab regenerates when this reaches REGEN_EVERY_N_PRACTICES.
      try {
        const n = (Number(localStorage.getItem("lyra-growth-pending")) || 0) + 1;
        localStorage.setItem("lyra-growth-pending", String(n));
      } catch (e2) { /* silent */ }
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
      const names = new Set(existing.map(s => s.name));
      const unique = newEntries.filter(s => !names.has(s.name));
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
      const words = new Set(existing.map(v => v.strong));
      const unique = newEntries.filter(v => !words.has(v.strong));
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
  if (data.growth?.length) {
    const g = data.growth[0];
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
    const existing = JSON.parse(localStorage.getItem("lyra-masterclass-reports") || "[]");
    // Dedup: the auto-save, the visible-report fallback, and the manual
    // "Save this turn" button can all fire for the SAME turn. If this exact
    // upgraded sentence is already saved, don't add a second card.
    const after = (report.after || "").trim();
    if (after && existing.some(r => (r.after || "").trim() === after)) return null;
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

/**
 * REPORT UTILS — pure helpers shared by the Style Lab Report/Achievements cards
 * and the Continuous Growth Report.
 *
 * Everything here is PURE: no React, no localStorage, no network. That is
 * deliberate — the cross-source mistake dedup is the accuracy keystone of the
 * growth report (a slip counted 8 times turns honest critique into a lie), so
 * it must be unit-testable in isolation. See tests/growth-report.test.js.
 */

// ── text normalisation ────────────────────────────────────────────────
export const reportClean = (s) => (s || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

export const reportWords = (s) =>
  new Set(reportClean(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4));

// Two sentences describe the SAME practice moment if most of the shorter one's
// content words also appear in the other (the AI re-logs one sentence under
// several invented technique names; the names differ, the sentence doesn't).
export const reportSameMoment = (a, b) => {
  if (a.size < 4 || b.size < 4) return false;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size) >= 0.6;
};

// Prefer a structured report (real gains + mistakes) over a freeform verbatim-
// chat dump when collapsing a cluster to one display card.
export const reportRichness = (r) =>
  (r.reportText ? 0 : 100) +
  (r.skills?.length || 0) +
  (r.structures?.length || 0) +
  (r.vocabulary?.length || 0) +
  (r.grammar?.length || 0) +
  (r.before ? 1 : 0) +
  (r.after ? 1 : 0);

/**
 * Cluster reports that describe the same practice moment.
 * @returns {{ display: object, members: object[], _w: Set }[]}
 */
export function groupReports(reports) {
  const groups = [];
  for (const r of reports || []) {
    const sentence = r.after || (r.skills && r.skills[0] && r.skills[0].studentApplication) || "";
    const w = reportWords(sentence);
    let g = groups.find((grp) => reportSameMoment(grp._w, w));
    if (!g) {
      g = { members: [], display: r, _w: w };
      groups.push(g);
    }
    g.members.push(r);
    if (reportRichness(r) > reportRichness(g.display)) g.display = r;
  }
  return groups;
}

export const countDedupedPractices = (reports) => groupReports(reports).length;

// §78 — strip an author-name attribution that leaked into a technique / skill
// TITLE. The model occasionally welds a (real or hallucinated) writer's name onto
// a technique name — the reported leak was an Achievement titled
// "Analogy / Maxine Eggenberger style" (a §67-era anti-bias slip, from before that
// fix). An Achievement title must name the SKILL, never a writer.
//
// We strip ONLY author-attribution SCAFFOLDING — a separator + a person-name + an
// author-signal word ("style"/"voice"/"prose"), an "-esque"/"-ian" form, a
// PARENTHESISED connective ("(like X)"), or an unambiguous marker ("à la X") — never
// bare Title-Case words. So legitimate Title-Case skill names survive untouched:
// "Painted Style Pictures", "The Helpful Professional", "Free Indirect Style",
// "Show, Don't Tell", "Cause / Effect", "Before / After Snapshots". A person-name is
// 2+ capitalised words with no internal apostrophe (so contractions like "Don't" are
// never read as a name).
const NAME_WORD = "[A-Z][a-zà-öø-ÿ]+(?:-[A-Z][a-zà-öø-ÿ]+)?"; // Orwell, Lloyd-Jones
const FULL_NAME = `${NAME_WORD}(?:\\s+${NAME_WORD})+`; // Maxine Eggenberger
const SEP = "[\\/(,;:|·•–—-]"; // an attribution separator
// "<sep> Maxine Eggenberger style" / ", George Orwell voice" / "(Jane Austen prose)".
// Requires a separator + a FULL person-name (2+ words) + an author-signal word, so
// "Personal, Conversational Style" (one word before "Style") and "Free Indirect
// Style" (no separator) are NOT touched.
const AUTHOR_TAIL_STYLE = new RegExp(`\\s*${SEP}\\s*${FULL_NAME}(?:['’]s)?\\s+(?:style|styled|voice|prose|technique|writing)\\b\\s*\\)?\\s*$`, "i");
// "Hemingway-esque", "Dickensian-style" at the end (one capitalised word + suffix)
const AUTHOR_ESQUE = new RegExp(`\\s*${SEP}?\\s*${NAME_WORD}[-‑](?:esque|ian|like|style)\\b\\s*\\)?\\s*$`, "i");
// PARENTHESISED connective attribution: "(like George Orwell)", "(after Dickens)",
// "(as in Maxine Eggenberger)". The parentheses are the disambiguating boundary, so
// even everyday words (like/after/think) are safe HERE — unlike a bare slash, where
// "Before / After Snapshots" must survive. The "(" may be preceded by a separator.
const AUTHOR_PAREN = new RegExp(`\\s*${SEP}?\\s*\\(\\s*(?:like|à la|a la|as in|after|inspired by|reminiscent of|think|cf\\.?)\\s+${NAME_WORD}(?:\\s+${NAME_WORD})*\\s*\\)\\s*$`, "i");
// Unambiguous markers that are NOT ordinary English title words, so they are safe
// WITHOUT parentheses: "Sparse Style à la Hemingway", "Pacing cf. Ernest Hemingway".
const AUTHOR_LATIN = new RegExp(`\\s*${SEP}?\\s*(?:à la|a la|cf\\.)\\s+${NAME_WORD}(?:\\s+${NAME_WORD})*\\s*$`, "i");
// A deliberate non-pattern: a bare "<sep> Firstname Lastname" with NO author-signal
// word — and a bare separator before an everyday word like "after"/"like" — are NOT
// stripped. They are indistinguishable from legitimate slash-pair skill names
// ("Before / After Snapshots", "Cause / Effect"), and destroying a real card title is
// worse than missing a rare unsignalled leak (the save-layer + prompt guard catch
// those at the source going forward).

export function stripLeakedAuthor(title) {
  const original = String(title || "").trim();
  let s = original;
  let prev;
  do {
    prev = s;
    s = s.replace(AUTHOR_TAIL_STYLE, "").replace(AUTHOR_PAREN, "").replace(AUTHOR_LATIN, "").replace(AUTHOR_ESQUE, "");
  } while (s !== prev);
  s = s.replace(new RegExp(`[\\s${SEP.slice(1, -1)}]+$`, "u"), "").trim();
  // Never return empty (a title that was ONLY an author tail) — keep the original.
  return s || original;
}

// Identity of the technique/skill a report belongs to, normalised for grouping.
// stripLeakedAuthor so a clean "Analogy" report and a leaked
// "Analogy / Maxine Eggenberger style" report fold into the SAME card.
export const reportTechniqueKey = (r) =>
  stripLeakedAuthor(reportClean(r?.technique || (r?.skills && r?.skills[0] && r?.skills[0].skillName) || "")).toLowerCase();

// §72 — does this freeform text look like a sentence-by-sentence grammar critique
// (numbered "original → correction" lines)? ACHIEVEMENTS are for SKILLS the student
// earned through practice; a grammar critique belongs in the Grammar Log, never as a
// skill win — so a critique saved as a freeform report (manual ★, or the
// visible-report fallback) must be kept OUT of the Achievements tab. A real skill /
// before-after report has 0 such lines; a sweep has many → threshold 2. Self-contained
// (no imports — report-utils stays dependency-free; no cycle with chat-actions).
export function isGrammarCritiqueText(text) {
  if (!text) return false;
  let n = 0;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^\s*\*{0,2}\d+[.)]\s/.test(line) && /→|->|—>/.test(line) && /["“”]|\*\*/.test(line)) {
      if (++n >= 2) return true;
    }
  }
  return false;
}

// §72 — a grammar RULE the model sometimes emits as a "technique" (so a grammar fix
// gets saved as a structured Achievement headlined "Subject-verb agreement"). These
// are corrections, not writing skills.
const GRAMMAR_RULE_LABEL = /\b(subject[\s-]?verb|agreement|tenses?|articles?|plurals?|singular|possessives?|prepositions?|spelling|punctuation|run[\s-]?ons?|fragments?|comma splice|capitali[sz]ation|word order|noun|adjective|adverb|pronoun)\b/i;

// §72 — is this masterclass report a grammar correction rather than a SKILL the
// student earned? Two shapes: a freeform critique message saved verbatim, or a
// structured report whose headline IS a grammar rule (with no real writing-skill
// content). Such a report belongs in the Grammar Log, NOT the Achievements tab.
export function isGrammarOnlyReport(r) {
  if (!r) return false;
  if (r.reportText && isGrammarCritiqueText(r.reportText)) return true;
  const label = (r.technique || (r.skills && r.skills[0] && r.skills[0].skillName) || "").trim();
  // headlined by a grammar rule AND carrying no real writing-skill structure
  if (label && GRAMMAR_RULE_LABEL.test(label) && !(r.structures && r.structures.length)) return true;
  return false;
}

/**
 * Group reports for the ACHIEVEMENTS tab: ONE card per technique practised.
 *
 * Distinct from groupReports (which clusters by practice-MOMENT for the growth
 * report's volume/dedup counting). Here, continued practice on the SAME
 * technique — each turn with a different example sentence — folds into ONE card
 * instead of spawning a new one every turn. Reports with no technique fall back
 * to practice-moment clustering so they don't all collapse into one untitled
 * card. Display = the richest member (a structured report beats a freeform chat
 * dump), so the card shows the cleanest view, not a wall of every turn stacked.
 *
 * @returns {{ display: object, members: object[], _key: string, _w: Set }[]}
 */
export function groupAchievements(reports) {
  const groups = [];
  for (const r of reports || []) {
    // §72: a grammar correction is not a skill achievement — keep it out of the
    // Achievements tab (it lives in the Grammar Log). Covers a freeform critique
    // saved verbatim AND a structured report headlined by a grammar rule. Filtering
    // here covers the card list AND the tab count, for legacy + new entries.
    if (isGrammarOnlyReport(r)) continue;
    const key = reportTechniqueKey(r);
    const w = reportWords(r.after || (r.skills && r.skills[0] && r.skills[0].studentApplication) || "");
    let g = key
      ? groups.find((grp) => grp._key === key)
      : groups.find((grp) => !grp._key && reportSameMoment(grp._w, w));
    if (!g) {
      g = { members: [], display: r, _key: key, _w: w };
      groups.push(g);
    }
    g.members.push(r);
    if (reportRichness(r) > reportRichness(g.display)) g.display = r;
  }
  return groups;
}

// ── delta timestamps ──────────────────────────────────────────────────
// Every persisted record's id leads with a Date.now() millisecond stamp
// (e.g. "report_1717000000000_ab12", "1717000000000_ab12"). That is the only
// RELIABLE ordering key: grammar-log `date` is a day-granularity locale string
// ("7 Jun 2026") that can't be compared to an ISO `lastRegenAt`. Prefer the id
// stamp; fall back to an ISO date field only if no id stamp exists.
export const tsOf = (item) => {
  if (!item) return 0;
  const stamp = String(item.id || "")
    .split("_")
    .find((p) => /^\d{12,}$/.test(p));
  if (stamp) return Number(stamp);
  const d = item.date || item.learnedAt || item.savedAt;
  const t = d ? new Date(d).getTime() : NaN;
  return isNaN(t) ? 0 : t;
};

// ── mistake consolidation + cross-source dedup (the accuracy keystone) ──
const normWrong = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Collapse the SAME underlying mistake instance — logged across the grammar-log,
 * a report's `grammar` array, and the report's `before` sentence — into ONE
 * record. A student who slipped on subject-verb agreement once must not show as
 * "8 occurrences" because it was logged in three places for the same session.
 *
 * The growth report is the only place these sources get unified (the grammar-log
 * alone only sees proofreads; practice-chat grammar lives only in report.grammar).
 *
 * @param {{ grammarLog?: object[], reportClusters?: object[] }} input
 *   reportClusters = output of groupReports() (already practice-moment deduped)
 * @returns {{ rule, wrong, correction, sentence, date, sources: string[] }[]}
 */
export function consolidateMistakes({ grammarLog = [], reportClusters = [] } = {}) {
  const instances = [];

  const add = (rule, wrong, correction, sentence, date, source) => {
    const wk = normWrong(wrong);
    const ck = normWrong(correction);
    if (!wk && !ck) return;
    const sk = normWrong(sentence);

    const found = instances.find((i) => {
      const iwk = normWrong(i.wrong);
      const ick = normWrong(i.correction);
      const isk = normWrong(i.sentence);
      // exact wrong→correction pair = same instance
      if (wk && ck && iwk === wk && ick === ck) return true;
      // same correction target + overlapping wrong text (different granularity,
      // e.g. grammar-log "He go to the shop." vs report.grammar phrase "he go")
      if (ck && ick === ck && wk && iwk && (iwk.includes(wk) || wk.includes(iwk))) return true;
      // the wrong phrase appears inside the other's recorded sentence
      if (wk && isk && isk.includes(wk)) return true;
      if (iwk && sk && sk.includes(iwk)) return true;
      return false;
    });

    if (found) {
      found.sources.add(source);
      if (!found.rule && rule) found.rule = rule;
      if (!found.correction && correction) found.correction = correction;
      if (!found.sentence && sentence) found.sentence = sentence;
      return;
    }
    instances.push({
      rule: rule || "",
      wrong: wrong || "",
      correction: correction || "",
      sentence: sentence || "",
      date: date || "",
      sources: new Set([source]),
    });
  };

  for (const g of grammarLog) {
    add(g.rule, g.example_wrong || g.phrase, g.correction, g.example_wrong || "", g.date, "grammar-log");
  }
  for (const c of reportClusters) {
    const rep = c.display || c;
    const date = rep.date || "";
    for (const g of rep.grammar || []) {
      add(g.rule, g.phrase, g.correction, rep.before || "", date, "report.grammar");
    }
    // The `before` sentence is passed to the model as before→after practice
    // context (not a separate counted mistake) — any explicit error it contains
    // is already merged above via the sentence-containment check.
  }

  return instances.map((i) => ({ ...i, sources: [...i.sources] }));
}

/**
 * Build the regeneration DELTA: only learning data newer than `since`, with
 * mistakes consolidated + cross-source deduped. Reports come in already
 * practice-moment clustered (via groupReports). Transcripts are NOT included
 * (token cost) — only a freeform report's `reportText` survives, as a fallback.
 *
 * @returns {{ practices, mistakes, structures, vocabulary }}
 */
export function buildDelta({ reportClusters = [], grammarLog = [], structures = [], vocabulary = [], since = 0 } = {}) {
  const sinceT = since ? new Date(since).getTime() : 0;
  const isNew = (item) => !sinceT || tsOf(item) > sinceT;

  const newClusters = reportClusters.filter((c) => {
    const members = c.members || [c.display || c];
    return !sinceT || Math.max(0, ...members.map(tsOf)) > sinceT;
  });

  const practices = newClusters.map((c) => {
    const r = c.display || c;
    const hasStructured = !!(r.before || (r.skills && r.skills.length) || (r.grammar && r.grammar.length));
    return {
      // §78: strip any leaked author name so a LEGACY report (saved before the §78
      // save guard) can't re-surface a writer's name in the growth-report LLM text.
      technique: stripLeakedAuthor(r.technique || (r.skills && r.skills[0] && r.skills[0].skillName) || ""),
      before: r.before || "",
      after: r.after || "",
      why_better: r.why_better || "",
      skills: (r.skills || []).map((s) => ({ skillName: stripLeakedAuthor(s.skillName || ""), studentApplication: s.studentApplication || "" })),
      vocabulary: r.vocabulary || [],
      // freeform chat dump only when there is no structured signal to mine
      reportText: !hasStructured && r.reportText ? r.reportText : undefined,
    };
  });

  const mistakes = consolidateMistakes({
    grammarLog: grammarLog.filter(isNew),
    reportClusters: newClusters,
  });

  return {
    practices,
    mistakes,
    structures: structures.filter(isNew).map((s) => ({ name: s.name || "", description: s.description || "" })),
    vocabulary: vocabulary.filter(isNew).map((v) => ({ weak: v.weak || "", strong: v.strong || "" })),
  };
}

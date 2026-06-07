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
      technique: r.technique || (r.skills && r.skills[0] && r.skills[0].skillName) || "",
      before: r.before || "",
      after: r.after || "",
      why_better: r.why_better || "",
      skills: (r.skills || []).map((s) => ({ skillName: s.skillName || "", studentApplication: s.studentApplication || "" })),
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

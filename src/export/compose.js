// BRIEF-116 / §127 — the take-home export COMPOSER. Pure: (corpus, meta) -> a single
// self-contained HTML string (no DOM, no globals, no Date.now — the date arrives in meta,
// so the output is deterministic and testable). D-O3: an export is a RENDER SURFACE — every
// student-typed string is HTML-escaped at composition (self-XSS is still XSS), there are zero
// inline event handlers and zero remote resources, so the file opens offline, forever, inert.

// The ONE escape helper (SSoT — applied to EVERY interpolation below). Exported for the
// characterization test that fires <script>/<img onerror>/javascript: through every field.
export function escapeHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const e = escapeHtml;

// Machine-readable island: the same corpus, JSON. Escaping every "<" to "<" makes a
// "</script>" sequence inside the data impossible — the island can never break out of its tag.
function jsonIsland(corpus) {
  return JSON.stringify(corpus || {}).replace(/</g, "\\u003c");
}

const fmtDate = (iso) => (typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "");

function writingsSection(writings) {
  if (!writings || !writings.length) return "";
  const items = writings.map((w) => `
    <article class="writing">
      <h3>${e(w.title) || "Untitled"}</h3>
      <p class="meta">${e(w.topic)}${w.topic && w.date ? " · " : ""}${e(fmtDate(w.date))}</p>
      <div class="draft">${e(w.draft)}</div>
    </article>`).join("");
  return `<section><h2>Your writing</h2>${items}</section>`;
}

function learningSection(learning) {
  if (!learning || !learning.byRule || !learning.byRule.length) return "";
  const rows = learning.byRule.map((r) => {
    const egs = (r.examples || []).map((x) => `<li>${e(x.phrase)} <span class="arrow">&#8594;</span> ${e(x.correction)}</li>`).join("");
    return `<li><strong>${e(r.rule)}</strong> <span class="count">${e(r.count)}&#215;</span>${egs ? `<ul class="egs">${egs}</ul>` : ""}</li>`;
  }).join("");
  return `<section><h2>What you've been working on</h2>
    <p class="meta">${e(learning.total)} things noticed while writing, grouped by pattern (most frequent first).</p>
    <ul class="rules">${rows}</ul></section>`;
}

function growthSection(growth) {
  if (!growth || typeof growth !== "object") return "";
  const level = growth.level || {};
  const secs = growth.sections || {};
  const order = [["level", "Where you are"], ["strengths", "Your strengths"], ["growth", "How you've grown"], ["workingOn", "What we're working on"], ["focus", "Your next focus"]];
  const prose = order.map(([k, label]) => {
    const en = secs[k] && secs[k].en;
    return en ? `<h3>${e(label)}</h3><p>${e(en)}</p>` : "";
  }).join("");
  const strengths = (growth.strengths || []).map((s) => `<li>${e(s.label)}</li>`).join("");
  const weaknesses = (growth.weaknesses || []).map((w) => `<li>${e(w.label)}${w.status ? ` <span class="count">(${e(w.status)})</span>` : ""}</li>`).join("");
  return `<section><h2>Your growth report</h2>
    ${level.name ? `<p class="level"><strong>${e(level.name)}</strong>${level.summary ? ` — ${e(level.summary)}` : ""}</p>` : ""}
    ${prose}
    ${strengths ? `<h3>Strengths</h3><ul>${strengths}</ul>` : ""}
    ${weaknesses ? `<h3>Working on</h3><ul>${weaknesses}</ul>` : ""}</section>`;
}

function historySection(snapshots) {
  if (!snapshots) return "";
  const ws = snapshots.writings || [], rs = snapshots.reports || [];
  if (!ws.length && !rs.length) return "";
  const draftRows = ws.map((s) => `<li>${e(fmtDate(s.date))} — ${e((s.content || "").length)} characters</li>`).join("");
  const reportRows = rs.map((s) => `<li>${e(fmtDate(s.date))}</li>`).join("");
  return `<section><h2>Your saved history</h2>
    ${ws.length ? `<h3>Draft versions (${e(ws.length)})</h3><ul class="history">${draftRows}</ul>` : ""}
    ${rs.length ? `<h3>Report versions (${e(rs.length)})</h3><ul class="history">${reportRows}</ul>` : ""}
    <p class="meta">The full text of every saved version is in the data file embedded at the bottom of this page.</p></section>`;
}

function contentsLine(meta) {
  const inc = (meta.included || []).map(e);
  const omit = (meta.omitted || []).map(e);
  let s = inc.length ? `This file contains: ${inc.join(", ")}.` : "This file is empty.";
  if (omit.length) s += ` Not included: ${omit.join(", ")}.`;
  return s;
}

const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; max-width: 760px; margin: 0 auto; padding: 28px 20px 64px; color: #1a1a1a; background: #fff; line-height: 1.6; }
header { border-bottom: 2px solid #222; padding-bottom: 16px; margin-bottom: 28px; }
h1 { font-size: 26px; margin: 0 0 6px; }
h2 { font-size: 19px; margin: 34px 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
h3 { font-size: 15px; margin: 18px 0 4px; }
.meta { color: #666; font-size: 13px; margin: 2px 0 10px; }
.contents { color: #333; font-size: 14px; font-style: italic; }
.writing { margin: 0 0 22px; }
.draft { white-space: pre-wrap; word-wrap: break-word; background: #faf9f6; border: 1px solid #eee; border-radius: 8px; padding: 12px 14px; font-size: 15px; }
.rules { list-style: none; padding: 0; } .rules > li { margin: 0 0 10px; }
.count { color: #888; font-size: 13px; } .arrow { color: #aaa; }
.egs { margin: 4px 0 0 0; font-size: 14px; color: #444; } .egs li { margin: 2px 0; }
ul.history { columns: 2; font-size: 13px; color: #555; }
footer { margin-top: 48px; border-top: 1px solid #ddd; padding-top: 12px; color: #999; font-size: 12px; }
@media print { body { max-width: none; } .draft { background: #fff; } }
`;

// corpus: { studentName, writings[], learning|null, growth|null, snapshots|null }
// meta:   { included[], omitted[], date(ISO), dateLabel(human) }
export function composeExport(corpus, meta = {}) {
  const c = corpus || {};
  const name = (c.studentName || "").trim();
  const title = name ? `${name} — my writing` : "My writing — a take-home copy";
  const body =
    writingsSection(c.writings) +
    learningSection(c.learning) +
    growthSection(c.growth) +
    historySection(c.snapshots);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>${e(name ? `${name}'s writing` : "My writing")}</h1>
  <p class="meta">A take-home copy from Lyra${meta.dateLabel ? ` &#183; ${e(meta.dateLabel)}` : ""}. These words are yours &#8212; this file opens on any computer, forever, with no app and no internet.</p>
  <p class="contents">${contentsLine(meta)}</p>
</header>
${body || `<p>Nothing has been written yet. Come back after you've done some writing, and your work will be here.</p>`}
<footer>Exported from Lyra. Your own writing, learning history, and growth report &#8212; nothing else.</footer>
<script type="application/json" id="lyra-export-data">${jsonIsland(c)}</script>
</body>
</html>`;
}

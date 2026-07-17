// BRIEF-116 / §127 — GATHER the take-home corpus. Local-first (DATA-ARCHITECTURE): localStorage
// is authoritative, so the on-device stores are the source of truth; when sync is ON we ENRICH
// with the student's own writing_snapshots + report_snapshots via her existing RLS SELECT — the
// FIRST client read of those append-only ledgers (own-rows only; paged to the PostgREST 1000-row
// bound). A network failure never fails the export — it folds into an honest "not included" line
// (#7). D-O4: nothing here reads the recovery key, the device student-id key, or class codes, and
// no snapshot query selects student_id; D-O1: teacher-only bandEstimate is stripped from every
// profile/report. Counts/status only — no content is ever logged (§87/§88; these are minors).
import { getSupabase } from "../supabase-client.js";
import { GROWTH_PROFILE_KEY } from "../growth-report.js";

const PROJECTS_KEY = "lyra-projects";   // writings, authoritative local store
const GRAMMAR_LOG_KEY = "grammar-log";  // learning history (window.storage → localStorage)

// Snapshot paging: read up to MAX_SNAPSHOT_ROWS per ledger; if that ceiling is HIT the export says so
// (D-P5 — no silent cap) instead of quietly dropping older rows. (A real student never approaches it.)
const PAGE_SIZE = 1000;                          // PostgREST default row bound
const MAX_PAGES = 25;
const MAX_SNAPSHOT_ROWS = PAGE_SIZE * MAX_PAGES; // 25,000

function readLocal(key) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// A date-safe ISO conversion: a corrupt updatedAt must NEVER throw and fail the whole export (#7).
function toISO(v) {
  if (!v) return "";
  try { const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toISOString(); } catch (e) { return ""; }
}

// Strip the teacher-only bandEstimate from a profile/report (D-O1/D-O4) without mutating the input.
// It rides in TWO places: level.bandEstimate AND every per-regen history[] entry
// (growth-report.js pushHistorySnapshot) — and, because report_snapshots store the whole profile,
// in each snapshot's report.history too. Scrub both (this covers the snapshot path, which reuses it).
function stripBand(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const out = { ...profile };
  if (out.level && typeof out.level === "object") {
    out.level = { ...out.level };
    delete out.level.bandEstimate;
  }
  if (Array.isArray(out.history)) {
    out.history = out.history.map((h) => {
      if (h && typeof h === "object" && "bandEstimate" in h) { const c = { ...h }; delete c.bandEstimate; return c; }
      return h;
    });
  }
  return out;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Own-RLS SELECT of an append-only ledger, paged past the 1000-row PostgREST bound (order by ts).
// Selects ONLY the given columns — never student_id (D-O4). Throws on any DB error (caught upstream).
// Returns { rows, truncated }: `truncated` is true when it filled every allowed page (more rows may
// exist beyond MAX_SNAPSHOT_ROWS), so the caller can say so instead of silently capping (D-P5).
async function readAllPaged(sb, table, cols, pageSize = PAGE_SIZE, maxPages = MAX_PAGES) {
  const rows = [];
  let truncated = false;
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await sb.from(table).select(cols).order("ts", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    if (page === maxPages - 1) truncated = true;   // filled the final allowed page → more may exist
  }
  return { rows, truncated };
}

// Returns { corpus, included, omitted } — `included`/`omitted` drive the composer's honest
// contents line. `corpus` is safe to embed verbatim (band stripped, no identifiers selected).
export async function gatherCorpus() {
  const included = [], omitted = [];

  // ── Writings (local, authoritative) ──
  const projects = readLocal(PROJECTS_KEY) || [];
  const writings = [];
  for (const proj of Array.isArray(projects) ? projects : []) {
    for (const w of (proj && Array.isArray(proj.writings) ? proj.writings : [])) {
      if ((w.draft || "").trim() || (w.title || "").trim()) {
        writings.push({ title: w.title || "", topic: w.topic || "", draft: w.draft || "", date: toISO(w.updatedAt) });
      }
    }
  }
  if (writings.length) included.push(`${writings.length} writing${writings.length === 1 ? "" : "s"}`);

  // ── Learning history (grammar-log grouped by rule, most-frequent first) ──
  const grammarLog = readLocal(GRAMMAR_LOG_KEY) || [];
  const byRuleMap = new Map();
  for (const g of Array.isArray(grammarLog) ? grammarLog : []) {
    const rule = (g && g.rule) || "Other";
    if (!byRuleMap.has(rule)) byRuleMap.set(rule, { rule, count: 0, examples: [] });
    const entry = byRuleMap.get(rule);
    entry.count++;
    if (entry.examples.length < 3 && (g.phrase || g.correction)) entry.examples.push({ phrase: g.phrase || "", correction: g.correction || "" });
  }
  const byRule = [...byRuleMap.values()].sort((a, b) => b.count - a.count);
  const learning = byRule.length ? { total: (Array.isArray(grammarLog) ? grammarLog.length : 0), byRule } : null;
  if (learning) included.push("your learning history");

  // ── Growth report (local; teacher-only bandEstimate stripped) ──
  let growth = null;
  const rawProfile = readLocal(GROWTH_PROFILE_KEY);
  if (rawProfile && typeof rawProfile === "object") { growth = stripBand(rawProfile); included.push("your growth report"); }
  const studentName = (growth && growth.studentName) || "";

  // ── Snapshot enrichment (flag-ON only; own-RLS; failure → honest "not included", never a throw) ──
  let snapshots = null;
  const sb = getSupabase();
  if (!sb) {
    omitted.push("your online history (this copy is from your device)");
  } else {
    let ws = null, rs = null;
    try { ws = await withTimeout(readAllPaged(sb, "writing_snapshots", "writing_id, content, trigger, deleted, ts"), 8000); } catch (e) { ws = null; }
    try { rs = await withTimeout(readAllPaged(sb, "report_snapshots", "report, trigger, ts"), 8000); } catch (e) { rs = null; }
    const draftHist = ws ? ws.rows.filter((r) => !r.deleted).map((r) => ({ writingId: r.writing_id, content: r.content, trigger: r.trigger, date: r.ts })) : null;
    const reportHist = rs ? rs.rows.map((r) => ({ report: stripBand(r.report), trigger: r.trigger, date: r.ts })) : null;
    if (draftHist || reportHist) snapshots = { writings: draftHist || [], reports: reportHist || [] };
    const cap = MAX_SNAPSHOT_ROWS.toLocaleString("en-US");
    if (draftHist) included.push(ws.truncated ? `your most recent ${cap} saved draft versions (older ones not included)` : `${draftHist.length} saved draft version${draftHist.length === 1 ? "" : "s"}`); else omitted.push("your saved draft history (couldn't reach it)");
    if (reportHist) included.push(rs.truncated ? `your most recent ${cap} saved reports (older ones not included)` : `${reportHist.length} saved report${reportHist.length === 1 ? "" : "s"}`); else omitted.push("your saved report history (couldn't reach it)");
  }

  return { corpus: { studentName, writings, learning, growth, snapshots }, included, omitted };
}

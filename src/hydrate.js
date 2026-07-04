/**
 * HYDRATION — P0 Phase 2 (D7). Materialize the remote learning mirror back into the
 * native localStorage shapes when a device is authenticated but its local stores are
 * empty and the mirror holds history. Precedent: DataExport import (write keys → reload).
 *
 * Runs inside the UN-AWAITED initSync (never blocks first paint, #7). Per-key
 * conservative: only fills a key whose local value is empty/absent — no merging of
 * divergent non-empty locals in v1. §87/§88: counts/status-only logging, never content.
 *
 * The app writes every event store newest-first (prepend); learning_events carries the
 * FULL original entry in `payload`, and events are fetched ts-ASCENDING, so materialize
 * REVERSES each type-group → an array indistinguishable from a locally-built one.
 */
import { getSupabase } from "./supabase-client.js";

// sessionStorage marker: set once we hydrate+reload, so the reload boot doesn't loop.
export const HYDRATED_FLAG = "lyra-hydrated-v1";
const GROWTH_PROFILE_KEY = "lyra-growth-profile";

// learning_events type → local store key (mirror of data-layer STORE_MIRRORS; the six
// array stores). Kept here (not imported) so materialize stays a pure, self-contained map.
const TYPE_TO_KEY = {
  grammar: "grammar-log",
  growth: "lyra-growth-log",
  skill_deployed: "lyra-skill-deployments",
  structure: "lyra-structures",
  vocabulary: "lyra-vocabulary",
  report: "lyra-masterclass-reports",
};

// Counts/status-only log (§87/§88) — never content.
function logSync(msg, extra) { try { console.info(`[sync] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

// A local value counts as empty/absent (safe to fill) when it is null, [] or {}.
// A non-empty value — or an UNPARSEABLE one (returned verbatim by the reader) — is
// treated as present, so hydration never clobbers real local data.
function isEmptyValue(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return !v;
}

/**
 * Fetch this student's remote mirror. RLS scopes every row to the session, so this
 * returns only the caller's data. Pages learning_events ts-ascending (500/page) + the
 * single growth_profiles row. Any failure → null (counts-only log); never throws (#7).
 * @param {string} [studentId] - defensive explicit filter; RLS already scopes.
 * @returns {Promise<{events: object[], profile: object|null}|null>}
 */
export async function fetchRemote(studentId) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const events = [];
    const PAGE = 500;
    for (let from = 0; ; from += PAGE) {
      let q = sb.from("learning_events").select("type,payload,ts").order("ts", { ascending: true });
      if (studentId) q = q.eq("student_id", studentId);
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) { logSync("fetch events failed", { code: error.code }); return null; }
      if (!data || !data.length) break;
      events.push(...data);
      if (data.length < PAGE) break;
    }
    const { data: profRows, error: pErr } = await sb
      .from("growth_profiles").select("profile,last_regen_at").limit(1);
    if (pErr) { logSync("fetch profile failed", { code: pErr.code }); return null; }
    const profile = profRows && profRows.length ? profRows[0] : null;
    return { events, profile };
  } catch (e) {
    logSync("fetchRemote threw", { code: e?.name });
    return null;
  }
}

/**
 * Pure. Build the { key: value } map of stores to write. For each of the six event
 * stores, when the remote has rows AND the local value is empty/absent, produce the
 * payload array in native (newest-first) order — events arrive ts-ascending, so reverse.
 * The growth-profile row → lyra-growth-profile, only if locally absent.
 * @param {object[]} events - learning_events rows ({type, payload, ...}), ts-ascending
 * @param {object|null} profile - the growth_profiles row ({profile, ...}) or null
 * @param {(key:string)=>any} localReader - returns the parsed local value (or null)
 * @returns {Object<string, any>}
 */
export function materialize(events, profile, localReader) {
  const out = {};
  const byType = {};
  for (const ev of (events || [])) {
    if (!ev || !ev.type) continue;
    (byType[ev.type] = byType[ev.type] || []).push(ev);
  }
  for (const type of Object.keys(TYPE_TO_KEY)) {
    const key = TYPE_TO_KEY[type];
    const group = byType[type];
    if (!group || !group.length) continue;               // remote has no rows → nothing to fill
    if (!isEmptyValue(localReader(key))) continue;        // local non-empty → conservative skip
    // ts-ascending (oldest→newest) → reverse to the store's native newest-first order.
    out[key] = group.map((ev) => ev.payload).reverse();
  }
  if (profile && profile.profile && isEmptyValue(localReader(GROWTH_PROFILE_KEY))) {
    out[GROWTH_PROFILE_KEY] = profile.profile;
  }
  return out;
}

/**
 * Orchestrator. Skips when sync is disabled, when already hydrated this session (loop
 * guard), or when nothing qualifies. Otherwise writes the materialized map with raw
 * localStorage.setItem (pre-reload writes; the app re-reads through its normal load paths
 * after reload, and the grammar save-effect's first recordGrammarLogDelta then BASELINES
 * from the hydrated log so nothing re-enqueues), sets the guard, and reloads once.
 * @returns {Promise<{hydrated: boolean, keys?: number}>}
 */
export async function hydrateIfNeeded() {
  try {
    if (!getSupabase()) return { hydrated: false };                       // sync disabled
    if (sessionStorage.getItem(HYDRATED_FLAG)) return { hydrated: false }; // loop guard
    const remote = await fetchRemote();
    if (!remote) return { hydrated: false };                              // fetch failed (logged)
    const localReader = (key) => {
      try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
      catch (e) { return "__present__"; }                                 // unparseable → treat as present
    };
    const map = materialize(remote.events, remote.profile, localReader);
    const keys = Object.keys(map);
    if (!keys.length) return { hydrated: false };                        // nothing qualifies (flag NOT set)
    for (const k of keys) {
      try { localStorage.setItem(k, JSON.stringify(map[k])); } catch (e) { /* silent */ }
    }
    try { sessionStorage.setItem(HYDRATED_FLAG, "1"); } catch (e) { /* silent */ }
    logSync(`hydrated ${keys.length} keys`);
    try { location.reload(); } catch (e) { /* jsdom/no-op envs */ }
    return { hydrated: true, keys: keys.length };
  } catch (e) {
    logSync("hydrateIfNeeded threw", { code: e?.name });
    return { hydrated: false };
  }
}

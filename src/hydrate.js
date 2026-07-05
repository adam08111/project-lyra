/**
 * HYDRATION — P0 Phase 2 (D7) + Phase 3 blob fold-in (D10). Materialize the remote mirror
 * back into native localStorage when a device is authenticated but its local stores are
 * empty. Layer 2 (learning_events + growth_profiles) AND Layer 1 blobs hydrate in ONE fetch
 * pass, ONE materialize map, the SAME sessionStorage guard, and ONE reload — so a claim on a
 * fresh device returns writings, skills, training history, AND the Grammar Log in one cycle.
 *
 * Runs inside the UN-AWAITED initSync (never blocks first paint, #7). Per-key conservative:
 * only fills a locally empty/absent key. Empty-string remote blob values are TOMBSTONES and
 * never hydrate (D10). §87/§88: counts/status-only logging, never content.
 */
import { getSupabase } from "./supabase-client.js";
import { ALLOW_KEYS, seedLastSent } from "./blob-mirror.js";

// sessionStorage marker: set once we hydrate+reload, so the reload boot doesn't loop.
export const HYDRATED_FLAG = "lyra-hydrated-v1";
const GROWTH_PROFILE_KEY = "lyra-growth-profile";

// learning_events type → local store key (the six Layer-2 array stores). Newest-first native.
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

// A RAW local value counts as empty/absent (safe to fill) when null, "", "[]" or "{}" —
// covering both Layer-2 JSON stores ([]/{}) and raw blob strings (""/absent).
function isEmptyRaw(raw) {
  return raw == null || raw === "" || raw === "[]" || raw === "{}";
}

/**
 * Fetch this student's remote mirror (RLS-scoped). Pages learning_events ts-ascending
 * (500/page) + the growth_profiles row + all blobs rows. Any failure → null; never throws.
 * @returns {Promise<{events: object[], profile: object|null, blobs: object[]}|null>}
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
    const { data: profRows, error: pErr } = await sb.from("growth_profiles").select("profile,last_regen_at").limit(1);
    if (pErr) { logSync("fetch profile failed", { code: pErr.code }); return null; }
    const profile = profRows && profRows.length ? profRows[0] : null;
    const { data: blobRows, error: bErr } = await sb.from("blobs").select("key,value");
    if (bErr) { logSync("fetch blobs failed", { code: bErr.code }); return null; }
    return { events, profile, blobs: blobRows || [] };
  } catch (e) {
    logSync("fetchRemote threw", { code: e?.name });
    return null;
  }
}

/**
 * Pure. Build the { key: value } map to write, fill-empty-only. Layer-2 event stores → the
 * newest-first payload array (events arrive ts-ascending → reverse); the growth profile
 * object; and ALLOW-listed blob strings (skipping "" tombstones). Values are OBJECTS for
 * Layer 2 (caller stringifies) and RAW STRINGS for blobs (caller writes as-is).
 * @param {object[]} events  ts-ascending learning_events rows
 * @param {object|null} profile  growth_profiles row
 * @param {(key:string)=>(string|null)} localReader  RAW local value (localStorage.getItem)
 * @param {{key:string,value:string}[]} [blobs]  blobs rows
 * @returns {Object<string, any>}
 */
export function materialize(events, profile, localReader, blobs = []) {
  const out = {};
  const byType = {};
  for (const ev of (events || [])) {
    if (!ev || !ev.type) continue;
    (byType[ev.type] = byType[ev.type] || []).push(ev);
  }
  for (const type of Object.keys(TYPE_TO_KEY)) {
    const key = TYPE_TO_KEY[type];
    const group = byType[type];
    if (!group || !group.length) continue;                 // remote has no rows → nothing to fill
    if (!isEmptyRaw(localReader(key))) continue;            // local non-empty → conservative skip
    out[key] = group.map((ev) => ev.payload).reverse();    // OBJECT array (caller stringifies)
  }
  if (profile && profile.profile && isEmptyRaw(localReader(GROWTH_PROFILE_KEY))) {
    out[GROWTH_PROFILE_KEY] = profile.profile;             // OBJECT (caller stringifies)
  }
  for (const row of (blobs || [])) {
    if (!row || !ALLOW_KEYS.has(row.key)) continue;        // classification gate (never a DENY key)
    if (row.value === "" || row.value == null) continue;   // tombstone / absent — never hydrate
    if (!isEmptyRaw(localReader(row.key))) continue;       // fill-empty-only
    out[row.key] = row.value;                              // RAW STRING (caller writes as-is)
  }
  return out;
}

/**
 * Orchestrator. Skips when disabled, already hydrated this session (loop guard), or nothing
 * qualifies. Seeds blob-mirror with the fetched blobs (churn guard) BEFORE deciding writes,
 * then fill-empty-only writes (blobs RAW, Layer-2 stringified), sets the guard, reloads once.
 * @returns {Promise<{hydrated: boolean, keys?: number}>}
 */
export async function hydrateIfNeeded() {
  try {
    if (!getSupabase()) return { hydrated: false };                       // sync disabled
    if (sessionStorage.getItem(HYDRATED_FLAG)) {
      // Post-hydration reload boot (same session): the full fetch is skipped (loop guard),
      // but _lastSent reset on the reload — so re-seed the blob churn guard from a light
      // blobs-only fetch (from REMOTE, so a locally-newer blob still syncs up), else the
      // first sweep would re-upsert every mirrored key once. Never throws (#7).
      try {
        const { data: blobRows } = await getSupabase().from("blobs").select("key,value");
        seedLastSent(Object.fromEntries((blobRows || []).map((b) => [b.key, b.value])));
      } catch (e) { /* silent */ }
      return { hydrated: false };
    }
    const remote = await fetchRemote();
    if (!remote) return { hydrated: false };                              // fetch failed (logged)
    // Seed the churn guard so the FIRST sweep won't re-upsert what already matches remote.
    try { seedLastSent(Object.fromEntries((remote.blobs || []).map((b) => [b.key, b.value]))); } catch (e) { /* silent */ }
    const localReader = (key) => { try { return localStorage.getItem(key); } catch (e) { return "__present__"; } };
    const map = materialize(remote.events, remote.profile, localReader, remote.blobs);
    const keys = Object.keys(map);
    if (!keys.length) return { hydrated: false };                        // nothing qualifies (flag NOT set)
    for (const k of keys) {
      const v = map[k];
      try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) { /* silent */ }
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

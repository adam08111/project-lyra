/**
 * DATA LAYER — P0 Phase 1. Pure mapping from local learning records to Layer-2
 * `learning_events` rows + the growth-profile mirror, plus the enqueue side of each
 * producer hook. localStorage stays authoritative; this only PROJECTS local writes into
 * the outbox (which owns retry + idempotency). No React imports.
 *
 * content_key is EXACTLY what src/content-keys.js computes — the single source of truth
 * shared by local dedup AND the server's unique(student_id, type, content_key). This
 * module never defines a key; it passes the content-keys fns through.
 */
import { tsOf } from "./report-utils.js";
import { grammarKey, growthKey, skillKey, structureKey, vocabKey, reportKey } from "./content-keys.js";
import { enqueue } from "./sync-outbox.js";
import { getSupabase } from "./supabase-client.js";
import { captureWritings } from "./writing-snapshots.js";

// The local stores the mirror + backfill sweep cover (grammar lives under the shim key
// "grammar-log"; the rest are raw localStorage). Defined ONCE here (§3 single source).
export const LEARNING_KEYS = [
  "grammar-log",
  "lyra-growth-log",
  "lyra-skill-deployments",
  "lyra-structures",
  "lyra-vocabulary",
  "lyra-masterclass-reports",
  "lyra-growth-profile",
];

// Counts / status-only debug — never content (§87/§88).
function dbg(msg, extra) { try { if (console.debug) console.debug(`[lyra-sync] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

/**
 * Best-effort event timestamp, ISO string. Reuses report-utils `tsOf` — the SINGLE date
 * parser (id numeric prefix → date/learnedAt/savedAt) — falling back to now. Does NOT
 * introduce a second date parser (§3).
 */
export function eventTs(entry) {
  const t = tsOf(entry);                       // ms number, or 0 when nothing parseable
  return new Date(t > 0 ? t : Date.now()).toISOString();
}

// A content key is "blank" when it carries no real identity — e.g. "|" from a proofread
// instance with both sides empty. Strips the pipe separators and checks what's left.
const isBlankKey = (k) => (k == null ? "" : String(k)).replace(/\|/g, "").trim() === "";

/**
 * Map one local entry → a learning_events row (student_id is attached at flush time).
 * Promoted columns per type (rule=grammar; technique=skill/growth/report where present;
 * topic from the entry); the FULL entry rides in `payload`. Returns null — skipping the
 * mirror, local untouched — when the content key is blank-ish; no key definition changes.
 */
export function toEvent(type, entry, contentKey) {
  if (isBlankKey(contentKey)) { dbg("skip blank content_key", { type }); return null; }
  return {
    type,
    content_key: String(contentKey),
    rule: entry.rule || null,
    technique: entry.technique || entry.skillName || null,
    topic: entry.topic || null,
    ts: eventTs(entry),
    payload: entry,
  };
}

// ── grammar: persist-effect delta hook ────────────────────────────────────────
let _grammarBaseline = null; // module Set of seen grammarKeys; null until the first call

/**
 * Mirror NEWLY-added grammar identities. Called from the grammar SAVE effect, which fires
 * for the loaded/healed log AND every later change (covering all three grammar producers:
 * coaching sync, proofread prepend, §70 save-corrections). The FIRST call initializes the
 * baseline from the given array and enqueues NOTHING — that call carries the
 * already-persisted log, which the one-time backfill (not this) mirrors. Later calls
 * enqueue only keys not yet seen. Deletions are inert (the Set only grows).
 */
export function recordGrammarLogDelta(logArray) {
  const arr = Array.isArray(logArray) ? logArray : [];
  if (_grammarBaseline === null) {
    _grammarBaseline = new Set(arr.map(grammarKey));
    return;
  }
  let emitted = false;
  for (const e of arr) {
    const k = grammarKey(e);
    if (_grammarBaseline.has(k)) continue;
    _grammarBaseline.add(k);
    const ev = toEvent("grammar", e, k);
    if (ev) { enqueue({ kind: "event", payload: ev }); emitted = true; }
  }
  // BRIEF-114 seam (a): a coaching/proofread turn that produced NEW corrections is a meaningful
  // moment — snapshot the current writing(s) too (trigger:'proofread'). Sync-layer only; captureWritings
  // self-diffs (no snapshot if the draft didn't change) and no-ops when sync is off.
  if (emitted) captureWritings("proofread");
}

/**
 * Enqueue mirror events for the just-added entries of a learning-sync dedup block.
 * @param {string} type - a learning_events type
 * @param {object[]} entries - the NEWLY-added entries (already through local dedup)
 * @param {(e:object)=>string} keyFn - the matching content-keys fn
 */
export function recordLearningEvents(type, entries, keyFn) {
  if (!Array.isArray(entries) || !entries.length) return;
  for (const e of entries) {
    const ev = toEvent(type, e, keyFn(e));
    if (ev) enqueue({ kind: "event", payload: ev });
  }
}

/**
 * Mirror the growth profile via the LWW upsert RPC (enqueued; the outbox keeps only the
 * newest queued profile and the server guards ordering). No-ops downstream when sync off.
 */
export function saveProfileRemote(profile, lastRegenAt) {
  if (!profile) return;
  enqueue({ kind: "profile", payload: { profile, last_regen_at: lastRegenAt || null } });
}

// ── one-time (or force) backfill ──────────────────────────────────────────────
const BACKFILL_FLAG = "lyra-sync-backfill-v1";

// Each event store → (event type, content-key fn). grammar lives under the shim key.
const STORE_MIRRORS = [
  { key: "grammar-log", type: "grammar", keyFn: grammarKey },
  { key: "lyra-growth-log", type: "growth", keyFn: growthKey },
  { key: "lyra-skill-deployments", type: "skill_deployed", keyFn: skillKey },
  { key: "lyra-structures", type: "structure", keyFn: structureKey },
  { key: "lyra-vocabulary", type: "vocabulary", keyFn: vocabKey },
  { key: "lyra-masterclass-reports", type: "report", keyFn: reportKey },
];

function readArr(key) {
  try { const a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

/**
 * Sweep the full local learning history (six event stores + the profile) into the
 * outbox so the server mirror materializes from day one; the unique constraint absorbs
 * everything, so it is safe to re-run. Flag-gated by `lyra-sync-backfill-v1`, same
 * idempotent pattern as purgeInauthenticGrowthV1 — runs when the flag is absent OR
 * force is true (a heal-restore of a learning key forces a re-sweep). NO-OP (and the
 * flag is NOT set) when sync is disabled, so it will run for real once it is enabled.
 * @param {{ force?: boolean }} opts
 */
export function backfillIfNeeded({ force = false } = {}) {
  try {
    if (!getSupabase()) return { ran: false };                       // sync off → don't sweep or set the flag
    if (!force && localStorage.getItem(BACKFILL_FLAG)) return { ran: false };
    for (const { key, type, keyFn } of STORE_MIRRORS) {
      const arr = readArr(key);
      if (arr.length) recordLearningEvents(type, arr, keyFn);
    }
    try {
      const raw = localStorage.getItem("lyra-growth-profile");
      const profile = raw ? JSON.parse(raw) : null;
      if (profile) saveProfileRemote(profile, profile.lastRegenAt);
    } catch (e) { /* silent */ }
    try { localStorage.setItem(BACKFILL_FLAG, "done"); } catch (e) { /* silent */ }
    return { ran: true };
  } catch (e) {
    return { ran: false };
  }
}

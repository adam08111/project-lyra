/**
 * BLOB MIRROR — P0 Phase 3 (Layer 1 durability, D9–D11). Mirrors the app's irreplaceable
 * BLOBS (writings + their chats, saved skills, training history, saved concepts, the
 * student name) into the RLS-protected `blobs` table via the same local-first outbox.
 * localStorage stays authoritative; this only PROJECTS blob writes as {kind:"blob", key}
 * MARKERS — the flush reads the LIVE value at send time (freshest wins; no multi-hundred-KB
 * value is ever duplicated into the queue — quota protection, D9). Dual-path capture: the
 * shim listener (2s debounce; shim-carried keys) + a 60s sweep (raw-written keys), so no
 * component writer is touched. §87/§88: logs key NAMES + byte counts only, never a blob
 * VALUE (values go to the database — that is the product). No React imports; unit-testable.
 */
import { enqueue } from "./sync-outbox.js";

// ── classification (SINGLE SOURCE — hydrate.js imports ALLOW_KEYS from here) ───────────
// ALLOW: irreplaceable student/app content NOT owned by Layer 2. Everything else is denied:
// Layer-2-owned (double-mirroring = two sources of truth), device-local sync/auth/backup
// machinery + one-time flags, and derived caches (regenerable). The runtime gate is
// ALLOW-only, so an unlisted key is never mirrored; DENY_KEYS is the explicit artifact.
export const ALLOW_KEYS = new Set([
  "lyra-projects",          // writings + their coaching chats — largest, most irreplaceable
  "lyra-user-name",         // the student's name
  "lyra-style-skills",      // saved analysed writer skills
  "lyra-training-chats",    // Reporter→Columnist practice threads
  "lyra-training-progress", // per-technique attempts
  "lyra-saved-concepts",    // bookmarked grammar concepts
]);
export const DENY_KEYS = new Set([
  // Layer 2 owns these (learning_events / growth_profiles); grammar-log flows THROUGH the shim:
  "grammar-log", "lyra-growth-log", "lyra-skill-deployments", "lyra-structures",
  "lyra-vocabulary", "lyra-masterclass-reports", "lyra-growth-profile",
  // device-local sync/auth/backup machinery + one-time flags (describe THIS device's lifecycle):
  "lyra-backup-v1", "lyra-sync-outbox", "lyra-sync-backfill-v1", "lyra-sync-import-pending",
  "lyra-recovery-code", "lyra-sb-student-id", "lyra-hydrated-v1", "lyra-growth-purge-v1",
  "lyra-title-detrunc-v1",
  // derived caches / transient buffers / change-signals (regenerable — never durable):
  "lyra-growth-pending", "lyra-annotation-glossary", "lyra-word-dictionary",
  "lyra-training-exercises", "lyra-stylelab-reference", "lyra-wl-debug", "lyra-concepts-changed",
]);

const MAX_BYTES = 2 * 1024 * 1024; // D11 size guard
const DEBOUNCE_MS = 2000;

const _lastSent = new Map();        // key → hash of the value we last queued (churn guard)
const _debounceTimers = new Map();  // key → 2s per-key debounce timer

function log(msg, extra) { try { console.info(`[blob] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

// Cheap, stable content hash (FNV-1a + length). A collision only risks a MISSED mirror,
// self-healed by the next write/sweep — never corruption.
function hashValue(v) {
  const s = v == null ? "" : String(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) + ":" + s.length;
}
function byteLen(s) {
  try { return new TextEncoder().encode(s == null ? "" : String(s)).length; }
  catch (e) { return (s == null ? 0 : String(s).length); }
}
function readLive(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// The single enqueue-decision point (used by BOTH the debounce and the sweep). Reads the
// live value; enqueues a MARKER only when the value changed vs what we last queued. Absent/
// empty → a tombstone (flush sends ""). D11: a changed-but-oversized value is skipped with a
// counts-only warn, and its hash is recorded so we don't re-warn every sweep until it changes.
function maybeEnqueue(key) {
  if (!ALLOW_KEYS.has(key)) return;               // deny-list / unknown → never mirror
  const value = readLive(key);
  const h = hashValue(value);
  const prev = _lastSent.get(key);
  if (prev === h) return;                          // unchanged since last queue → no churn
  // Never create a spurious tombstone: a key that was never mirrored and is (still) empty/
  // absent has nothing to mirror. Only a genuine content→empty transition sends a "".
  if ((value == null || value === "") && prev === undefined) { _lastSent.set(key, h); return; }
  const bytes = value == null ? 0 : byteLen(value);
  if (bytes > MAX_BYTES) { log("skip oversized", { key, bytes }); _lastSent.set(key, h); return; }
  _lastSent.set(key, h);
  enqueue({ kind: "blob", key });                 // marker only — flush reads the live value
  log("queued", { key });
}

/**
 * Shim-listener entry point: a shim write to `key` just landed. Deny-checked (so a
 * grammar-log write — which flows through the shim — triggers NO marker), then 2s per-key
 * debounced to coalesce rapid edits before enqueuing.
 */
export function noteWrite(key) {
  if (!ALLOW_KEYS.has(key)) return;               // deny-through-shim
  clearTimeout(_debounceTimers.get(key));
  _debounceTimers.set(key, setTimeout(() => { _debounceTimers.delete(key); maybeEnqueue(key); }, DEBOUNCE_MS));
}

/** 60s interval: catch RAW-written allow-list keys the shim listener never sees. */
export function sweep() {
  for (const key of ALLOW_KEYS) maybeEnqueue(key);
}

/**
 * Hydration seeds this with what it fetched (remote key→value) so the FIRST sweep after a
 * boot doesn't re-upsert values that already match remote (the churn guard). Only ALLOW
 * keys are tracked; a locally-newer value (hash ≠ seeded remote hash) still syncs up.
 */
export function seedLastSent(map) {
  if (!map) return;
  for (const key of Object.keys(map)) {
    if (ALLOW_KEYS.has(key)) _lastSent.set(key, hashValue(map[key]));
  }
}

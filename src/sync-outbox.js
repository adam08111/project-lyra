/**
 * SYNC OUTBOX — P0 Phase 1. An async, retrying, capped queue that mirrors learning
 * data into Supabase WITHOUT ever blocking the student (#7). localStorage stays the
 * authoritative store; this is a durable side-channel.
 *
 * enqueue() is synchronous-cheap and no-ops when sync is disabled; flush() is async,
 * single-flight, and backs off on failure. The server's unique(student_id,type,
 * content_key) makes every replay a no-op, so re-flushing a queue that partially landed
 * is safe. Logs counts / status codes only, never student content (§87/§88 — the
 * payloads go to the RLS-protected database, which is the product, never to a log).
 */
import { getSupabase, ensureStudent } from "./supabase-client.js";

const OUTBOX_KEY = "lyra-sync-outbox";
const CAP = 500;
const CHUNK = 50;
const DEBOUNCE_MS = 3000;
const BACKOFF = [30000, 120000, 600000]; // 30s → 2m → 10m (cap)

let _seq = 0;            // per-session id counter (paired with Date.now() → stable item ids)
let _debounceTimer = null;
let _backoffTimer = null;
let _flushing = false;   // single-flight guard
let _backoffIdx = -1;    // -1 = no active backoff

function readQueue() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function writeQueue(arr) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr)); } catch (e) { /* quota — DB catches up next flush */ }
}

// Status / count-only log — never content (§87/§88).
function log(msg, extra) { try { console.info(`[lyra-sync] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

/**
 * Append an item to the outbox and schedule a debounced flush. No-op — and no
 * `lyra-sync-outbox` key is ever written — unless sync is enabled. Never throws.
 * @param {{ kind: "event"|"profile", payload: object }} item
 */
export function enqueue(item) {
  try {
    if (!item || !getSupabase()) return; // flag off → inert
    const q = readQueue();
    q.push({ id: `${Date.now()}_${_seq++}`, kind: item.kind, payload: item.payload, qts: Date.now() });
    if (q.length > CAP) {
      const dropped = q.length - CAP;
      q.splice(0, dropped);               // drop OLDEST
      log("outbox cap hit — dropped oldest", { dropped, cap: CAP });
    }
    writeQueue(q);
    scheduleFlush();
  } catch (e) { /* never throw into a producer */ }
}

function scheduleFlush() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => { flush(); }, DEBOUNCE_MS);
}

function scheduleBackoff() {
  _backoffIdx = Math.min(_backoffIdx + 1, BACKOFF.length - 1);
  const delay = BACKOFF[_backoffIdx];
  clearTimeout(_backoffTimer);
  _backoffTimer = setTimeout(() => { flush(); }, delay);
  log("flush backoff", { attempt: _backoffIdx + 1, delayMs: delay });
}
function resetBackoff() {
  _backoffIdx = -1;
  clearTimeout(_backoffTimer);
}

/**
 * Drain the outbox to Supabase. Single-flight; requires an identity. Events upsert in
 * 50-row chunks with ON CONFLICT DO NOTHING (replays vanish server-side); only the
 * NEWEST queued profile is sent, via the LWW RPC. Success removes exactly the flushed
 * items (by id, so items enqueued mid-flush survive) and resets backoff; any failure
 * keeps the queue and schedules an exponential backoff retry. Never throws.
 */
export async function flush() {
  if (_flushing) return;
  const sb = getSupabase();
  if (!sb) return;
  const queued = readQueue();
  if (!queued.length) return;
  _flushing = true;
  try {
    const student = await ensureStudent();
    const studentId = student?.studentId;
    if (!studentId) { scheduleBackoff(); return; } // no identity yet — retry later

    const events = queued.filter(it => it.kind === "event");
    const profiles = queued.filter(it => it.kind === "profile");
    // Only the newest queued profile matters; older ones are superseded (and the
    // server LWW guards ordering regardless).
    const newestProfile = profiles.length
      ? profiles.reduce((a, b) => (b.qts >= a.qts ? b : a))
      : null;

    // 1. Events — batched upserts, ON CONFLICT DO NOTHING.
    for (let i = 0; i < events.length; i += CHUNK) {
      const rows = events.slice(i, i + CHUNK).map(it => ({ ...it.payload, student_id: studentId }));
      const { error } = await sb
        .from("learning_events")
        .upsert(rows, { onConflict: "student_id,type,content_key", ignoreDuplicates: true });
      if (error) { log("event flush failed", { code: error.code || error.status }); scheduleBackoff(); return; }
    }

    // 2. Profile — the newest queued one, via the LWW RPC.
    if (newestProfile) {
      const { error } = await sb.rpc("upsert_growth_profile", {
        p_profile: newestProfile.payload.profile,
        p_last_regen_at: newestProfile.payload.last_regen_at ?? null,
      });
      if (error) { log("profile flush failed", { code: error.code || error.status }); scheduleBackoff(); return; }
    }

    // Success: remove exactly the items we flushed (by id) from the CURRENT queue,
    // which may have grown during the awaits — never drop items enqueued since.
    const flushedIds = new Set(queued.map(it => it.id));
    const remaining = readQueue().filter(it => !flushedIds.has(it.id));
    writeQueue(remaining);
    resetBackoff();
    if (remaining.length) scheduleFlush(); // more arrived mid-flush
  } catch (e) {
    log("flush threw", { code: e?.name });
    scheduleBackoff();
  } finally {
    _flushing = false;
  }
}

// Trigger a drain when connectivity returns (the queue persists across offline spells).
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("online", () => { flush(); });
}

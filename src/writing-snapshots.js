/**
 * WRITING SNAPSHOTS — BRIEF-114 (DATA-ARCHITECTURE §3, Tier 1). Emits append-only snapshots of
 * essay drafts into the `writing_snapshots` table via the existing async outbox, so a written
 * draft can never be silently destroyed — not by a vandal, not by a blob clobber, not by the
 * unexplained-loss class. It also captures the product's most valuable object: draft evolution
 * over time.
 *
 * CAPTURE HAPPENS IN THE SYNC LAYER — `lyra.jsx` is untouched, no editor hooks, no new timers.
 * Two seams call captureWritings(): proofread/coaching completion (data-layer's grammar delta)
 * and the 60s blob sweep (sync-init). The blob mirror only keeps a WHOLE-BLOB hash, so this
 * module keeps its OWN per-writing content-hash map to do the per-writing diff + deletion
 * detection. Server dedup on unique(student_id, writing_id, content_hash) makes re-emission a
 * harmless no-op (CLAUDE.md #8), so the in-memory map need not persist across reloads.
 *
 * §87/§88: logs COUNTS only — never essay content. Never throws, never blocks its caller (#7).
 */
import { enqueue } from "./sync-outbox.js";
import { getSupabase } from "./supabase-client.js";
import { hashContent, byteLen } from "./content-hash.js"; // BRIEF-RS: shared with report-snapshots

const PROJECTS_KEY = "lyra-projects";
const MAX_BYTES = 64 * 1024;          // D-I4 sanity rail (essays are ~3KB); skip, don't fail.
const _lastHash = new Map();          // writing_id → content_hash last emitted (per-writing diff)

function log(msg, extra) { try { console.info(`[snapshot] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

// Flatten lyra-projects → [{ id, content }] over every project's writings. `draft` is the essay
// text (lyra.jsx auto-save); `id` is the writing id. Malformed shapes yield [] (never throw).
function readWritings() {
  try {
    const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    if (!Array.isArray(projects)) return [];
    const out = [];
    for (const p of projects) {
      const ws = p && Array.isArray(p.writings) ? p.writings : [];
      for (const w of ws) {
        if (w && w.id != null) out.push({ id: String(w.id), content: w.draft == null ? "" : String(w.draft) });
      }
    }
    return out;
  } catch (e) { return []; }
}

/**
 * Diff current writings against what we last emitted; enqueue one snapshot per CHANGED/NEW
 * writing (tagged with `trigger`), plus a tombstone for any tracked writing that vanished
 * (D-I3 — deletion becomes recorded history, not destruction). No-op when sync is off (the
 * D-gate pin) and when nothing changed. Never throws.
 * @param {"proofread"|"sweep"} trigger
 */
export function captureWritings(trigger) {
  try {
    if (!getSupabase()) return;                                   // flag off → emit nothing anywhere
    const writings = readWritings();
    const seen = new Set();
    for (const w of writings) {
      seen.add(w.id);
      const h = hashContent(w.content);
      if (_lastHash.get(w.id) === h) continue;                   // unchanged since last emit → no churn
      if (byteLen(w.content) > MAX_BYTES) { log("skip oversized", { bytes: byteLen(w.content) }); _lastHash.set(w.id, h); continue; }
      _lastHash.set(w.id, h);
      enqueue({ kind: "snapshot", payload: { writing_id: w.id, content: w.content, content_hash: h, trigger, deleted: false } });
    }
    // A writing we were tracking that is now absent → a deletion event. Namespaced hash so the
    // tombstone can't collide with a content snapshot for the same writing.
    for (const id of [..._lastHash.keys()]) {
      if (seen.has(id)) continue;
      const last = _lastHash.get(id);
      _lastHash.delete(id);
      enqueue({ kind: "snapshot", payload: { writing_id: id, content: "", content_hash: "deleted:" + last, trigger: "delete", deleted: true } });
    }
  } catch (e) {
    log("captureWritings threw", { code: e?.name });             // invisible on failure — never blocks the caller
  }
}

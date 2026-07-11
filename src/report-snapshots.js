/**
 * REPORT SNAPSHOTS — BRIEF-RS (DATA-ARCHITECTURE §3, Tier 1). Takes the Continuous Growth
 * Report off "the glass": the report is otherwise LWW-mutable in `growth_profiles` (one row,
 * overwritten on every regen), so a re-generation silently replaces the prior assessment. This
 * emits an append-only snapshot of each AS-ISSUED report into `report_snapshots` via the existing
 * async outbox, so no report is ever silently destroyed — and, as a free bonus, the archive is
 * the student's band-estimate trajectory over time (each profile carries `level.bandEstimate`).
 *
 * CAPTURE HAPPENS IN THE SYNC LAYER — `lyra.jsx` is untouched. The single seam is growth-report's
 * saveProfile (fires only on a real regen; NOT saveProfileRemote, which also runs on backfill —
 * D-K4: history begins at landing, no backfill snapshots). One emitter call, transported by the
 * outbox (a new `report` kind + flush branch, reusing §112's enqueue + the shared content hash —
 * single source of truth, no new pipeline).
 *
 * PER-ISSUANCE, not content-deduplicated: every regen re-stamps `lastRegenAt` (growth-report.js),
 * so distinct regens always serialize differently and each is archived as its own issuance — which
 * is what a trajectory archive wants. The server-side unique(student_id, content_hash) + ON CONFLICT
 * DO NOTHING instead makes a re-flushed/replayed enqueue IDEMPOTENT (a reload with an undrained
 * outbox can't double-insert the same issuance). The hash is JSON.stringify(profile) hashed ONCE
 * here (D-K1, ratified) — the profile is a JS object all the way to the RPC, so there is no "exact
 * wire string" to hash; this serialization is self-consistent with the stored `report`, which is
 * all the idempotency key needs.
 *
 * §87/§88: logs COUNTS only — never report content. Never throws, never blocks its caller (#7).
 */
import { enqueue } from "./sync-outbox.js";
import { getSupabase } from "./supabase-client.js";
import { hashContent, byteLen } from "./content-hash.js";

const MAX_BYTES = 64 * 1024;          // D-K5 sanity rail (reports are a few KB); skip, don't fail.

function log(msg, extra) { try { console.info(`[report-snapshot] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

/**
 * Enqueue an append-only snapshot of an as-issued growth report. No-op when sync is off (the
 * flag pin) or the profile is unusable. Server dedup on (student_id, content_hash) absorbs a
 * replayed enqueue (reload/re-flush of the same payload), so no in-memory diff is needed; a
 * distinct regen re-stamps lastRegenAt → a new hash → its own archived issuance. Never throws.
 * @param {object} profile  the freshly regenerated growth profile (stored whole, no field selection)
 * @param {"regen"} [trigger]
 */
export function captureReport(profile, trigger = "regen") {
  try {
    if (!getSupabase()) return;                                    // flag off → emit nothing anywhere
    if (!profile || typeof profile !== "object") return;           // nothing to archive
    const serialized = JSON.stringify(profile);
    if (byteLen(serialized) > MAX_BYTES) { log("skip oversized", { bytes: byteLen(serialized) }); return; }
    const content_hash = hashContent(serialized);
    enqueue({ kind: "report", payload: { report: profile, content_hash, trigger } });
  } catch (e) {
    log("captureReport threw", { code: e?.name });                 // invisible on failure — never blocks the caller
  }
}

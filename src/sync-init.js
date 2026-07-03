/**
 * SYNC INIT — P0 Phase 0 boot hook. Async and fire-and-forget: it is called
 * UN-AWAITED after the boot chain so it can never delay first paint, reorder boot, or
 * throw into it (#7). Flag off (env unset) → exposes a disabled status() and returns;
 * flag on → resolves the student id and exposes a console utility (precedent: backup.js).
 * No learning data syncs in this phase; claim() arrives in Phase 2.
 */
import { getSupabase, ensureStudent } from "./supabase-client.js";
import { flush } from "./sync-outbox.js";
import { backfillIfNeeded, LEARNING_KEYS } from "./data-layer.js";

export async function initSync({ restoredKeys = [] } = {}) {
  try {
    if (!getSupabase()) {
      window.lyraSync = { status: () => ({ enabled: false }) };
      return;
    }
    const res = await ensureStudent();
    const studentId = res?.studentId || null;
    window.lyraSync = {
      status: () => ({ enabled: true, studentId }),
      code: () => localStorage.getItem("lyra-recovery-code"),
    };
    // §96: one-time (or heal-restore-forced) backfill of local history, then drain the
    // outbox — this session's enqueues AND any queue persisted from a prior boot. A heal
    // of any learning key forces a re-sweep (the unique constraint absorbs the overlap).
    backfillIfNeeded({ force: (restoredKeys || []).some((k) => LEARNING_KEYS.includes(k)) });
    flush();
  } catch (e) {
    // Never strand boot — degrade to a disabled shim so callers still get an answer.
    try { window.lyraSync = { status: () => ({ enabled: false }) }; } catch (e2) { /* silent */ }
  }
}

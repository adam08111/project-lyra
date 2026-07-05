/**
 * SYNC INIT — P0 boot hook. Async and fire-and-forget: called UN-AWAITED after the boot
 * chain so it can never delay first paint, reorder boot, or throw into it (#7). Flag off
 * (env unset) → exposes a disabled status() and returns. Flag on → resolves the student
 * id, exposes a console utility (precedent: backup.js), HYDRATES remote history back into
 * local (Phase 2, D7 + Phase 3 blobs, D10), sets up dual-path blob capture (D9), then
 * backfills + drains the outbox.
 */
import { getSupabase, ensureStudent, claimStudent, STUDENT_ID_HINT } from "./supabase-client.js";
import { flush } from "./sync-outbox.js";
import { backfillIfNeeded, LEARNING_KEYS } from "./data-layer.js";
import { hydrateIfNeeded, HYDRATED_FLAG } from "./hydrate.js";
import { registerStorageListener } from "./storage-shim.js";
import { noteWrite, sweep } from "./blob-mirror.js";

const IMPORT_PENDING = "lyra-sync-import-pending";

/**
 * D8: has the resolved identity changed vs the hint stored on this device? A truthy hint
 * that differs from the freshly-resolved id means the device forked (cache-clear re-mint,
 * or a different account). Pure + testable; v1 surfaces only — claim() is the recovery.
 */
export function detectIdentityChanged(hadHint, resolvedId) {
  return !!(hadHint && resolvedId && hadHint !== resolvedId);
}

export async function initSync({ restoredKeys = [] } = {}) {
  try {
    if (!getSupabase()) {
      window.lyraSync = { status: () => ({ enabled: false }) };
      return;
    }
    // Read the prior hint BEFORE ensureStudent overwrites it (§95 self-correction).
    let hadHint = null;
    try { hadHint = localStorage.getItem(STUDENT_ID_HINT); } catch (e) { /* silent */ }

    const res = await ensureStudent();
    const studentId = res?.studentId || null;

    // §99 Step 5 (D8): surface a forked identity. ids are opaque UUIDs — safe to log;
    // student CONTENT never is. v1 does not pause sync or prompt; claim() recovers.
    const identityChanged = detectIdentityChanged(hadHint, studentId);
    if (identityChanged) console.warn("[sync] identity changed", { hadHint: true });

    window.lyraSync = {
      status: () => ({ enabled: true, studentId, ...(identityChanged ? { identityChanged: true } : {}) }),
      code: () => localStorage.getItem("lyra-recovery-code"),
      // §99 Step 3 (D3 recovery): claim → re-point identity → reload → hydration fires.
      claim: async (code) => {
        const ok = await claimStudent(code);
        if (ok) {
          try { sessionStorage.removeItem(HYDRATED_FLAG); } catch (e) { /* silent */ } // re-hydrate the claimed identity
          try { location.reload(); } catch (e) { /* silent */ }
        }
        return ok;
      },
    };

    // §99 Step 2 (D7): hydrate BEFORE backfill — a device that pulls remote history must
    // not then re-sweep it. hydrateIfNeeded RELOADS when it writes, but location.reload()
    // does NOT halt synchronous JS — so we must explicitly STOP here when it hydrated,
    // else backfill would re-sweep the just-written stores in this same tick. The imminent
    // reload re-runs initSync on the settled state (guard set → hydrate skips; backfill
    // flag respected as-is → no re-sweep of what we just pulled).
    const { hydrated } = await hydrateIfNeeded();
    if (hydrated) return;

    // §101 Step 5 (D9): dual-path blob capture. The shim listener catches shim-carried
    // writes (2s debounce); the 60s sweep catches RAW-written allow-list keys. Set up AFTER
    // the hydrate early-return so a hydrating boot (which reloads) doesn't register a
    // listener/interval it is about to discard. flush also fires on visibility→hidden
    // (best-effort capture before the tab backgrounds); `online` is handled in sync-outbox.
    registerStorageListener(noteWrite);
    try { setInterval(() => { try { sweep(); } catch (e) { /* silent */ } }, 60000); } catch (e) { /* silent */ }
    try {
      if (typeof document !== "undefined" && window.addEventListener) {
        window.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") { try { flush(); } catch (e) { /* silent */ } }
        });
      }
    } catch (e) { /* silent */ }

    // §99 Step 4: a just-imported backup forces a re-mirror (DataExport's raw setItem
    // bypassed the producer hooks); consume the one-shot flag. Otherwise the §96
    // heal-restore force. The unique constraint absorbs every replay.
    const importPending = !!localStorage.getItem(IMPORT_PENDING);
    backfillIfNeeded({ force: importPending || (restoredKeys || []).some((k) => LEARNING_KEYS.includes(k)) });
    if (importPending) { try { localStorage.removeItem(IMPORT_PENDING); } catch (e) { /* silent */ } }
    flush();
  } catch (e) {
    // Never strand boot — degrade to a disabled shim so callers still get an answer.
    try { window.lyraSync = { status: () => ({ enabled: false }) }; } catch (e2) { /* silent */ }
  }
}

/**
 * RECOVERY LIB (BRIEF-112 / §121) — the student-facing half of "student login". Three moves:
 * SEE the recovery code, REGENERATE a fresh one when the device's copy is lost (§97.1: a fork
 * destroys the stored code at the moment it's needed), and USE a code from another device to
 * reclaim the account. Reuses the mint path's generator + hash + key (supabase-client.js), so the
 * code shape has ONE source of truth. Counts/status-only logging — the plaintext code NEVER leaves
 * the device except the existing claim_student call, and is NEVER logged (§87/§88; these are minors).
 */
import { getSupabase, generateRecoveryCode, sha256Hex, RECOVERY_CODE_KEY } from "../supabase-client.js";

function log(msg, extra) { try { console.info(`[lyra-recovery] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

// The recovery code stored on THIS device (written by the mint and by a successful claim), or "".
export function currentCode() {
  try { return localStorage.getItem(RECOVERY_CODE_KEY) || ""; } catch (e) { return ""; }
}

/**
 * Regenerate: mint a new code, hash it with the §95 WebCrypto path, store ONLY the hash server-side
 * (regenerate_recovery_code, migration 0010), then persist the new plaintext locally for display.
 * The old code stops working the instant the server row updates. Never-stuck: returns the new code
 * on success, or null on ANY failure — no throw, and the code is never logged.
 * @returns {Promise<string|null>}
 */
export async function regenerate() {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const code = generateRecoveryCode();
    const p_new_hash = await sha256Hex(code);
    const { error } = await sb.rpc("regenerate_recovery_code", { p_new_hash });
    if (error) { log("regen failed", { code: error.status || error.code || error.name }); return null; }
    try { localStorage.setItem(RECOVERY_CODE_KEY, code); } catch (e) { /* silent */ }
    log("regen ok");
    return code;
  } catch (e) {
    log("regen threw", { code: e?.name });
    return null;
  }
}

/**
 * Claim the account that owns `code` onto this device — a thin wrapper on the proven
 * window.lyraSync.claim (§99), which calls claim_student, clears the hydrate guard, and reloads so
 * the claimed history materializes. Null-guarded: lyraSync.claim is ABSENT under a teacher session /
 * flag-off / a boot error (§109), so we fail honestly rather than throw. Returns true on success
 * (the page then reloads); false otherwise. The code is never logged.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function claim(code) {
  try {
    const fn = typeof window !== "undefined" && window.lyraSync && window.lyraSync.claim;
    if (typeof fn !== "function") { log("claim unavailable"); return false; }
    return await fn(code);
  } catch (e) {
    log("claim threw", { code: e?.name });
    return false;
  }
}

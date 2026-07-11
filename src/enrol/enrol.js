/**
 * ENROL — client wrapper for the enrol_student RPC (BRIEF-ENROL). Calls the SAME anonymous student
 * Supabase client the rest of the app uses (getSupabase); the RPC (security definer) does the
 * verify-and-link server-side. Discriminated result, NEVER throws, never leaves the UI stuck (#7).
 *
 * §87/§88: logs status/counts only — never the code or the name.
 */
import { getSupabase } from "../supabase-client.js";

function logE(msg, extra) { try { console.info(`[lyra-enrol] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

// Client-side mirrors of the server's sanitize/normalize (the server re-applies them — this is UX,
// not a security boundary). Kept tiny + exported so the overlay and its tests share one definition.
export function sanitizeName(raw) {
  // Strip ASCII control chars, collapse whitespace, trim, hard-cap 40 (mirrors the server SQL).
  return String(raw == null ? "" : raw).replace(/[\x00-\x1f\x7f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}
export function normalizeCode(raw) {
  return String(raw == null ? "" : raw).trim().toUpperCase();
}

/**
 * Enrol the current student into a class by code. Never throws.
 * @returns {Promise<{ok:true, class:{name:string, teacher:string}} | {ok:false, reason:"not-configured"|"not-recognised"|"error"}>}
 *   not-configured → sync is off (no client); not-recognised → the RPC rejected (bad/empty code or
 *   no identity — one non-oracle reason); error → network/unexpected. All three are retryable.
 */
export async function enrolStudent(classCode, displayName) {
  try {
    const sb = getSupabase();
    if (!sb) return { ok: false, reason: "not-configured" };
    const { data, error } = await sb.rpc("enrol_student", {
      p_class_code: normalizeCode(classCode),
      p_display_name: sanitizeName(displayName),
    });
    if (error) { logE("enrol rejected", { code: error.code }); return { ok: false, reason: "not-recognised" }; }
    return { ok: true, class: { name: (data && data.class_name) || "", teacher: (data && data.teacher_display_name) || "" } };
  } catch (e) {
    logE("enrol threw", { code: e?.name });
    return { ok: false, reason: "error" };
  }
}

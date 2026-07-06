/**
 * TEACHER AUTH — §106, session-isolated in §109. Email + password sign-in for the operator-
 * provisioned teacher surface, on the ISOLATED teacher client (its own auth storageKey) so it
 * NEVER touches the student's anonymous session. Teachers reach the `authenticated` role;
 * RLS + current_teacher_id() (migration 0005) do the authorization.
 *
 * Every function is fully try/catch'd and resolves to a discriminated result — never
 * throws, never leaves a caller hanging (never-stuck #7). Logging is counts/status-only
 * (§87/§88): these sessions sit in front of minors' learning data — never log content,
 * credentials, or the email.
 */
import { getTeacherClient } from "./teacher-client.js";

function logT(msg, extra) {
  try { console.info(`[lyra-teacher] ${msg}`, extra || ""); } catch (e) { /* silent */ }
}

/**
 * Resolve the signed-in teacher, if any. Returns:
 *   { ok: true, teacher: { id, display_name } }         — signed in AND mapped to a teachers row
 *   { ok: false, error: "not-configured" }              — Supabase flag off (no teacher client)
 *   { ok: false, error: "signed-out" }                  — no active session
 *   { ok: false, error: "no-teacher-row" }              — session exists but no teachers mapping
 *   { ok: false, error: "query-failed" | "threw" }      — transient/unexpected failure (retryable)
 */
export async function currentTeacher() {
  try {
    const sb = getTeacherClient();
    if (!sb) return { ok: false, error: "not-configured" };
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) return { ok: false, error: "signed-out" };
    // RLS (teacher_self) scopes this to the caller's own row.
    const { data, error } = await sb.from("teachers").select("id, display_name").limit(1);
    if (error) { logT("teacher select failed", { code: error.code }); return { ok: false, error: "query-failed" }; }
    if (!data || !data.length) return { ok: false, error: "no-teacher-row" };
    return { ok: true, teacher: data[0] };
  } catch (e) {
    logT("currentTeacher threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}

/**
 * Sign in with email + password, then resolve the teacher. On credential failure returns
 * { ok:false, error:"bad-credentials" } (never surfacing which of user/pass was wrong).
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  try {
    const sb = getTeacherClient();
    if (!sb) return { ok: false, error: "not-configured" };
    const { error } = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    if (error) { logT("signin failed", { code: error.status || error.name }); return { ok: false, error: "bad-credentials" }; }
    return await currentTeacher();
  } catch (e) {
    logT("signin threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}

/** Sign out. Best-effort — never throws; a failure just leaves the session as-is. */
export async function signOut() {
  try {
    const sb = getTeacherClient();
    if (sb) await sb.auth.signOut();
    return { ok: true };
  } catch (e) {
    logT("signout threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}

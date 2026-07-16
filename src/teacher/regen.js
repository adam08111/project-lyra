/**
 * TEACHER REGEN (BRIEF-TR / §123) — Lyra's FIRST teacher WRITE. A teacher regenerates a student's
 * recovery code when the student can't self-serve (lost phone AND no usable code). The teacher's
 * browser mints the new code + hashes it with the SAME §95 primitives the student regen uses
 * (generateRecoveryCode / sha256Hex, single source), and sends ONLY the hash to teacher_regen_code
 * (migration 0011) — the server never sees the new plaintext (§87/§88). The code is returned ONCE for
 * one-time on-screen display and is NEVER persisted on the teacher side; in particular NEVER under
 * RECOVERY_CODE_KEY — that key is the DEVICE's own student identity, so writing it from the teacher
 * flow would poison the next student session on a shared machine (the D-M5 cross-surface lens). The
 * call runs through the §109-isolated teacher client only. Counts/status-only logging, never the code.
 */
import { getTeacherClient } from "./teacher-client.js";
import { generateRecoveryCode, sha256Hex } from "../supabase-client.js";

function logT(msg, extra) { try { console.info(`[lyra-teacher-regen] ${msg}`, extra || ""); } catch (e) { /* silent */ } }

/**
 * Regenerate `studentId`'s recovery code. Mints locally → hashes → teacher_regen_code(id, hash) via
 * the teacher client → returns the new plaintext ONCE for display. Never-stuck: a discriminated,
 * retryable result, never a throw; the plaintext appears only in the return value (for the one-time
 * card) — never in a log, never in any storage.
 * @param {string} studentId
 * @returns {Promise<{status:'ok', code:string} | {status:'not-configured'|'not-permitted'|'error'}>}
 */
export async function teacherRegenCode(studentId) {
  try {
    const sb = getTeacherClient();
    if (!sb) return { status: "not-configured" };
    const code = generateRecoveryCode();
    const p_new_hash = await sha256Hex(code);
    const { error } = await sb.rpc("teacher_regen_code", { p_student_id: studentId, p_new_hash });
    if (error) {
      logT("regen failed", { code: error.code || error.status || error.name });
      // P0001 is the RPC's ONE non-oracle authorization error; anything else is transport/other.
      return { status: error.code === "P0001" ? "not-permitted" : "error" };
    }
    logT("regen ok");
    return { status: "ok", code };
  } catch (e) {
    logT("regen threw", { code: e?.name });
    return { status: "error" };
  }
}

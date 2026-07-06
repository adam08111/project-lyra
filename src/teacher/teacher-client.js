/**
 * TEACHER SUPABASE CLIENT — §109 (Layer 1). A SEPARATE Supabase client from the student
 * app's default client, with a distinct auth `storageKey`, so a teacher sign-in and the
 * student's anonymous session coexist per-origin WITHOUT overwriting each other. This closes
 * the §106 defect where the teacher surface reused the student client and shared ONE auth
 * storage key (teacher sign-in replaced the student session → next student boot minted a
 * teacher-owned `students` row).
 *
 * Consumes the ONE env config from supabase-client.js (`getSupabaseConfig`) — no second env
 * read (single source of truth #3). Lazy singleton; returns null when the flag is off, which
 * feeds §106's existing `not-configured` result path. Never throws.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../supabase-client.js";

let _teacherClient = null;

export function getTeacherClient() {
  if (_teacherClient) return _teacherClient;
  try {
    const { url, anonKey, isConfigured } = getSupabaseConfig();
    if (!isConfigured) return null;
    _teacherClient = createClient(url, anonKey, {
      auth: { storageKey: "lyra-teacher-auth", persistSession: true, autoRefreshToken: true },
    });
    return _teacherClient;
  } catch (e) {
    try { console.info("[lyra-teacher] createClient failed", { code: e?.name }); } catch (e2) { /* silent */ }
    return null;
  }
}

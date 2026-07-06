/**
 * SUPABASE CLIENT — P0 Phase 0 foundation (D1–D6). Feature-flagged: when
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are unset, getSupabase() returns null
 * and the whole sync layer is inert — the app is byte-identical to today
 * (never-stuck #7, offline-tolerant, local-first).
 *
 * D6: the anon key ships client-side BY DESIGN — its authority is Row Level Security,
 * NOT secrecy. `service_role` must NEVER appear in this file, the bundle, or Vercel env.
 * §87/§88 privacy: this layer logs COUNTS / STATUS CODES only, never student content
 * (these are minors) — and the plaintext recovery code is never logged.
 */
import { createClient } from "@supabase/supabase-js";

export const STUDENT_ID_HINT = "lyra-sb-student-id";
const RECOVERY_CODE_KEY = "lyra-recovery-code";
// No ambiguous glyphs (0/O, 1/I/L) so a student can transcribe the code by hand.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

let _client = null;
let _studentId = null;

// Status/count-only log — never content, never the recovery code (§87/§88).
function logSync(msg, extra) {
  try { console.info(`[lyra-sync] ${msg}`, extra || ""); } catch (e) { /* silent */ }
}

/**
 * The memoized Supabase client, or null when the flag is off. Reads env LAZILY on
 * each call until a client is successfully created (so tests can vi.stubEnv). Both
 * vars present → memoized client; otherwise null. Never throws.
 */
/**
 * §109 — the SINGLE place the env pair is read (lazily, so tests can vi.stubEnv). Both the
 * student client (getSupabase, below) and the teacher client (src/teacher/teacher-client.js)
 * consume THIS — never a second env read (single source of truth #3).
 */
export function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return { url, anonKey, isConfigured: !!(url && anonKey) };
}

export function getSupabase() {
  if (_client) return _client;
  try {
    const { url, anonKey, isConfigured } = getSupabaseConfig();
    if (!isConfigured) return null;
    _client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    return _client;
  } catch (e) {
    logSync("createClient failed", { code: e?.name });
    return null;
  }
}

// 16 chars in 4 dash-separated groups: XXXX-XXXX-XXXX-XXXX.
function generateRecoveryCode() {
  const rand = new Uint32Array(16);
  crypto.getRandomValues(rand);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += RECOVERY_ALPHABET[rand[i] % RECOVERY_ALPHABET.length];
    if (i % 4 === 3 && i < 15) out += "-";
  }
  return out;
}

async function sha256Hex(s) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve (or create) this device's student row via anonymous auth, so a real
 * auth.uid() enforces RLS from migration 0001. Fully try/catch'd: returns
 * { studentId } or null; ANY failure logs one counts-only line and returns null —
 * the app must be indifferent to it (#7). No content is ever logged.
 */
export async function ensureStudent() {
  if (_studentId) return { studentId: _studentId };
  try {
    const sb = getSupabase();
    if (!sb) return null;

    // 1. Existing session, or anonymous sign-in (gives a real auth.uid()).
    const { data: sess } = await sb.auth.getSession();

    // §109 (Layer 2 guard): NEVER resolve/mint a student under a NON-anonymous session. If a
    // teacher signed in on this same browser+origin, running the student sync under their uid
    // would attribute this device's data to the teacher (the §97.1 clobber). Fail SAFE — treat
    // anything not provably anonymous as non-anonymous, and refuse. This sits inside
    // ensureStudent so EVERY caller (initSync boot AND the sync-outbox flush) is protected, so
    // the bug can't return via a new call site. The teacher client (§109 Layer 1) already keeps
    // the sessions in separate storage; this is defense-in-depth against any future identity.
    if (sess?.session && sess.session.user?.is_anonymous !== true) {
      logSync("non-anonymous session — refusing to resolve student");
      return { nonAnonymous: true };
    }

    if (!sess?.session) {
      const { error: signErr } = await sb.auth.signInAnonymously();
      if (signErr) { logSync("anon sign-in failed", { code: signErr.status || signErr.name }); return null; }
    }

    // 2. Our own students row (RLS scopes the select to auth.uid()).
    const { data: rows, error: selErr } = await sb.from("students").select("id").limit(1);
    if (selErr) { logSync("student select failed", { code: selErr.code }); return null; }
    if (rows && rows.length) return cacheStudent(rows[0].id);

    // 3. None yet → mint a recovery code and insert our row. on-conflict-do-nothing on
    //    auth_user_id (unique): a cross-tab first-boot race can't create two rows.
    const code = generateRecoveryCode();
    const recovery_code_hash = await sha256Hex(code);
    const { data: inserted, error: insErr } = await sb
      .from("students")
      .upsert({ recovery_code_hash }, { onConflict: "auth_user_id", ignoreDuplicates: true })
      .select("id");
    if (insErr) { logSync("student insert failed", { code: insErr.code }); return null; }

    if (inserted && inserted.length) {
      // WE created the row → persist the plaintext code device-locally so the student
      // can write it down. (Cross-tab first-boot race: the losing tab inserts nothing
      // and never stores a code — benign; only the winner's code exists server-side.)
      const result = cacheStudent(inserted[0].id);
      try { localStorage.setItem(RECOVERY_CODE_KEY, code); } catch (e) { /* silent */ }
      return result;
    }

    // Insert did nothing (a row already existed — the race): re-select it, and do NOT
    // store the code we generated (the winning tab's code is the one written down).
    const { data: raced } = await sb.from("students").select("id").limit(1);
    if (raced && raced.length) return cacheStudent(raced[0].id);
    return null;
  } catch (e) {
    logSync("ensureStudent threw", { code: e?.name });
    return null;
  }
}

// Cache the id in module memory + a localStorage HINT (the server row is truth).
function cacheStudent(id) {
  _studentId = id;
  try { localStorage.setItem(STUDENT_ID_HINT, id); } catch (e) { /* silent */ }
  return { studentId: id };
}

/**
 * D3 recovery (P0 Phase 2). Claim the student that owns `code` onto this device's auth
 * identity. Normalizes the code (trim + uppercase — generated codes are already upper +
 * dashes, so this only tolerates hand-typing) and calls the claim_student RPC (fixed in
 * §98). On TRUE: drop the stale student-id hint so ensureStudent re-resolves, and persist
 * the code locally so lyraSync.code() keeps printing it; the caller then reloads
 * (→ ensureStudent re-points → hydration materializes the claimed history). On FALSE /
 * error: NO state change. Counts/status-only logging (§87/§88) — never the code.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function claimStudent(code) {
  try {
    const sb = getSupabase();
    if (!sb) return false;
    const p_code = String(code || "").trim().toUpperCase();
    if (!p_code) return false;
    const { data, error } = await sb.rpc("claim_student", { p_code });
    if (error) { logSync("claim failed", { code: error.status || error.name }); return false; }
    if (data !== true) { logSync("claim rejected"); return false; }
    _studentId = null;                                    // force re-resolve on next ensureStudent
    try { localStorage.removeItem(STUDENT_ID_HINT); } catch (e) { /* silent */ }
    try { localStorage.setItem(RECOVERY_CODE_KEY, p_code); } catch (e) { /* silent */ }
    logSync("claim ok");
    return true;
  } catch (e) {
    logSync("claim threw", { code: e?.name });
    return false;
  }
}

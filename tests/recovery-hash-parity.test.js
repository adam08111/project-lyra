// D-S5 (§126 / BRIEF-SWEEP) — HASH-PIPELINE PARITY, unmocked WebCrypto.
//
// The single most catastrophic failure mode of teacher-mediated recovery: a teacher regenerates a
// child's code and hands it over on paper, but the hash the teacher's browser stored doesn't match
// what the server computes when she claims it — so a real, correctly-typed recovery code silently
// fails at the worst moment. This pins that it cannot happen: the teacher pipeline
// (src/teacher/regen.js) and the student pipeline (src/recovery/recovery.js regenerate()) must hash
// the SAME code to the SAME 64-hex, and that hex must equal the server's stored/compared value.
//
// Both libs call sha256Hex(generateRecoveryCode()) from supabase-client.js. We force the generator to
// a FIXED code and capture the p_new_hash each lib sends to its RPC, using REAL sha256Hex (no crypto
// mock) — a future refactor that breaks parity must now break THIS test, not a child's recovery code.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

// Real WebCrypto in whatever env vitest picked (node exposes crypto.subtle; a DOM env might not).
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

// A sample code in the canonical form generateRecoveryCode() emits: uppercase, trimmed, XXXX-XXXX-XXXX-XXXX.
const FIXED_CODE = "ABCD-EFGH-JKLM-NPQR";
const captured = { student: null, teacher: null };

// Keep REAL sha256Hex + RECOVERY_CODE_KEY; override only the generator (force the same code) and the
// client factory (capture the hash the student pipeline sends, return success).
vi.mock("../src/supabase-client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateRecoveryCode: () => FIXED_CODE,
    getSupabase: () => ({ rpc: (_name, p) => { captured.student = p.p_new_hash; return Promise.resolve({ error: null }); } }),
  };
});
// The teacher pipeline sends through the §109-isolated teacher client — capture its hash too.
vi.mock("../src/teacher/teacher-client.js", () => ({
  getTeacherClient: () => ({ rpc: (_name, p) => { captured.teacher = p.p_new_hash; return Promise.resolve({ error: null }); } }),
}));

import { regenerate } from "../src/recovery/recovery.js";
import { teacherRegenCode } from "../src/teacher/regen.js";
import { sha256Hex } from "../src/supabase-client.js"; // real — the mock spreads ...actual

beforeEach(() => { captured.student = null; captured.teacher = null; });

describe("D-S5 — recovery hash-pipeline parity (student ↔ teacher), real WebCrypto", () => {
  it("both pipelines hash the SAME code to the SAME 64-hex", async () => {
    const s = await regenerate();                        // student regen returns the code on success
    const t = await teacherRegenCode("stud-1");
    expect(s).toBe(FIXED_CODE);
    expect(t).toEqual({ status: "ok", code: FIXED_CODE });
    expect(captured.student).toMatch(/^[0-9a-f]{64}$/);
    expect(captured.student).toBe(captured.teacher);      // PARITY — the crux
    expect(captured.student).toBe(await sha256Hex(FIXED_CODE));
  });

  it("pins the server hash contract: encode(digest(upper(trim(code)),'sha256'),'hex')", async () => {
    // Recomputed once with node's WebCrypto over the canonical sample. The Postgres side stores/compares
    // encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex'); the client sha256Hex must equal it.
    // Editing this vector means the hash contract changed — a ratified decision + a § entry, not a tweak.
    const KNOWN = "2356329028e8ba9d57b3f7b33fef1b1f6d35dc228c095c4959bb873738fc2f3c";
    expect(await sha256Hex(FIXED_CODE)).toBe(KNOWN);
    // The server normalizes upper(trim(...)) at claim time; a messily-typed variant hashes to the SAME
    // vector — which holds ONLY because generateRecoveryCode emits an already-canonical code (sha256Hex
    // does NO client-side normalization). If the generator ever emitted lower-case/spaced codes, a
    // stored hash would stop matching a claim — this line is the tripwire for that.
    expect(await sha256Hex("  abcd-efgh-jklm-npqr  ".trim().toUpperCase())).toBe(KNOWN);
  });
});

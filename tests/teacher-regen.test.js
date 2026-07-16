// @vitest-environment happy-dom
//
// BRIEF-TR — the teacher regen lib. The teacher client + the shared code primitives are mocked (no
// network, no crypto). Proves: mint → hash → teacher_regen_code(id, ONLY the hash) via the TEACHER
// client → return the code once; discriminated + never-stuck; NEVER writes any storage (esp. the
// device's own recovery key — the D-M5 cross-surface rule); never logs the code.
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ client: null, rpcCalls: [], rpcResult: { data: null, error: null }, rpcThrow: false }));

vi.mock("../src/teacher/teacher-client.js", () => ({ getTeacherClient: () => h.client }));
vi.mock("../src/supabase-client.js", () => ({
  generateRecoveryCode: () => "TCHR-CODE-1111-2222",
  sha256Hex: async () => "b".repeat(64),
}));

function makeClient() {
  return { rpc: (name, params) => { h.rpcCalls.push({ name, params }); if (h.rpcThrow) throw new Error("down"); return Promise.resolve(h.rpcResult); } };
}

import { teacherRegenCode } from "../src/teacher/regen.js";

beforeEach(() => {
  h.client = makeClient(); h.rpcCalls = []; h.rpcResult = { data: null, error: null }; h.rpcThrow = false;
  localStorage.clear();
});

describe("teacher regen lib — teacherRegenCode", () => {
  it("mints, calls teacher_regen_code with the studentId + ONLY the hash, returns the code once", async () => {
    const r = await teacherRegenCode("stud-1");
    expect(r).toEqual({ status: "ok", code: "TCHR-CODE-1111-2222" });
    expect(h.rpcCalls).toHaveLength(1);
    expect(h.rpcCalls[0].name).toBe("teacher_regen_code");
    expect(h.rpcCalls[0].params).toEqual({ p_student_id: "stud-1", p_new_hash: "b".repeat(64) });   // hash only — never plaintext
  });

  it("NEVER writes any storage — not the device's own recovery key, not the fork flag (D-M5 cross-surface)", async () => {
    // The teacher flow must touch NO storage: not 'lyra-recovery-code' (=== RECOVERY_CODE_KEY in
    // supabase-client.js — the DEVICE's own student-identity key), and not the session fork flag
    // 'lyra-fork-pending'. Writing either from a teacher session would poison the next student session
    // on a shared machine. Assert setItem is never called on EITHER storage (local AND session).
    const localSpy = vi.spyOn(localStorage, "setItem");
    const sessionSpy = vi.spyOn(sessionStorage, "setItem");
    await teacherRegenCode("stud-1");
    expect(localSpy).not.toHaveBeenCalled();
    expect(sessionSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("lyra-recovery-code")).toBeNull();
    expect(sessionStorage.getItem("lyra-fork-pending")).toBeNull();
    localSpy.mockRestore();
    sessionSpy.mockRestore();
  });

  it("no client (flag off) → not-configured, RPC never called", async () => {
    h.client = null;
    expect(await teacherRegenCode("stud-1")).toEqual({ status: "not-configured" });
    expect(h.rpcCalls).toHaveLength(0);
  });

  it("the RPC's ONE non-oracle authz error (P0001) → not-permitted", async () => {
    h.rpcResult = { data: null, error: { code: "P0001", message: "not permitted" } };
    expect(await teacherRegenCode("stud-1")).toEqual({ status: "not-permitted" });
  });

  it("any other RPC error → error; a thrown RPC → error (never throws out)", async () => {
    h.rpcResult = { data: null, error: { code: "XX500" } };
    expect(await teacherRegenCode("stud-1")).toEqual({ status: "error" });
    h.rpcResult = { data: null, error: null }; h.rpcThrow = true;
    expect(await teacherRegenCode("stud-1")).toEqual({ status: "error" });
  });

  it("never logs the minted code (§87/§88) — status only, across ALL console methods", async () => {
    // Broadened past console.info: a future logT change to warn/error/debug must not leak the code either.
    const methods = ["log", "info", "warn", "error", "debug"];
    const spies = methods.map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await teacherRegenCode("stud-1");
    for (const spy of spies) for (const call of spy.mock.calls) expect(call.map(String).join(" ")).not.toContain("TCHR-CODE-1111-2222");
    spies.forEach((s) => s.mockRestore());
  });
});

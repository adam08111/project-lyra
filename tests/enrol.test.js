import { describe, it, expect, vi, beforeEach } from "vitest";

// BRIEF-ENROL — the enrol_student RPC wrapper. The Supabase client is fully mocked (no network);
// the wrapper must return a discriminated result, never throw, normalize the code + sanitize the
// name before the call, and never log the code/name.
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

const h = vi.hoisted(() => ({ client: null, rpcCalls: [], rpcResult: { data: null, error: null }, rpcThrow: false }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => h.client }));

function makeClient() {
  return {
    rpc: (name, params) => {
      h.rpcCalls.push({ name, params });
      if (h.rpcThrow) throw new Error("network down");
      return Promise.resolve(h.rpcResult);
    },
  };
}

import { enrolStudent, sanitizeName, normalizeCode } from "../src/enrol/enrol.js";

beforeEach(() => { h.client = makeClient(); h.rpcCalls = []; h.rpcResult = { data: null, error: null }; h.rpcThrow = false; });

describe("enrol wrapper — enrolStudent", () => {
  it("success: returns the class + teacher, and calls the RPC with a normalized code + sanitized name", async () => {
    h.rpcResult = { data: { class_name: "7B English", teacher_display_name: "Ms Wong" }, error: null };
    const r = await enrolStudent(" 7b-kestrel ", "  Ah" + TAB + "Ming  ");
    expect(r).toEqual({ ok: true, class: { name: "7B English", teacher: "Ms Wong" } });
    expect(h.rpcCalls).toHaveLength(1);
    expect(h.rpcCalls[0].name).toBe("enrol_student");
    expect(h.rpcCalls[0].params).toEqual({ p_class_code: "7B-KESTREL", p_display_name: "AhMing" });
  });

  it("re-enrol is idempotent success (the RPC ON CONFLICT DO NOTHING still returns the class)", async () => {
    h.rpcResult = { data: { class_name: "7B", teacher_display_name: "Ms Wong" }, error: null };
    const r = await enrolStudent("DEMO-CLASS-1", "Ming");
    expect(r.ok).toBe(true);
  });

  it("a rejected RPC (bad/empty code, or no identity) → one non-oracle 'not-recognised' reason", async () => {
    h.rpcResult = { data: null, error: { code: "P0001", message: "code not recognised" } };
    const r = await enrolStudent("NOPE", "Ming");
    expect(r).toEqual({ ok: false, reason: "not-recognised" });
  });

  it("no client (sync off) → 'not-configured', and the RPC is never called", async () => {
    h.client = null;
    const r = await enrolStudent("X", "Y");
    expect(r).toEqual({ ok: false, reason: "not-configured" });
    expect(h.rpcCalls).toHaveLength(0);
  });

  it("a thrown/network failure → 'error' (never throws out)", async () => {
    h.rpcThrow = true;
    const r = await enrolStudent("X", "Y");
    expect(r).toEqual({ ok: false, reason: "error" });
  });

  it("never logs the code or the name (§87/§88) — status codes only", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    h.rpcResult = { data: null, error: { code: "P0001" } };
    await enrolStudent("SECRET-CODE-9", "Secret Student Name");
    for (const call of spy.mock.calls) {
      const flat = call.map(String).join(" ");
      expect(flat).not.toContain("SECRET-CODE-9");
      expect(flat).not.toContain("Secret Student Name");
    }
    spy.mockRestore();
  });
});

describe("enrol wrapper — sanitize/normalize (mirror the server law)", () => {
  it("sanitizeName strips control chars, collapses whitespace, trims, caps 40, is null-safe", () => {
    expect(sanitizeName("  Ah  Ming  ")).toBe("Ah Ming");
    expect(sanitizeName("Ann" + TAB + "ie")).toBe("Annie");   // a control char is removed
    expect(sanitizeName("a" + NUL + "b")).toBe("ab");         // NUL byte removed
    expect(sanitizeName("x".repeat(60)).length).toBe(40);
    expect(sanitizeName(null)).toBe("");
    expect(sanitizeName(undefined)).toBe("");
  });

  it("normalizeCode trims + uppercases, is null-safe", () => {
    expect(normalizeCode(" 7b-kestrel ")).toBe("7B-KESTREL");
    expect(normalizeCode(null)).toBe("");
  });
});

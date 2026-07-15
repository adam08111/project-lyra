// @vitest-environment happy-dom
//
// BRIEF-112 — the recovery lib. Supabase client + the shared code generator/hash are mocked (no
// network, no crypto). Proves: currentCode reads the SAME key the mint/claim write; regenerate
// mints → hashes → RPC → persists → returns, is never-stuck, and never logs the code; claim wraps
// window.lyraSync.claim and null-guards when it is absent (§109 teacher/flag-off/boot).
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ client: null, rpcCalls: [], rpcResult: { data: null, error: null }, rpcThrow: false }));

vi.mock("../src/supabase-client.js", () => ({
  getSupabase: () => h.client,
  generateRecoveryCode: () => "NEWC-ODE1-2345-6789",
  sha256Hex: async () => "a".repeat(64),
  RECOVERY_CODE_KEY: "lyra-recovery-code",
}));

function makeClient() {
  return {
    rpc: (name, params) => {
      h.rpcCalls.push({ name, params });
      if (h.rpcThrow) throw new Error("network down");
      return Promise.resolve(h.rpcResult);
    },
  };
}

import { currentCode, regenerate, claim } from "../src/recovery/recovery.js";

beforeEach(() => {
  h.client = makeClient(); h.rpcCalls = []; h.rpcResult = { data: null, error: null }; h.rpcThrow = false;
  localStorage.clear();
  delete window.lyraSync;
});

describe("recovery lib — currentCode", () => {
  it("returns the code under the shared key, or '' when absent", () => {
    expect(currentCode()).toBe("");
    localStorage.setItem("lyra-recovery-code", "WOLF-2931-ABCD-EFGH");
    expect(currentCode()).toBe("WOLF-2931-ABCD-EFGH");
  });
});

describe("recovery lib — regenerate", () => {
  it("mints a new code, calls the RPC with ONLY its hash, persists the new plaintext, returns it", async () => {
    localStorage.setItem("lyra-recovery-code", "OLD-CODE");
    const out = await regenerate();
    expect(out).toBe("NEWC-ODE1-2345-6789");
    expect(h.rpcCalls).toHaveLength(1);
    expect(h.rpcCalls[0].name).toBe("regenerate_recovery_code");
    expect(h.rpcCalls[0].params).toEqual({ p_new_hash: "a".repeat(64) });   // hash only — never the plaintext
    expect(localStorage.getItem("lyra-recovery-code")).toBe("NEWC-ODE1-2345-6789");
  });

  it("on RPC error → null, and the old code is left untouched (never-stuck)", async () => {
    localStorage.setItem("lyra-recovery-code", "OLD-CODE");
    h.rpcResult = { data: null, error: { code: "P0001" } };
    expect(await regenerate()).toBeNull();
    expect(localStorage.getItem("lyra-recovery-code")).toBe("OLD-CODE");
  });

  it("no client (sync off) → null, RPC never called", async () => {
    h.client = null;
    expect(await regenerate()).toBeNull();
    expect(h.rpcCalls).toHaveLength(0);
  });

  it("a thrown RPC → null (never throws out)", async () => {
    h.rpcThrow = true;
    expect(await regenerate()).toBeNull();
  });

  it("never logs the new code (§87/§88) — status only", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await regenerate();
    for (const call of spy.mock.calls) {
      expect(call.map(String).join(" ")).not.toContain("NEWC-ODE1-2345-6789");
    }
    spy.mockRestore();
  });
});

describe("recovery lib — claim", () => {
  it("wraps window.lyraSync.claim and returns its result", async () => {
    const claimFn = vi.fn().mockResolvedValue(true);
    window.lyraSync = { claim: claimFn };
    expect(await claim("WOLF-2931")).toBe(true);
    expect(claimFn).toHaveBeenCalledWith("WOLF-2931");
  });

  it("null-guards when lyraSync.claim is absent (§109 teacher/flag-off/boot) → false, no throw", async () => {
    delete window.lyraSync;
    expect(await claim("WOLF-2931")).toBe(false);
    window.lyraSync = { status: () => ({ enabled: true, nonAnonymousSession: true }) };  // §109 shim: no claim
    expect(await claim("WOLF-2931")).toBe(false);
  });
});

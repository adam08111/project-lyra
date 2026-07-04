import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §99 D3 recovery. Mock the SDK so createClient returns a client with a controllable rpc.
const h = vi.hoisted(() => ({ rpc: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: (name, args) => h.rpc(name, args) }),
}));

function makeStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { s = {}; },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
  globalThis.localStorage = makeStorage();
});
afterEach(() => { vi.unstubAllEnvs(); delete globalThis.localStorage; });

describe("claimStudent (§99 D3)", () => {
  it("true: normalizes (trim+upper), drops the hint, stores the code, returns true", async () => {
    let seen;
    h.rpc = (name, args) => { seen = { name, args }; return Promise.resolve({ data: true, error: null }); };
    localStorage.setItem("lyra-sb-student-id", "old-student");
    const { claimStudent } = await import("../src/supabase-client.js");
    const ok = await claimStudent("  zjky-vxvz-fqah-twr7 ");
    expect(ok).toBe(true);
    expect(seen).toEqual({ name: "claim_student", args: { p_code: "ZJKY-VXVZ-FQAH-TWR7" } });
    expect(localStorage.getItem("lyra-sb-student-id")).toBe(null);        // stale hint dropped
    expect(localStorage.getItem("lyra-recovery-code")).toBe("ZJKY-VXVZ-FQAH-TWR7");
  });

  it("false (bad code): returns false, NO state change", async () => {
    h.rpc = () => Promise.resolve({ data: false, error: null });
    localStorage.setItem("lyra-sb-student-id", "old-student");
    const { claimStudent } = await import("../src/supabase-client.js");
    expect(await claimStudent("WRONG-CODE")).toBe(false);
    expect(localStorage.getItem("lyra-sb-student-id")).toBe("old-student");
    expect(localStorage.getItem("lyra-recovery-code")).toBe(null);
  });

  it("rpc error: returns false, NO state change", async () => {
    h.rpc = () => Promise.resolve({ data: null, error: { code: "42883" } });
    const { claimStudent } = await import("../src/supabase-client.js");
    expect(await claimStudent("ANY")).toBe(false);
    expect(localStorage.getItem("lyra-recovery-code")).toBe(null);
  });

  it("empty/blank code: returns false WITHOUT calling rpc", async () => {
    let called = false;
    h.rpc = () => { called = true; return Promise.resolve({ data: true, error: null }); };
    const { claimStudent } = await import("../src/supabase-client.js");
    expect(await claimStudent("   ")).toBe(false);
    expect(called).toBe(false);
  });
});

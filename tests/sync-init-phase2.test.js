import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §99 Phase 2 wiring in initSync. Mock every collaborator so we exercise the orchestration
// (identity surfacing, import-pending consumption, claim wiring) with no network.
const h = vi.hoisted(() => ({ backfillCalls: [], flushCalls: 0, studentId: "student-A", claimResult: true, hydrateResult: { hydrated: false } }));
vi.mock("../src/supabase-client.js", () => ({
  getSupabase: () => ({}),
  ensureStudent: () => Promise.resolve({ studentId: h.studentId }),
  claimStudent: () => Promise.resolve(h.claimResult),
  STUDENT_ID_HINT: "lyra-sb-student-id",
}));
vi.mock("../src/hydrate.js", () => ({
  hydrateIfNeeded: () => Promise.resolve(h.hydrateResult),
  HYDRATED_FLAG: "lyra-hydrated-v1",
}));
vi.mock("../src/data-layer.js", () => ({
  backfillIfNeeded: (opts) => { h.backfillCalls.push(opts); return { ran: true }; },
  LEARNING_KEYS: ["grammar-log", "lyra-growth-log", "lyra-skill-deployments", "lyra-structures", "lyra-vocabulary", "lyra-masterclass-reports", "lyra-growth-profile"],
}));
vi.mock("../src/sync-outbox.js", () => ({ flush: () => { h.flushCalls++; } }));

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
  h.backfillCalls = []; h.flushCalls = 0; h.studentId = "student-A"; h.claimResult = true; h.hydrateResult = { hydrated: false };
  globalThis.window = {};
  globalThis.localStorage = makeStorage();
  globalThis.sessionStorage = makeStorage();
});
afterEach(() => { delete globalThis.window; delete globalThis.localStorage; delete globalThis.sessionStorage; });

describe("detectIdentityChanged — pure (§99 D8)", () => {
  it("true ONLY when a differing hint pre-existed", async () => {
    const { detectIdentityChanged } = await import("../src/sync-init.js");
    expect(detectIdentityChanged("A", "B")).toBe(true);
    expect(detectIdentityChanged("A", "A")).toBe(false);
    expect(detectIdentityChanged(null, "B")).toBe(false);
    expect(detectIdentityChanged("A", null)).toBe(false);
  });
});

describe("initSync — Phase 2 wiring (§99)", () => {
  it("import-pending: forces a backfill and is consumed EXACTLY once", async () => {
    localStorage.setItem("lyra-sync-import-pending", "1");
    const { initSync } = await import("../src/sync-init.js");
    await initSync();
    expect(h.backfillCalls[0]).toEqual({ force: true });                 // forced by import
    expect(localStorage.getItem("lyra-sync-import-pending")).toBe(null); // consumed
    h.backfillCalls = [];
    await initSync();                                                     // next boot
    expect(h.backfillCalls[0]).toEqual({ force: false });                // no longer forced
  });

  it("identityChanged (D8): a differing prior hint → console.warn + status flag", async () => {
    localStorage.setItem("lyra-sb-student-id", "old-different");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { initSync } = await import("../src/sync-init.js");
    await initSync();
    expect(window.lyraSync.status().identityChanged).toBe(true);
    expect(warn.mock.calls.map((c) => c[0]).join(" ")).toContain("identity changed");
    warn.mockRestore();
  });

  it("no prior hint → status has no identityChanged", async () => {
    const { initSync } = await import("../src/sync-init.js");
    await initSync();
    expect(window.lyraSync.status()).toEqual({ enabled: true, studentId: "student-A" });
  });

  it("claim() true → clears the hydration guard so the claimed identity re-hydrates", async () => {
    sessionStorage.setItem("lyra-hydrated-v1", "1");
    const { initSync } = await import("../src/sync-init.js");
    await initSync();
    const ok = await window.lyraSync.claim("ZJKY-VXVZ-FQAH-TWR7");
    expect(ok).toBe(true);
    expect(sessionStorage.getItem("lyra-hydrated-v1")).toBe(null);
  });

  it("claim() false → does NOT clear the guard", async () => {
    h.claimResult = false;
    sessionStorage.setItem("lyra-hydrated-v1", "1");
    const { initSync } = await import("../src/sync-init.js");
    await initSync();
    expect(await window.lyraSync.claim("bad")).toBe(false);
    expect(sessionStorage.getItem("lyra-hydrated-v1")).toBe("1");
  });
});

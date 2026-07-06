import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §109 Layer 2 — ensureStudent must REFUSE to resolve/mint a student under a non-anonymous
// session (a teacher signed in on the same browser), protecting every caller. Mock the SDK
// with a controllable session and track sign-in / students-table access.
const h = vi.hoisted(() => ({ session: null, signInAnonCalled: 0, fromCalled: 0, rows: [{ id: "s-existing" }] }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      signInAnonymously: async () => { h.signInAnonCalled++; h.session = { user: { is_anonymous: true } }; return { error: null }; },
    },
    from: () => { h.fromCalled++; return { select: () => ({ limit: async () => ({ data: h.rows, error: null }) }) }; },
  }),
}));

function makeStorage() {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
  h.session = null; h.signInAnonCalled = 0; h.fromCalled = 0; h.rows = [{ id: "s-existing" }];
  globalThis.localStorage = makeStorage();
});
afterEach(() => { vi.unstubAllEnvs(); delete globalThis.localStorage; });

describe("§109 Layer 2 — ensureStudent refuses a non-anonymous session", () => {
  it("non-anonymous session → { nonAnonymous:true }, NO sign-in, NO students query (no mint)", async () => {
    h.session = { user: { is_anonymous: false } };            // a teacher-like session
    const { ensureStudent } = await import("../src/supabase-client.js");
    expect(await ensureStudent()).toEqual({ nonAnonymous: true });
    expect(h.signInAnonCalled).toBe(0);
    expect(h.fromCalled).toBe(0);                              // never touched the students table
  });

  it("session missing is_anonymous → treated as non-anonymous (fail-safe)", async () => {
    h.session = { user: { id: "x" } };                        // no is_anonymous flag at all
    const { ensureStudent } = await import("../src/supabase-client.js");
    expect(await ensureStudent()).toEqual({ nonAnonymous: true });
    expect(h.fromCalled).toBe(0);
  });

  it("anonymous session → proceeds and resolves the existing student (no refusal)", async () => {
    h.session = { user: { is_anonymous: true } };
    const { ensureStudent } = await import("../src/supabase-client.js");
    expect(await ensureStudent()).toEqual({ studentId: "s-existing" });
    expect(h.signInAnonCalled).toBe(0);                       // already had an anon session
  });

  it("no session → signs in anonymously, then resolves (the normal first boot, unchanged)", async () => {
    h.session = null;
    const { ensureStudent } = await import("../src/supabase-client.js");
    expect(await ensureStudent()).toEqual({ studentId: "s-existing" });
    expect(h.signInAnonCalled).toBe(1);
  });
});

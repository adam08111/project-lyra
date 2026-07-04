import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §99 hydration. No network: mock the supabase client behind getSupabase; in-memory
// localStorage/sessionStorage. materialize is pure (injected localReader); hydrateIfNeeded
// is the orchestrator.
const h = vi.hoisted(() => ({ client: null }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => h.client }));

function makeStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { s = {}; },
  };
}
// A chainable stub: learning_events → .select().order().range() ; growth_profiles → .select().limit()
function makeClient({ events = [], profile = null, eventsError = null, profileError = null } = {}) {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve({ data: profile ? [profile] : [], error: profileError }),
    range: (from, to) => Promise.resolve({ data: eventsError ? null : events.slice(from, to + 1), error: eventsError }),
  };
  return { from: () => chain };
}

beforeEach(() => {
  vi.resetModules();
  h.client = null;
  globalThis.localStorage = makeStorage();
  globalThis.sessionStorage = makeStorage();
});
afterEach(() => { delete globalThis.localStorage; delete globalThis.sessionStorage; });

const ev = (type, payload, ts) => ({ type, payload, ts });

describe("materialize — pure (§99)", () => {
  it("shape-fidelity + newest-first: payload verbatim, ts-ascending input reversed", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const events = [
      ev("grammar", { id: "1717000000000_a", date: "1 Jul 2026", phrase: "I are", correction: "I am", chinese: "..." }, "t1"),
      ev("grammar", { id: "1717000000009_b", date: "1 Jul 2026", phrase: "he go", correction: "he goes", chinese: "..." }, "t2"),
    ];
    const map = materialize(events, null, () => null);
    expect(map["grammar-log"]).toEqual([
      { id: "1717000000009_b", date: "1 Jul 2026", phrase: "he go", correction: "he goes", chinese: "..." },
      { id: "1717000000000_a", date: "1 Jul 2026", phrase: "I are", correction: "I am", chinese: "..." },
    ]);
  });

  it("routes all six event types to their native store keys", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const events = [
      ev("grammar", { id: "g" }), ev("growth", { id: "gr" }), ev("skill_deployed", { id: "s" }),
      ev("structure", { id: "st" }), ev("vocabulary", { id: "v" }), ev("report", { id: "r" }),
    ];
    expect(Object.keys(materialize(events, null, () => null)).sort()).toEqual(
      ["grammar-log", "lyra-growth-log", "lyra-masterclass-reports", "lyra-skill-deployments", "lyra-structures", "lyra-vocabulary"].sort()
    );
  });

  it("per-key conservatism: a non-empty local key is NOT overwritten", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const events = [ev("grammar", { id: "g1" }), ev("vocabulary", { id: "v1" })];
    const localReader = (k) => (k === "grammar-log" ? [{ id: "local-existing" }] : null);
    const map = materialize(events, null, localReader);
    expect(map["grammar-log"]).toBeUndefined();          // present locally → skip
    expect(map["lyra-vocabulary"]).toEqual([{ id: "v1" }]); // empty locally → fill
  });

  it("empty local value ([] / {}) counts as absent → fills", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([ev("grammar", { id: "g" })], null, () => [])["grammar-log"]).toEqual([{ id: "g" }]);
  });

  it("skips a store when the remote has no rows for it", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([ev("grammar", { id: "g" })], null, () => null)["lyra-vocabulary"]).toBeUndefined();
  });

  it("profile: writes lyra-growth-profile from the row verbatim, only if absent", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const row = { profile: { level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" }, last_regen_at: "2026-07-01T00:00:00.000Z" };
    expect(materialize([], row, () => null)["lyra-growth-profile"]).toEqual({ level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" });
    expect(materialize([], row, (k) => (k === "lyra-growth-profile" ? { level: 1 } : null))["lyra-growth-profile"]).toBeUndefined();
  });

  it("profile row with null profile → no lyra-growth-profile write", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([], { profile: null, last_regen_at: "x" }, () => null)["lyra-growth-profile"]).toBeUndefined();
  });
});

describe("fetchRemote (§99)", () => {
  it("returns null when sync is disabled", async () => {
    h.client = null;
    const { fetchRemote } = await import("../src/hydrate.js");
    expect(await fetchRemote()).toBe(null);
  });

  it("pages through >500 events (multiple range calls) and accumulates all", async () => {
    const events = Array.from({ length: 750 }, (_, i) => ev("grammar", { id: "g" + i }, "t" + i));
    h.client = makeClient({ events });
    const { fetchRemote } = await import("../src/hydrate.js");
    const r = await fetchRemote();
    expect(r.events).toHaveLength(750); // page1=500 (not <500 → continue) + page2=250 (<500 → stop)
  });

  it("returns null on an events fetch error", async () => {
    h.client = makeClient({ eventsError: { code: "PGRST" } });
    const { fetchRemote } = await import("../src/hydrate.js");
    expect(await fetchRemote()).toBe(null);
  });

  it("returns null on a profile fetch error", async () => {
    h.client = makeClient({ events: [ev("grammar", { id: "g" })], profileError: { code: "PGRST" } });
    const { fetchRemote } = await import("../src/hydrate.js");
    expect(await fetchRemote()).toBe(null);
  });

  it("returns { events, profile } on success", async () => {
    h.client = makeClient({ events: [ev("grammar", { id: "g" })], profile: { profile: { level: 2 }, last_regen_at: "x" } });
    const { fetchRemote } = await import("../src/hydrate.js");
    const r = await fetchRemote();
    expect(r.events).toHaveLength(1);
    expect(r.profile).toEqual({ profile: { level: 2 }, last_regen_at: "x" });
  });
});

describe("hydrateIfNeeded — orchestrator (§99)", () => {
  it("loop-guard: no-op when the session flag is already set", async () => {
    h.client = makeClient({ events: [ev("grammar", { id: "g" })] });
    sessionStorage.setItem("lyra-hydrated-v1", "1");
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    expect((await hydrateIfNeeded()).hydrated).toBe(false);
    expect(localStorage.getItem("grammar-log")).toBe(null);
  });

  it("disabled sync → no-op", async () => {
    h.client = null;
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    expect((await hydrateIfNeeded()).hydrated).toBe(false);
  });

  it("hydrates: writes native newest-first, sets the guard, reports the count", async () => {
    h.client = makeClient({ events: [
      ev("grammar", { id: "1717000000000_a", phrase: "old" }, "t1"),
      ev("grammar", { id: "1717000000009_b", phrase: "new" }, "t2"),
    ] });
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    const r = await hydrateIfNeeded();
    expect(r).toEqual({ hydrated: true, keys: 1 });
    expect(JSON.parse(localStorage.getItem("grammar-log"))).toEqual([
      { id: "1717000000009_b", phrase: "new" }, { id: "1717000000000_a", phrase: "old" },
    ]);
    expect(sessionStorage.getItem("lyra-hydrated-v1")).toBe("1");
  });

  it("nothing qualifies (empty remote) → no write, guard NOT set (a later boot can still hydrate)", async () => {
    h.client = makeClient({ events: [], profile: null });
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    expect((await hydrateIfNeeded()).hydrated).toBe(false);
    expect(sessionStorage.getItem("lyra-hydrated-v1")).toBe(null);
  });
});

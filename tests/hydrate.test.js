import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §99/§101 hydration. No network: mock the supabase client behind getSupabase; mock
// blob-mirror (ALLOW_KEYS + seedLastSent) so hydrate doesn't pull the outbox chain.
// In-memory localStorage/sessionStorage. materialize is pure (injected RAW localReader).
const h = vi.hoisted(() => ({ client: null, seeded: [] }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => h.client }));
vi.mock("../src/blob-mirror.js", () => ({
  ALLOW_KEYS: new Set(["lyra-projects", "lyra-user-name", "lyra-style-skills", "lyra-training-chats", "lyra-training-progress", "lyra-saved-concepts"]),
  seedLastSent: (m) => { h.seeded.push(m); },
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
// learning_events → .select().order().range(); growth_profiles → .select().limit();
// blobs → .select() awaited directly (the chain is thenable, resolving to blobs).
function makeClient({ events = [], profile = null, blobs = [], eventsError = null, profileError = null, blobsError = null } = {}) {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve({ data: profile ? [profile] : [], error: profileError }),
    range: (from, to) => Promise.resolve({ data: eventsError ? null : events.slice(from, to + 1), error: eventsError }),
    then: (resolve) => resolve({ data: blobsError ? null : blobs, error: blobsError }),
  };
  return { from: () => chain };
}

beforeEach(() => {
  vi.resetModules();
  h.client = null;
  h.seeded = [];
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
    const localReader = (k) => (k === "grammar-log" ? '[{"id":"local-existing"}]' : null);
    const map = materialize(events, null, localReader);
    expect(map["grammar-log"]).toBeUndefined();          // present locally → skip
    expect(map["lyra-vocabulary"]).toEqual([{ id: "v1" }]); // empty locally → fill
  });

  it("RAW empty local value (null / '' / '[]' / '{}') counts as absent → fills", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([ev("grammar", { id: "g" })], null, () => "[]")["grammar-log"]).toEqual([{ id: "g" }]);
    expect(materialize([ev("grammar", { id: "g" })], null, () => "")["grammar-log"]).toEqual([{ id: "g" }]);
  });

  it("skips a store when the remote has no rows for it", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([ev("grammar", { id: "g" })], null, () => null)["lyra-vocabulary"]).toBeUndefined();
  });

  it("profile: writes lyra-growth-profile from the row verbatim, only if absent", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const row = { profile: { level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" }, last_regen_at: "2026-07-01T00:00:00.000Z" };
    expect(materialize([], row, () => null)["lyra-growth-profile"]).toEqual({ level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" });
    expect(materialize([], row, (k) => (k === "lyra-growth-profile" ? '{"level":1}' : null))["lyra-growth-profile"]).toBeUndefined();
  });

  it("profile row with null profile → no lyra-growth-profile write", async () => {
    const { materialize } = await import("../src/hydrate.js");
    expect(materialize([], { profile: null, last_regen_at: "x" }, () => null)["lyra-growth-profile"]).toBeUndefined();
  });
});

describe("materialize — blobs, fill-empty-only (§101)", () => {
  it("fills an ALLOW key from a blob row as a RAW STRING; skips DENY keys and '' tombstones", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const blobs = [
      { key: "lyra-projects", value: '[{"id":"w1"}]' },   // ALLOW, non-empty → fill (raw)
      { key: "grammar-log", value: '[{"g":1}]' },         // DENY (Layer 2 owns) → skip
      { key: "lyra-user-name", value: "" },               // tombstone → never hydrate
    ];
    const map = materialize([], null, () => null, blobs);
    expect(map["lyra-projects"]).toBe('[{"id":"w1"}]');   // raw string, NOT re-parsed
    expect(map["grammar-log"]).toBeUndefined();
    expect(map["lyra-user-name"]).toBeUndefined();
  });

  it("fill-empty-only: a non-empty local blob is NOT overwritten", async () => {
    const { materialize } = await import("../src/hydrate.js");
    const blobs = [{ key: "lyra-style-skills", value: "remote" }];
    const localReader = (k) => (k === "lyra-style-skills" ? "local-present" : null);
    expect(materialize([], null, localReader, blobs)["lyra-style-skills"]).toBeUndefined();
  });
});

describe("fetchRemote (§99/§101)", () => {
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
    expect(r.events).toHaveLength(750);
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

  it("returns null on a blobs fetch error", async () => {
    h.client = makeClient({ blobsError: { code: "PGRST" } });
    const { fetchRemote } = await import("../src/hydrate.js");
    expect(await fetchRemote()).toBe(null);
  });

  it("returns { events, profile, blobs } on success", async () => {
    h.client = makeClient({ events: [ev("grammar", { id: "g" })], profile: { profile: { level: 2 }, last_regen_at: "x" }, blobs: [{ key: "lyra-projects", value: "v" }] });
    const { fetchRemote } = await import("../src/hydrate.js");
    const r = await fetchRemote();
    expect(r.events).toHaveLength(1);
    expect(r.profile).toEqual({ profile: { level: 2 }, last_regen_at: "x" });
    expect(r.blobs).toEqual([{ key: "lyra-projects", value: "v" }]);
  });
});

describe("hydrateIfNeeded — orchestrator (§99/§101)", () => {
  it("loop-guard: no-op write when the session flag is set, but RE-SEEDS the churn guard from remote blobs", async () => {
    h.client = makeClient({ events: [ev("grammar", { id: "g" })], blobs: [{ key: "lyra-projects", value: "V" }] });
    sessionStorage.setItem("lyra-hydrated-v1", "1");
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    expect((await hydrateIfNeeded()).hydrated).toBe(false);
    expect(localStorage.getItem("grammar-log")).toBe(null);        // loop guard → no write
    expect(h.seeded).toContainEqual({ "lyra-projects": "V" });     // churn guard re-seeded (§101 review fix)
  });

  it("seeds the churn guard from the fetched blobs on a normal boot", async () => {
    h.client = makeClient({ blobs: [{ key: "lyra-user-name", value: "Alice" }] });
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    await hydrateIfNeeded();
    expect(h.seeded).toContainEqual({ "lyra-user-name": "Alice" });
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

  it("hydrates a blob value RAW (not JSON-re-encoded)", async () => {
    h.client = makeClient({ blobs: [{ key: "lyra-user-name", value: "Alice" }] });
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    const r = await hydrateIfNeeded();
    expect(r.hydrated).toBe(true);
    expect(localStorage.getItem("lyra-user-name")).toBe("Alice"); // raw, not '"Alice"'
  });

  it("nothing qualifies (empty remote) → no write, guard NOT set (a later boot can still hydrate)", async () => {
    h.client = makeClient({ events: [], profile: null, blobs: [] });
    const { hydrateIfNeeded } = await import("../src/hydrate.js");
    expect((await hydrateIfNeeded()).hydrated).toBe(false);
    expect(sessionStorage.getItem("lyra-hydrated-v1")).toBe(null);
  });
});

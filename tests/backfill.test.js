import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §96: backfillIfNeeded sweeps the six local stores + profile into the outbox once (or
// on force). Outbox + Supabase client mocked; in-memory localStorage; no network.
const h = vi.hoisted(() => ({ enqueued: [], sbEnabled: true }));
vi.mock("../src/sync-outbox.js", () => ({
  enqueue: (item) => { h.enqueued.push(item); },
  flush: () => {},
}));
vi.mock("../src/supabase-client.js", () => ({
  getSupabase: () => (h.sbEnabled ? {} : null),
  ensureStudent: () => Promise.resolve({ studentId: "s" }),
}));

function makeLocalStorage() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

const load = () => import("../src/data-layer.js");

beforeEach(() => {
  vi.resetModules();
  h.enqueued = [];
  h.sbEnabled = true;
  globalThis.localStorage = makeLocalStorage();
});
afterEach(() => { delete globalThis.localStorage; });

function seedAll() {
  localStorage.setItem("grammar-log", JSON.stringify([{ id: "1717000000000_a", phrase: "I are", correction: "I am", rule: "SVA" }]));
  localStorage.setItem("lyra-growth-log", JSON.stringify([{ id: "growth_1717000000001_b", before: "x cat", after: "y cat", technique: "Triple" }]));
  localStorage.setItem("lyra-skill-deployments", JSON.stringify([{ id: "deploy_1717000000002_c", skillName: "Start with a Shock", studentApplication: "my hook" }]));
  localStorage.setItem("lyra-structures", JSON.stringify([{ id: "struct_1717000000003_d", name: "Triple" }]));
  localStorage.setItem("lyra-vocabulary", JSON.stringify([{ id: "vocab_1717000000004_e", strong: "meticulous" }]));
  localStorage.setItem("lyra-masterclass-reports", JSON.stringify([{ id: "report_1717000000005_f", after: "polished line", technique: "Analogy" }]));
  localStorage.setItem("lyra-growth-profile", JSON.stringify({ level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" }));
}

describe("backfillIfNeeded (§96)", () => {
  it("sweeps EVERY store + profile into the outbox and sets the flag", async () => {
    const { backfillIfNeeded } = await load();
    seedAll();
    const r = backfillIfNeeded();
    expect(r.ran).toBe(true);
    const events = h.enqueued.filter((x) => x.kind === "event");
    const profiles = h.enqueued.filter((x) => x.kind === "profile");
    expect(events.map((e) => e.payload.type).sort()).toEqual(
      ["grammar", "growth", "report", "skill_deployed", "structure", "vocabulary"]
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0].payload.profile).toEqual({ level: 3, lastRegenAt: "2026-07-01T00:00:00.000Z" });
    expect(profiles[0].payload.last_regen_at).toBe("2026-07-01T00:00:00.000Z");
    expect(localStorage.getItem("lyra-sync-backfill-v1")).toBe("done");
  });

  it("is flag-gated — a second call does NOT re-sweep", async () => {
    const { backfillIfNeeded } = await load();
    seedAll();
    backfillIfNeeded();
    h.enqueued = [];
    const r = backfillIfNeeded();
    expect(r.ran).toBe(false);
    expect(h.enqueued).toHaveLength(0);
  });

  it("force:true re-runs the sweep even with the flag set", async () => {
    const { backfillIfNeeded } = await load();
    seedAll();
    backfillIfNeeded();
    h.enqueued = [];
    const r = backfillIfNeeded({ force: true });
    expect(r.ran).toBe(true);
    expect(h.enqueued.length).toBe(7); // 6 events + 1 profile
  });

  it("NO enqueue and NO flag when sync is disabled (runs for real once enabled)", async () => {
    h.sbEnabled = false;
    const { backfillIfNeeded } = await load();
    seedAll();
    const r = backfillIfNeeded();
    expect(r.ran).toBe(false);
    expect(h.enqueued).toHaveLength(0);
    expect(localStorage.getItem("lyra-sync-backfill-v1")).toBe(null);
  });

  it("handles empty / absent stores without error", async () => {
    const { backfillIfNeeded } = await load();
    const r = backfillIfNeeded(); // nothing seeded
    expect(r.ran).toBe(true);
    expect(h.enqueued).toHaveLength(0);
    expect(localStorage.getItem("lyra-sync-backfill-v1")).toBe("done");
  });
});

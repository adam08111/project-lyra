import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §96: the outbox is exercised with the Supabase client FULLY MOCKED (no network) +
// an in-memory localStorage + fake timers for the debounce/backoff schedule.
const h = vi.hoisted(() => ({
  state: {
    client: null,
    student: { studentId: "stud-1" },
    upsertResult: { error: null },
    rpcResult: { error: null },
    upsertCalls: [],
    rpcCalls: [],
    upsertImpl: null, // optional: return a controllable promise (single-flight test)
  },
}));

vi.mock("../src/supabase-client.js", () => ({
  getSupabase: () => h.state.client,
  ensureStudent: () => Promise.resolve(h.state.student),
}));

function makeClient() {
  return {
    from: () => ({
      upsert: (rows, opts) => {
        h.state.upsertCalls.push({ rows, opts });
        if (h.state.upsertImpl) return h.state.upsertImpl(rows, opts);
        return Promise.resolve(h.state.upsertResult);
      },
    }),
    rpc: (name, params) => {
      h.state.rpcCalls.push({ name, params });
      return Promise.resolve(h.state.rpcResult);
    },
  };
}

function makeLocalStorage() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

const load = () => import("../src/sync-outbox.js");
const readOutbox = () => JSON.parse(globalThis.localStorage.getItem("lyra-sync-outbox") || "[]");
const evt = (i) => ({ kind: "event", payload: { type: "grammar", content_key: `k${i}`, rule: "R", technique: null, topic: "t", ts: "2026-07-04T00:00:00.000Z", payload: { i } } });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  globalThis.localStorage = makeLocalStorage();
  Object.assign(h.state, {
    client: makeClient(),
    student: { studentId: "stud-1" },
    upsertResult: { error: null },
    rpcResult: { error: null },
    upsertCalls: [],
    rpcCalls: [],
    upsertImpl: null,
  });
});
afterEach(() => { vi.useRealTimers(); delete globalThis.localStorage; });

describe("sync-outbox (§96)", () => {
  it("enqueue NO-OPS (writes no key) when sync is disabled", async () => {
    h.state.client = null;
    const { enqueue } = await load();
    enqueue(evt(1));
    expect(globalThis.localStorage.getItem("lyra-sync-outbox")).toBe(null);
  });

  it("enqueue persists {id,kind,payload,qts} — round-trips through localStorage", async () => {
    const { enqueue } = await load();
    enqueue(evt(1));
    const q = readOutbox();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "event", payload: evt(1).payload });
    expect(typeof q[0].id).toBe("string");
    expect(typeof q[0].qts).toBe("number");
  });

  it("caps at 500 and drops the OLDEST", async () => {
    const { enqueue } = await load();
    for (let i = 0; i < 505; i++) enqueue(evt(i));
    const q = readOutbox();
    expect(q).toHaveLength(500);
    expect(q[0].payload.content_key).toBe("k5");     // k0..k4 dropped
    expect(q[499].payload.content_key).toBe("k504");
  });

  it("flush upserts events in 50-row chunks with ON CONFLICT DO NOTHING params + student_id", async () => {
    const { enqueue, flush } = await load();
    for (let i = 0; i < 120; i++) enqueue(evt(i));
    await flush();
    expect(h.state.upsertCalls).toHaveLength(3); // 50 + 50 + 20
    expect(h.state.upsertCalls[0].rows).toHaveLength(50);
    expect(h.state.upsertCalls[2].rows).toHaveLength(20);
    expect(h.state.upsertCalls[0].opts).toEqual({ onConflict: "student_id,type,content_key", ignoreDuplicates: true });
    expect(h.state.upsertCalls[0].rows[0].student_id).toBe("stud-1");
    expect(readOutbox()).toHaveLength(0); // drained on success
  });

  it("flush sends only the NEWEST queued profile via the LWW rpc", async () => {
    const { enqueue, flush } = await load();
    enqueue({ kind: "profile", payload: { profile: { v: 1 }, last_regen_at: "2026-07-01T00:00:00.000Z" } });
    enqueue({ kind: "profile", payload: { profile: { v: 2 }, last_regen_at: "2026-07-02T00:00:00.000Z" } });
    await flush();
    expect(h.state.rpcCalls).toHaveLength(1);
    expect(h.state.rpcCalls[0].name).toBe("upsert_growth_profile");
    expect(h.state.rpcCalls[0].params.p_profile).toEqual({ v: 2 });
    expect(h.state.rpcCalls[0].params.p_last_regen_at).toBe("2026-07-02T00:00:00.000Z");
    expect(readOutbox()).toHaveLength(0);
  });

  it("flush FAILURE keeps the queue (no drain), success on retry drains it", async () => {
    h.state.upsertResult = { error: { code: "XX000" } };
    const { enqueue, flush } = await load();
    enqueue(evt(1));
    await flush();
    expect(readOutbox()).toHaveLength(1); // kept — never lost
    h.state.upsertResult = { error: null };
    await flush();
    expect(readOutbox()).toHaveLength(0); // drained once upstream recovers
  });

  it("backoff schedule after repeated failures is 30s → 2m → 10m (capped)", async () => {
    h.state.upsertResult = { error: { code: "XX000" } };
    const { enqueue } = await load();
    enqueue(evt(1));                            // sets a 3s debounce
    await vi.advanceTimersByTimeAsync(3000);    // debounce fires → fail #1 → backoff 30s
    expect(h.state.upsertCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30000);   // 30s → fail #2 → backoff 2m
    expect(h.state.upsertCalls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(120000);  // 2m → fail #3 → backoff 10m
    expect(h.state.upsertCalls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(600000);  // 10m → fail #4 → backoff 10m (cap)
    expect(h.state.upsertCalls).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(600000);  // still 10m
    expect(h.state.upsertCalls).toHaveLength(5);
    expect(readOutbox()).toHaveLength(1);       // still queued the whole time
  });

  it("is SINGLE-FLIGHT — a second flush during an in-flight one is a no-op", async () => {
    let resolveUpsert;
    h.state.upsertImpl = () => new Promise((r) => { resolveUpsert = () => r({ error: null }); });
    const { enqueue, flush } = await load();
    enqueue(evt(1));
    const p1 = flush();       // enters, hangs on the upsert promise
    const p2 = flush();       // _flushing already true → returns immediately
    await p2;
    expect(h.state.upsertCalls).toHaveLength(1); // only ONE drain started
    resolveUpsert();
    await p1;
    expect(readOutbox()).toHaveLength(0);
  });

  it("flush without an identity keeps the queue and does not upsert", async () => {
    h.state.student = null; // ensureStudent → null
    const { enqueue, flush } = await load();
    enqueue(evt(1));
    await flush();
    expect(h.state.upsertCalls).toHaveLength(0);
    expect(readOutbox()).toHaveLength(1);
  });
});

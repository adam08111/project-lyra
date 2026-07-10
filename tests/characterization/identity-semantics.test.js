import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * IDENTITY-SEMANTICS CHARACTERIZATION (brief §113, landed §111 as tip+1).
 *
 * These tests document why one student identity must not be live on two devices. They are
 * expected to PASS. If you are adding shared accounts / multi-device identity: these must not
 * merely be updated — the sync layer must first be redesigned (recency or merge), and these
 * tests replaced by ones proving the new semantics. See §101, §111, HANDOFF §8.
 *
 * They exercise the REAL shipped modules (blob-mirror sweep/seed, sync-outbox flush, hydrate)
 * with ONLY the Supabase client mocked — a mock "server" (a Map keyed by student_id|key)
 * records blob upserts and answers hydrate's reads. The blob mirror's whole-value upsert on
 * (student_id, key) has NO server-recency guard (unlike the growth-profile LWW RPC), and the
 * churn guard compares local against LAST-SENT, never against server recency — so on one
 * shared student the last SWEEP wins, not the last EDIT. That is what these tests pin.
 * If a test's setup no longer matches the code, that is a behavior change to REPORT, not a
 * test to tweak.
 */

const KEY = "lyra-projects"; // the largest, most irreplaceable blob (writings + their chats)

const h = vi.hoisted(() => ({ server: null, client: null, student: { studentId: "stud-1" } }));

// Only the Supabase client is mocked; every sync/blob code path below is the shipped one.
vi.mock("../../src/supabase-client.js", () => ({
  getSupabase: () => h.client,
  ensureStudent: () => Promise.resolve(h.student),
}));

// A mock Supabase client: blob upserts land in h.server (whole-value, on student_id|key);
// selects answer hydrate's fetch (blobs from the server; no events/profiles in these tests).
function makeClient(server) {
  const make = (table) => {
    const blobRows = () => [...server.entries()].map(([k, v]) => ({ key: k.split("|")[1], value: v }));
    const rows = () => (table === "blobs" ? blobRows() : []); // events/profiles: none here
    const b = {
      select: () => b,
      order: () => b,
      eq: () => b,
      range: () => Promise.resolve({ data: rows(), error: null }),   // learning_events paged fetch
      limit: () => Promise.resolve({ data: rows(), error: null }),   // growth_profiles
      then: (resolve) => resolve({ data: rows(), error: null }),     // blobs select (awaited directly)
      upsert: (row) => {
        if (table === "blobs") server.set(`${row.student_id}|${row.key}`, row.value);
        return Promise.resolve({ error: null });
      },
    };
    return b;
  };
  return { from: make, rpc: () => Promise.resolve({ error: null }) };
}

function makeStorage() {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
}

const srvKey = (key) => `stud-1|${key}`;
const readOutbox = () => JSON.parse(globalThis.localStorage.getItem("lyra-sync-outbox") || "[]");

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  h.server = new Map();
  h.client = makeClient(h.server);
  h.student = { studentId: "stud-1" };
  globalThis.localStorage = makeStorage();
  globalThis.sessionStorage = makeStorage();
});
afterEach(() => { vi.useRealTimers(); delete globalThis.localStorage; delete globalThis.sessionStorage; });

describe("identity semantics (§111) — one student on two devices is unsafe by construction", () => {
  it("LAST-SWEEP-WINS: an older, different blob from device B overwrites device A's newer one", async () => {
    const { sweep, seedLastSent } = await import("../../src/blob-mirror.js");
    const { flush } = await import("../../src/sync-outbox.js");

    // Device A (newer — 3 writings) legitimately mirrors up.
    const VALUE_A = JSON.stringify([{ id: "w1" }, { id: "w2" }, { id: "w3" }]);
    globalThis.localStorage.setItem(KEY, VALUE_A);
    sweep();
    await flush();
    expect(h.server.get(srvKey(KEY))).toBe(VALUE_A); // remote now holds A's newer blob

    // Device B, SAME student: an OLDER, DIFFERENT local blob (2 writings), with last-sent
    // re-seeded from the remote (A) at boot — the exact state hydrate leaves a device in.
    const VALUE_B = JSON.stringify([{ id: "w1" }, { id: "w2" }]);
    globalThis.localStorage.setItem(KEY, VALUE_B);
    seedLastSent({ [KEY]: VALUE_A });
    sweep();        // local(B) hash ≠ last-sent(A) ⇒ a marker is enqueued (churn guard doesn't block it)
    await flush();  // flush reads the LIVE local value → whole-blob upsert on (student_id, key)

    // B's OLDER content clobbered A's newer — last SWEEP wins, not last EDIT. This is why one
    // identity must not be live on two devices until the sync layer gains recency/merge.
    expect(h.server.get(srvKey(KEY))).toBe(VALUE_B);
  });

  it("FILL-EMPTY-ONLY: hydrating a device with non-empty local leaves local untouched and re-seeds last-sent to remote", async () => {
    const { materialize, hydrateIfNeeded } = await import("../../src/hydrate.js");
    const { sweep } = await import("../../src/blob-mirror.js");

    const REMOTE = JSON.stringify([{ id: "r1" }, { id: "r2" }]);
    const LOCAL = JSON.stringify([{ id: "L1" }]); // non-empty AND different from remote
    h.server.set(srvKey(KEY), REMOTE);
    globalThis.localStorage.setItem(KEY, LOCAL);

    // Pure fill-empty-only: a non-empty local key is never in the materialize map.
    const map = materialize([], null, (k) => globalThis.localStorage.getItem(k), [{ key: KEY, value: REMOTE }]);
    expect(map[KEY]).toBeUndefined();

    // Orchestrator: local is left exactly as it was (no overwrite from remote).
    const res = await hydrateIfNeeded();
    expect(res).toEqual({ hydrated: false });
    expect(globalThis.localStorage.getItem(KEY)).toBe(LOCAL); // untouched

    // Re-seed proof: last-sent was seeded to the REMOTE hash — so a local value that now MATCHES
    // remote produces no churn marker (had it not re-seeded, a fresh sweep would enqueue).
    globalThis.localStorage.setItem(KEY, REMOTE);
    sweep();
    expect(readOutbox()).toHaveLength(0);
  });

  it("THE RE-SEED PUSH: the first sweep after that hydrate pushes the older LOCAL over remote", async () => {
    const { hydrateIfNeeded } = await import("../../src/hydrate.js");
    const { sweep } = await import("../../src/blob-mirror.js");
    const { flush } = await import("../../src/sync-outbox.js");

    const REMOTE = JSON.stringify([{ id: "r1" }, { id: "r2" }]); // what the server holds
    const LOCAL = JSON.stringify([{ id: "L1" }]);                // this device's older, different local
    h.server.set(srvKey(KEY), REMOTE);
    globalThis.localStorage.setItem(KEY, LOCAL);

    await hydrateIfNeeded(); // fill-empty-only skips LOCAL, but re-seeds last-sent to REMOTE
    expect(globalThis.localStorage.getItem(KEY)).toBe(LOCAL); // still the older local

    sweep();       // local(LOCAL) hash ≠ last-sent(REMOTE) ⇒ marker
    await flush();  // reads live LOCAL → upserts it over the server's REMOTE

    // The boot re-seed turns fill-empty-only into a silent upload of the OLDER local blob.
    expect(h.server.get(srvKey(KEY))).toBe(LOCAL);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §101 blob-mirror. enqueue is spied (the outbox is mocked); in-memory localStorage; fake
// timers for the 2s debounce. Fresh import per test (resetModules) → fresh module state.
const h = vi.hoisted(() => ({ enqueued: [] }));
vi.mock("../src/sync-outbox.js", () => ({ enqueue: (item) => { h.enqueued.push(item); } }));

function makeLocalStorage() {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
}
const load = () => import("../src/blob-mirror.js");

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); h.enqueued = []; globalThis.localStorage = makeLocalStorage(); });
afterEach(() => { vi.useRealTimers(); delete globalThis.localStorage; });

describe("blob-mirror — classification (§101)", () => {
  it("ALLOW = the 6 irreplaceable content keys; DENY covers Layer-2 + machinery", async () => {
    const { ALLOW_KEYS, DENY_KEYS } = await load();
    expect([...ALLOW_KEYS].sort()).toEqual([
      "lyra-projects", "lyra-saved-concepts", "lyra-style-skills", "lyra-training-chats", "lyra-training-progress", "lyra-user-name",
    ]);
    expect(ALLOW_KEYS.has("grammar-log")).toBe(false);
    expect(DENY_KEYS.has("grammar-log")).toBe(true);          // Layer 2 owns it (flows through the shim)
    expect(DENY_KEYS.has("lyra-growth-profile")).toBe(true);
    expect(DENY_KEYS.has("lyra-backup-v1")).toBe(true);       // machinery
  });
});

describe("blob-mirror — noteWrite / deny-through-shim (§101)", () => {
  it("deny-through-shim: a grammar-log write triggers NO marker (even past the debounce)", async () => {
    const { noteWrite } = await load();
    globalThis.localStorage.setItem("grammar-log", "[1]");
    noteWrite("grammar-log");
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.enqueued).toHaveLength(0);
  });

  it("an ALLOW-key write enqueues one {kind:blob,key} marker after the 2s debounce", async () => {
    const { noteWrite } = await load();
    globalThis.localStorage.setItem("lyra-projects", '[{"id":"w1"}]');
    noteWrite("lyra-projects");
    expect(h.enqueued).toHaveLength(0);                        // still debounced
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.enqueued).toEqual([{ kind: "blob", key: "lyra-projects" }]);
  });

  it("debounce coalesces rapid writes into one marker", async () => {
    const { noteWrite } = await load();
    globalThis.localStorage.setItem("lyra-projects", "a");
    noteWrite("lyra-projects");
    await vi.advanceTimersByTimeAsync(1000);
    globalThis.localStorage.setItem("lyra-projects", "ab");
    noteWrite("lyra-projects");                                // resets the 2s window
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.enqueued).toHaveLength(1);
  });
});

describe("blob-mirror — sweep / seed / guards (§101)", () => {
  it("sweep enqueues a changed ALLOW key, skips it when unchanged", async () => {
    const { sweep } = await load();
    globalThis.localStorage.setItem("lyra-style-skills", "[1]"); // raw-written (no shim)
    sweep();
    expect(h.enqueued).toEqual([{ kind: "blob", key: "lyra-style-skills" }]);
    h.enqueued = [];
    sweep();                                                    // unchanged → nothing
    expect(h.enqueued).toHaveLength(0);
  });

  it("seedLastSent prevents the first sweep re-upserting a value that matches remote", async () => {
    const { sweep, seedLastSent } = await load();
    globalThis.localStorage.setItem("lyra-projects", "V1");
    seedLastSent({ "lyra-projects": "V1" });                    // remote already holds V1
    sweep();
    expect(h.enqueued).toHaveLength(0);                         // churn guard → no marker
    globalThis.localStorage.setItem("lyra-projects", "V2");     // a genuine local change
    sweep();
    expect(h.enqueued).toEqual([{ kind: "blob", key: "lyra-projects" }]);
  });

  it("tombstone: emptying a mirrored key enqueues a marker (flush sends \"\")", async () => {
    const { sweep, seedLastSent } = await load();
    globalThis.localStorage.setItem("lyra-user-name", "Alice");
    seedLastSent({ "lyra-user-name": "Alice" });
    globalThis.localStorage.removeItem("lyra-user-name");       // deleted → tombstone
    sweep();
    expect(h.enqueued).toEqual([{ kind: "blob", key: "lyra-user-name" }]);
  });

  it("D11 size guard: a value > 2MB is skipped (no marker)", async () => {
    const { sweep } = await load();
    globalThis.localStorage.setItem("lyra-projects", "x".repeat(2 * 1024 * 1024 + 1));
    sweep();
    expect(h.enqueued).toHaveLength(0);
  });
});

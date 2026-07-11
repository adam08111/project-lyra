import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// BRIEF-114 — the writing-snapshot EMITTER. enqueue is spied (outbox mocked); getSupabase is
// mocked as the flag; in-memory localStorage; fresh module per test (resetModules) → fresh
// per-writing hash map. No live DB.
const h = vi.hoisted(() => ({ enqueued: [], supa: {} }));
vi.mock("../src/sync-outbox.js", () => ({ enqueue: (item) => { h.enqueued.push(item); } }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => h.supa }));

function makeStorage() {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
}
const setProjects = (projects) => globalThis.localStorage.setItem("lyra-projects", JSON.stringify(projects));
const load = () => import("../src/writing-snapshots.js");

beforeEach(() => { vi.resetModules(); h.enqueued = []; h.supa = {}; globalThis.localStorage = makeStorage(); });
afterEach(() => { delete globalThis.localStorage; });

describe("writing-snapshots emitter (BRIEF-114)", () => {
  it("first capture emits one snapshot per writing (proofread trigger, deleted:false)", async () => {
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "Essay one." }, { id: "w2", draft: "Essay two." }] }]);
    const { captureWritings } = await load();
    captureWritings("proofread");
    expect(h.enqueued).toHaveLength(2);
    expect(h.enqueued[0]).toMatchObject({ kind: "snapshot", payload: { writing_id: "w1", content: "Essay one.", trigger: "proofread", deleted: false } });
    expect(h.enqueued[1].payload).toMatchObject({ writing_id: "w2", content: "Essay two." });
    expect(typeof h.enqueued[0].payload.content_hash).toBe("string");
  });

  it("unchanged writings emit nothing on the next capture (per-writing hash dedup)", async () => {
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "Stable." }] }]);
    const { captureWritings } = await load();
    captureWritings("sweep");
    expect(h.enqueued).toHaveLength(1);
    h.enqueued = [];
    captureWritings("sweep"); // no change
    expect(h.enqueued).toHaveLength(0);
  });

  it("a changed writing emits exactly one new snapshot — only the changed one", async () => {
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "A" }, { id: "w2", draft: "B" }] }]);
    const { captureWritings } = await load();
    captureWritings("sweep"); // baseline: 2
    h.enqueued = [];
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "A" }, { id: "w2", draft: "B — edited" }] }]);
    captureWritings("sweep");
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0].payload).toMatchObject({ writing_id: "w2", content: "B — edited", deleted: false });
  });

  it("a deleted writing emits a tombstone (deleted:true, delete trigger, namespaced hash, empty content)", async () => {
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "Keep" }, { id: "w2", draft: "Gone soon" }] }]);
    const { captureWritings } = await load();
    captureWritings("sweep");
    h.enqueued = [];
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "Keep" }] }]); // w2 removed
    captureWritings("sweep");
    expect(h.enqueued).toHaveLength(1);
    const t = h.enqueued[0].payload;
    expect(t).toMatchObject({ writing_id: "w2", deleted: true, trigger: "delete", content: "" });
    expect(t.content_hash).toMatch(/^deleted:/); // cannot collide with a content snapshot's hash
  });

  it("flattens writings across multiple projects", async () => {
    setProjects([
      { id: "p1", writings: [{ id: "w1", draft: "one" }] },
      { id: "p2", writings: [{ id: "w2", draft: "two" }, { id: "w3", draft: "three" }] },
    ]);
    const { captureWritings } = await load();
    captureWritings("sweep");
    expect(h.enqueued.map((e) => e.payload.writing_id)).toEqual(["w1", "w2", "w3"]);
  });

  it("a >64KB draft is skipped (D-I4) with a counts-only log — no snapshot, no content leak", async () => {
    const big = "x".repeat(64 * 1024 + 1);
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: big }] }]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { captureWritings } = await load();
    captureWritings("sweep");
    expect(h.enqueued).toHaveLength(0);
    const logged = info.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).toContain("skip oversized");
    expect(logged).not.toContain(big); // bytes count only, never the essay
    info.mockRestore();
  });

  it("flag OFF (getSupabase null) → emits nothing anywhere (the D-gate pin)", async () => {
    h.supa = null;
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: "Anything" }] }]);
    const { captureWritings } = await load();
    captureWritings("proofread");
    expect(h.enqueued).toHaveLength(0);
  });

  it("NEVER logs essay content — the content goes to the DB payload, never a log", async () => {
    const secret = "TOP-SECRET-ESSAY-BODY-do-not-log-12345";
    setProjects([{ id: "p1", writings: [{ id: "w1", draft: secret }] }]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { captureWritings } = await load();
    captureWritings("proofread");
    const logged = info.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).not.toContain(secret);
    info.mockRestore();
    expect(h.enqueued[0].payload.content).toBe(secret); // content DOES ride in the payload (→ DB)
  });

  it("malformed lyra-projects → no throw, no emit", async () => {
    globalThis.localStorage.setItem("lyra-projects", "{not json");
    const { captureWritings } = await load();
    expect(() => captureWritings("sweep")).not.toThrow();
    expect(h.enqueued).toHaveLength(0);
  });
});

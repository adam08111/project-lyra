import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashContent } from "../src/content-hash.js";

// BRIEF-RS — the report-snapshot EMITTER. enqueue is spied (outbox mocked); getSupabase is the
// flag; the REAL content-hash is used so the dedup identity (D-K1) is verified for real. No DB.
const h = vi.hoisted(() => ({ enqueued: [], supa: {} }));
vi.mock("../src/sync-outbox.js", () => ({ enqueue: (item) => { h.enqueued.push(item); } }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => h.supa }));

const load = () => import("../src/report-snapshots.js");
const profile = (over = {}) => ({ version: 1, level: { name: "Developing Writer", bandEstimate: "3", trajectory: "rising" }, weaknesses: [{ id: "sva", status: "active" }], ...over });

beforeEach(() => { vi.resetModules(); h.enqueued = []; h.supa = {}; });

describe("report-snapshots emitter (BRIEF-RS)", () => {
  it("emits exactly one report snapshot per capture, with the whole profile + trigger", async () => {
    const p = profile();
    const { captureReport } = await load();
    captureReport(p, "regen");
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0]).toMatchObject({ kind: "report", payload: { report: p, trigger: "regen" } });
    expect(typeof h.enqueued[0].payload.content_hash).toBe("string");
  });

  it("defaults the trigger to 'regen'", async () => {
    const { captureReport } = await load();
    captureReport(profile());
    expect(h.enqueued[0].payload.trigger).toBe("regen");
  });

  it("hashes JSON.stringify(profile) once (D-K1) — identical payload ⇒ identical hash ⇒ a replay is idempotent", async () => {
    const { captureReport } = await load();
    const p1 = profile();
    const p2 = profile();                                  // distinct object, byte-identical content (a replay)
    captureReport(p1);
    captureReport(p2);
    expect(h.enqueued[0].payload.content_hash).toBe(hashContent(JSON.stringify(p1)));
    // Same content → same hash → the server ON CONFLICT drops the replayed row. (A real regen
    // re-stamps lastRegenAt, so it differs and archives — see the next test.)
    expect(h.enqueued[1].payload.content_hash).toBe(h.enqueued[0].payload.content_hash);
  });

  it("a distinct report (e.g. a re-stamped/changed regen) yields a different hash → its own archived row", async () => {
    const { captureReport } = await load();
    captureReport(profile());
    captureReport(profile({ level: { name: "Confident Writer", bandEstimate: "4" } }));
    expect(h.enqueued[1].payload.content_hash).not.toBe(h.enqueued[0].payload.content_hash);
  });

  it("skips an oversized report (>64KB) counts-only, never enqueues it", async () => {
    const { captureReport } = await load();
    captureReport(profile({ blob: "x".repeat(65 * 1024) }));
    expect(h.enqueued).toHaveLength(0);
  });

  it("emits nothing when sync is off (flag pin)", async () => {
    h.supa = null;
    const { captureReport } = await load();
    captureReport(profile());
    expect(h.enqueued).toHaveLength(0);
  });

  it("tolerates a null / non-object profile without throwing or enqueuing", async () => {
    const { captureReport } = await load();
    expect(() => captureReport(null)).not.toThrow();
    expect(() => captureReport("nope")).not.toThrow();
    expect(h.enqueued).toHaveLength(0);
  });

  it("never logs report content (§87/§88) — counts/status only", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { captureReport } = await load();
    captureReport(profile({ secretBand: "TOP-SECRET-BAND-5" }));            // happy path: no log at all
    captureReport(profile({ blob: "x".repeat(65 * 1024), leak: "ESSAY-TEXT" })); // skip path: bytes count only
    for (const call of spy.mock.calls) {
      const flat = call.map(String).join(" ");
      expect(flat).not.toContain("TOP-SECRET-BAND-5");
      expect(flat).not.toContain("ESSAY-TEXT");
    }
    spy.mockRestore();
  });
});

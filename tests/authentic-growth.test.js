import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// localStorage stub installed before import.
const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const {
  isAuthenticGrowth, isMetaGrowthText, syncLearningData, maybeSaveVisibleReport,
  purgeInauthenticGrowthV1,
} = await import("../src/learning-sync.js");

// The EXACT live-bug case (8 Jun card "Hollywood Cliché vs Messy Truth").
const SCREENSHOT_JUNK = {
  before: "Search the web for relevant facts, statistics, or examples I could use in my exam essay.",
  after: "The student understands that creative writing for HKDSE requires sensory imagery and 'messy truth' examples rather than dry statistics.",
  technique_used: "Hollywood Cliché vs Messy Truth",
  why_better: "n/a",
};
const REAL_REWRITE = {
  before: "The weather was very bad.",
  after: "Rain hammered the corrugated rooftops like impatient fingers.",
  technique_used: "Sensory Weather",
  why_better: "shows instead of tells",
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("isAuthenticGrowth — provenance validator", () => {
  it("rejects the exact screenshot junk case", () => {
    // Chips are sent AS user messages, so the chip text IS in studentTexts —
    // the canned check (and the meta check) must reject it anyway.
    expect(isAuthenticGrowth(SCREENSHOT_JUNK, [SCREENSHOT_JUNK.before])).toBe(false);
  });

  it("canned chip before is rejected even with a clean after", () => {
    const g = { ...SCREENSHOT_JUNK, after: "Rain hammered the rooftops." };
    expect(isAuthenticGrowth(g, [g.before])).toBe(false);
  });

  it("meta after is rejected even with an authentic traceable before", () => {
    const g = { before: "The weather was very bad.", after: "The student now understands sensory imagery." };
    expect(isAuthenticGrowth(g, ["The weather was very bad."])).toBe(false);
  });

  it("accepts a real rewrite traceable to studentTexts", () => {
    expect(isAuthenticGrowth(REAL_REWRITE, ["The weather was very bad.", "some other note"])).toBe(true);
  });

  it("fails closed when studentTexts is empty (no provenance, no trophy)", () => {
    expect(isAuthenticGrowth(REAL_REWRITE, [])).toBe(false);
    expect(isAuthenticGrowth(REAL_REWRITE, undefined)).toBe(false);
  });

  it("accepts a ≥0.6 content-word-overlap paraphrase of a studentText", () => {
    const g = { before: "Cafeteria was silent before storm arrived yesterday", after: "The cafeteria held its breath before the storm broke." };
    const studentTexts = ["the cafeteria was completely silent before the storm arrived"];
    expect(isAuthenticGrowth(g, studentTexts)).toBe(true);
  });

  it("rejects after === before (normalized)", () => {
    const g = { before: "The weather was very bad.", after: "the weather was  very bad." };
    expect(isAuthenticGrowth(g, ["The weather was very bad."])).toBe(false);
  });

  it("rejects a paragraph-dump after (>600 chars)", () => {
    const g = { ...REAL_REWRITE, after: "x".repeat(601) };
    expect(isAuthenticGrowth(g, [REAL_REWRITE.before])).toBe(false);
  });
});

describe("syncLearningData — gated write paths", () => {
  it("invalid-only growth ⇒ no report, no pending, no growth-log — but vocabulary still syncs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = {
      type: "learning_sync",
      growth: [SCREENSHOT_JUNK],
      vocabulary_acquired: [{ weak: "bad", strong: "devastating" }],
    };
    const result = syncLearningData(data, { topic: "t", studentTexts: [SCREENSHOT_JUNK.before] });

    expect(result.savedReport).toBe(false);
    expect(localStorage.getItem("lyra-growth-log")).toBeNull();
    expect(localStorage.getItem("lyra-growth-pending")).toBeNull();
    expect(localStorage.getItem("lyra-masterclass-reports")).toBeNull();
    expect(JSON.parse(localStorage.getItem("lyra-vocabulary"))).toHaveLength(1); // unaffected
    expect(warn.mock.calls.map(c => c[0]).join(" ")).toContain("rejected inauthentic growth");
  });

  it("mixed valid+invalid ⇒ only the valid entry logged, the card uses the valid pair", () => {
    const data = { type: "learning_sync", growth: [SCREENSHOT_JUNK, REAL_REWRITE] };
    const result = syncLearningData(data, { topic: "t", studentTexts: ["The weather was very bad."] });

    expect(result.savedReport).toBe(true);
    const log = JSON.parse(localStorage.getItem("lyra-growth-log"));
    expect(log).toHaveLength(1);
    expect(log[0].before).toBe(REAL_REWRITE.before);
    expect(localStorage.getItem("lyra-growth-pending")).toBe("1");
    const reports = JSON.parse(localStorage.getItem("lyra-masterclass-reports"));
    expect(reports).toHaveLength(1);
    expect(reports[0].before).toBe(REAL_REWRITE.before);
    expect(reports[0].after).toBe(REAL_REWRITE.after);
  });
});

describe("maybeSaveVisibleReport — meta After line", () => {
  it("returns null when the extracted After: line is meta-commentary", () => {
    const text = [
      "MASTERCLASS REPORT",
      "1. SKILLS DEPLOYED — you used the technique well.",
      "3. BEFORE & AFTER",
      "Before: Search the web for facts.",
      "After: The student understands that stories beat statistics.",
    ].join("\n");
    expect(maybeSaveVisibleReport(text, { topic: "t" })).toBeNull();
    expect(localStorage.getItem("lyra-masterclass-reports")).toBeNull();
  });
});

describe("purgeInauthenticGrowthV1 — one-time migration", () => {
  const seed = () => {
    localStorage.setItem("lyra-growth-log", JSON.stringify([
      { id: "g1", before: SCREENSHOT_JUNK.before, after: SCREENSHOT_JUNK.after }, // junk (meta after)
      { id: "g2", before: REAL_REWRITE.before, after: REAL_REWRITE.after },       // legit
    ]));
    localStorage.setItem("lyra-masterclass-reports", JSON.stringify([
      { id: "r1", after: SCREENSHOT_JUNK.after, technique: "Hollywood Cliché vs Messy Truth" }, // junk
      { id: "r2", before: REAL_REWRITE.before, after: REAL_REWRITE.after },                     // legit
    ]));
  };

  it("removes junk, keeps legit, sets the flag, snapshots", () => {
    seed();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const snapshot = vi.fn();
    const res = purgeInauthenticGrowthV1({ snapshot });

    expect(res.ran).toBe(true);
    expect(res.removedLog).toBe(1);
    expect(res.removedReports).toBe(1);
    expect(JSON.parse(localStorage.getItem("lyra-growth-log")).map(e => e.id)).toEqual(["g2"]);
    expect(JSON.parse(localStorage.getItem("lyra-masterclass-reports")).map(e => e.id)).toEqual(["r2"]);
    expect(localStorage.getItem("lyra-growth-purge-v1")).toBe("done");
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — second run is a no-op", () => {
    seed();
    vi.spyOn(console, "info").mockImplementation(() => {});
    purgeInauthenticGrowthV1({ snapshot: vi.fn() });
    const logAfterFirst = localStorage.getItem("lyra-growth-log");
    const snapshot2 = vi.fn();
    const res2 = purgeInauthenticGrowthV1({ snapshot: snapshot2 });
    expect(res2.ran).toBe(false);
    expect(localStorage.getItem("lyra-growth-log")).toBe(logAfterFirst);
    expect(snapshot2).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach } from "vitest";

const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { countThreadTurns, loadTrainingChats, TRAINING_CHATS_KEY, mergeExercises } = await import("../src/training-threads.js");

const STORE = {
  skill_1: {
    "0": [{ role: "lyra", text: "hi" }, { role: "student", text: "try" }, { role: "lyra", text: "good" }],
    "2": [{ role: "lyra", text: "hi" }],
  },
};

describe("countThreadTurns — Continue · N badge source", () => {
  it("counts turns for an existing skill+technique thread (numeric idx → string key)", () => {
    expect(countThreadTurns(STORE, "skill_1", 0)).toBe(3);
    expect(countThreadTurns(STORE, "skill_1", 2)).toBe(1);
  });
  it("returns 0 for a technique with no thread", () => {
    expect(countThreadTurns(STORE, "skill_1", 1)).toBe(0);
  });
  it("returns 0 for an unknown skill", () => {
    expect(countThreadTurns(STORE, "skill_other", 0)).toBe(0);
  });
  it("returns 0 on malformed stores", () => {
    expect(countThreadTurns(null, "skill_1", 0)).toBe(0);
    expect(countThreadTurns({ skill_1: { "0": "not an array" } }, "skill_1", 0)).toBe(0);
  });
});

describe("loadTrainingChats", () => {
  beforeEach(() => store.clear());
  it("parses the stored object", () => {
    localStorage.setItem(TRAINING_CHATS_KEY, JSON.stringify(STORE));
    expect(loadTrainingChats().skill_1["0"]).toHaveLength(3);
  });
  it("returns {} on absence or corruption", () => {
    expect(loadTrainingChats()).toEqual({});
    localStorage.setItem(TRAINING_CHATS_KEY, "{corrupt");
    expect(loadTrainingChats()).toEqual({});
    localStorage.setItem(TRAINING_CHATS_KEY, "[1,2]");
    expect(loadTrainingChats()).toEqual({});
  });
});

describe("mergeExercises — sentences persist; only empty slots fill", () => {
  const parsed = (arr) => arr.map((sentence, index) => ({ index, sentence }));

  it("fills every slot on a first generation (prev null)", () => {
    const out = mergeExercises(null, parsed(["A", "B", "C"]), 3);
    expect(out).toEqual(["A", "B", "C"]);
  });

  it("NEVER overwrites a sentence already set (the core bug)", () => {
    // The student is mid-practice on slot 0 = "KEEP". A regeneration returns
    // fresh sentences for all slots — slot 0 must stay "KEEP".
    const out = mergeExercises(["KEEP", null, null], parsed(["NEW0", "NEW1", "NEW2"]), 3);
    expect(out).toEqual(["KEEP", "NEW1", "NEW2"]);
  });

  it("grows to fill new technique slots after Analyse-more, keeping the old ones", () => {
    const out = mergeExercises(["A", "B"], parsed(["x", "x", "C", "D"]), 4);
    expect(out).toEqual(["A", "B", "C", "D"]);
  });

  it("result is always exactly `length` long; out-of-range items ignored", () => {
    const out = mergeExercises(["A"], [{ index: 5, sentence: "oob" }, { index: 1, sentence: "B" }], 2);
    expect(out).toEqual(["A", "B"]);
  });

  it("tolerates malformed parsed input and non-positive length", () => {
    expect(mergeExercises(["A", "B"], null, 2)).toEqual(["A", "B"]);
    expect(mergeExercises(null, parsed(["A"]), 0)).toEqual([]);
  });
});

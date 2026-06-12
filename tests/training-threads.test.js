import { describe, it, expect, beforeEach } from "vitest";

const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { countThreadTurns, loadTrainingChats, TRAINING_CHATS_KEY } = await import("../src/training-threads.js");

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

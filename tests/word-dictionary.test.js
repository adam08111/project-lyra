import { describe, it, expect, beforeEach } from "vitest";

// localStorage stub for the node environment, installed before import.
const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const {
  normWord, isLookableWord, getCachedWord, cacheWord, parseWordJSON, lookupWord,
  DICTIONARY_KEY, DICTIONARY_MAX_ENTRIES,
} = await import("../src/word-dictionary.js");
const { buildWordLookupPrompt } = await import("../src/prompts.js");

const FAKE = JSON.stringify({
  word: "mock", pos_en: "verb", pos_zh: "動詞", zh: "嘲諷",
  meaning_en: "To make fun of someone in an unkind way.",
  meaning_zh: "以不友善的方式取笑別人。",
  example_en: "The older students mocked his new haircut.",
  example_zh: "高年級學生嘲諷他的新髮型。",
});

beforeEach(() => localStorage.clear());

describe("buildWordLookupPrompt", () => {
  it("contains word + sentence, demands JSON-only and the written-Chinese register", () => {
    const p = buildWordLookupPrompt("mock", "The author mocks the fake Hollywood habit.");
    expect(p).toContain('"mock"');
    expect(p).toContain("fake Hollywood habit");
    expect(p).toContain("ONLY valid JSON");
    expect(p).toContain("書面語");
    expect(p).toContain("NEVER Cantonese colloquial");
  });
});

describe("isLookableWord / normWord", () => {
  it("accepts single English words incl. apostrophes/hyphens", () => {
    expect(isLookableWord("mock")).toBe(true);
    expect(isLookableWord("self-aware")).toBe(true);
    expect(isLookableWord("don't")).toBe(true);
  });
  it("rejects phrases, CJK, numbers, single letters", () => {
    expect(isLookableWord("two words")).toBe(false);
    expect(isLookableWord("嘲諷")).toBe(false);
    expect(isLookableWord("a")).toBe(false);
    expect(isLookableWord("42")).toBe(false);
    expect(isLookableWord("")).toBe(false);
  });
  it("normWord strips case and punctuation", () => {
    expect(normWord("Mock,")).toBe("mock");
    expect(normWord("MOCK")).toBe(normWord("mock"));
  });
});

describe("lookupWord — cache before call", () => {
  it("second lookup of the same word does NOT call the AI", async () => {
    let calls = 0;
    const fake = async () => { calls++; return FAKE; };
    const a = await lookupWord({ word: "mock", sentence: "s1" }, { call: fake });
    expect(a.zh).toBe("嘲諷");
    expect(calls).toBe(1);
    const b = await lookupWord({ word: "Mock," }, { call: fake }); // same normWord
    expect(b.zh).toBe("嘲諷");
    expect(calls).toBe(1);
  });

  it("garbage output throws and is NOT cached", async () => {
    await expect(lookupWord({ word: "weird" }, { call: async () => "no json here" })).rejects.toThrow();
    expect(getCachedWord("weird")).toBeNull();
    const ok = await lookupWord({ word: "weird" }, { call: async () => FAKE });
    expect(ok.zh).toBe("嘲諷");
  });
});

describe("parseWordJSON — defensive", () => {
  it("parses fenced and preamble-wrapped JSON", () => {
    expect(parseWordJSON("```json\n" + FAKE + "\n```").zh).toBe("嘲諷");
    expect(parseWordJSON("Sure! Here you go:\n" + FAKE).zh).toBe("嘲諷");
  });
  it("throws on garbage or missing fields", () => {
    expect(() => parseWordJSON("nope")).toThrow();
    expect(() => parseWordJSON('{"a":1}')).toThrow();
  });
});

describe("cache eviction", () => {
  it("drops the oldest entries past the cap", () => {
    const dict = {};
    for (let i = 0; i < DICTIONARY_MAX_ENTRIES; i++) dict[`word${i}`] = { zh: "x", savedAt: 1000 + i, v: 1 };
    localStorage.setItem(DICTIONARY_KEY, JSON.stringify(dict));
    cacheWord("newest", JSON.parse(FAKE));
    const after = JSON.parse(localStorage.getItem(DICTIONARY_KEY));
    expect(Object.keys(after)).toHaveLength(DICTIONARY_MAX_ENTRIES);
    expect(after.word0).toBeUndefined();
    expect(after.newest).toBeDefined();
  });
});

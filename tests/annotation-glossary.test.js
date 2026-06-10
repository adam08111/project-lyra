import { describe, it, expect, beforeEach } from "vitest";

// Minimal localStorage stub for the node test environment — installed BEFORE
// importing the module under test.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const {
  normKey, getCachedExplanation, cacheExplanation, parseExplainJSON,
  explainAnnotation, buildConceptFromExplanation, GLOSSARY_KEY, GLOSSARY_MAX_ENTRIES,
} = await import("../src/annotation-glossary.js");
const { buildAnnotationExplainPrompt } = await import("../src/prompts.js");

const FAKE_JSON = JSON.stringify({
  term_en: "Appositive", term_zh: "同位語",
  what_en: "A renaming phrase next to a noun.", what_zh: "緊貼名詞的補充說明。",
  here_en: "It adds detail without a new sentence.", here_zh: "不用另起一句就補充細節。",
  try_en: "[Name], [who they are], [did something].", try_zh: "[名字]，[身份]，[做了什麼]。",
});

beforeEach(() => store.clear());

describe("buildAnnotationExplainPrompt", () => {
  it("contains the label, phrase, and sentence, and demands JSON-only output", () => {
    const p = buildAnnotationExplainPrompt("appositive", "Mr Smith, the headmaster", "Mr Smith, the headmaster, announced it.", "en");
    expect(p).toContain("appositive");
    expect(p).toContain("Mr Smith, the headmaster");
    expect(p).toContain("announced it");
    expect(p).toContain("ONLY valid JSON");
    expect(p).toContain("繁體中文");
  });

  it("notes the Chinese card context for sourceLang zh", () => {
    expect(buildAnnotationExplainPrompt("同位語", "史密斯先生", "", "zh")).toContain("Traditional Chinese translation card");
  });

  it("demands standard written Chinese, forbidding Cantonese colloquial forms", () => {
    const p = buildAnnotationExplainPrompt("appositive", "x", "y", "en");
    expect(p).toContain("書面語");
    expect(p).toContain("NEVER Cantonese colloquial");
    expect(p).toContain("是 not 係");
  });
});

describe("normKey — case/space/punctuation-insensitive", () => {
  it("normalizes case, whitespace, and punctuation", () => {
    expect(normKey("Ironic  Cliché!", "  He went,  HOME. ")).toBe(normKey("ironic cliché", "he went home"));
  });
  it("keeps CJK characters", () => {
    expect(normKey("同位語", "史密斯先生")).toBe("同位語|史密斯先生");
  });
  it("distinct labels stay distinct", () => {
    expect(normKey("appositive", "x")).not.toBe(normKey("time clause", "x"));
  });
});

describe("explainAnnotation — cache before call", () => {
  it("second request for the same key does NOT call the AI", async () => {
    let calls = 0;
    const fakeCall = async () => { calls++; return FAKE_JSON; };
    const first = await explainAnnotation({ label: "appositive", phrase: "Mr Smith, the headmaster" }, { call: fakeCall });
    expect(first.term_en).toBe("Appositive");
    expect(calls).toBe(1);
    // Different surface punctuation/case — same normKey → cache hit.
    const second = await explainAnnotation({ label: "Appositive", phrase: "mr smith the headmaster" }, { call: fakeCall });
    expect(second.term_en).toBe("Appositive");
    expect(calls).toBe(1);
  });

  it("a stale-version cached entry reads as a miss and is regenerated", async () => {
    // Simulate a v1 (pre-register-fix) entry: cached without the current version.
    const glossary = {};
    glossary[normKey("old label", "old phrase")] = { term_en: "Stale", savedAt: 1, v: 1 };
    localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
    expect(getCachedExplanation("old label", "old phrase")).toBeNull();
    let calls = 0;
    const fresh = await explainAnnotation({ label: "old label", phrase: "old phrase" }, { call: async () => { calls++; return FAKE_JSON; } });
    expect(calls).toBe(1); // refetched despite the stale entry
    expect(fresh.term_en).toBe("Appositive"); // overwrote the stale copy
    expect(getCachedExplanation("old label", "old phrase").term_en).toBe("Appositive");
  });

  it("garbage output throws and is NOT cached", async () => {
    const garbage = async () => "sorry, I cannot help with that";
    await expect(explainAnnotation({ label: "x", phrase: "y" }, { call: garbage })).rejects.toThrow();
    expect(getCachedExplanation("x", "y")).toBeNull();
    // A later good call still works (failure didn't poison the cache).
    const ok = await explainAnnotation({ label: "x", phrase: "y" }, { call: async () => FAKE_JSON });
    expect(ok.term_en).toBe("Appositive");
  });
});

describe("parseExplainJSON — defensive", () => {
  it("parses fenced JSON", () => {
    expect(parseExplainJSON("```json\n" + FAKE_JSON + "\n```").term_en).toBe("Appositive");
  });
  it("parses preamble-wrapped JSON", () => {
    expect(parseExplainJSON("Here is the explanation:\n" + FAKE_JSON + "\nHope that helps!").term_en).toBe("Appositive");
  });
  it("throws on garbage", () => {
    expect(() => parseExplainJSON("not json at all")).toThrow();
  });
  it("throws on JSON missing required fields", () => {
    expect(() => parseExplainJSON('{"hello": "world"}')).toThrow();
  });
});

describe("cache eviction — capped, oldest dropped", () => {
  it("drops the oldest entries by savedAt past the cap", () => {
    const glossary = {};
    for (let i = 0; i < GLOSSARY_MAX_ENTRIES; i++) {
      glossary[`label${i}|phrase`] = { term_en: "T", savedAt: 1000 + i };
    }
    localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
    cacheExplanation("newest", "phrase", JSON.parse(FAKE_JSON));
    const after = JSON.parse(localStorage.getItem(GLOSSARY_KEY));
    expect(Object.keys(after)).toHaveLength(GLOSSARY_MAX_ENTRIES);
    expect(after["label0|phrase"]).toBeUndefined(); // oldest evicted
    expect(after[normKey("newest", "phrase")]).toBeDefined();
    expect(after[`label${GLOSSARY_MAX_ENTRIES - 1}|phrase`]).toBeDefined();
  });
});

describe("buildConceptFromExplanation — conforms to the saved-concepts shape", () => {
  it("produces every field of the existing record shape, bilingual", () => {
    const entry = { ...JSON.parse(FAKE_JSON), label: "appositive", phrase: "Mr Smith, the headmaster" };
    const concept = buildConceptFromExplanation(entry, { phrase: "Mr Smith, the headmaster", sentence: "Mr Smith, the headmaster, announced it.", sectionTitle: "SENTENCE PATTERNS" });
    for (const field of ["name", "grammar", "function", "useIt", "example", "section", "savedAt"]) {
      expect(concept).toHaveProperty(field);
    }
    expect(concept.name).toBe("Appositive — 同位語");
    expect(concept.grammar).toContain("renaming phrase");
    expect(concept.grammar).toContain("補充說明");
    expect(concept.useIt).toContain("[Name]");
    expect(concept.example).toContain("Mr Smith, the headmaster");
    expect(concept.section).toBe("SENTENCE PATTERNS");
    expect(typeof concept.savedAt).toBe("number");
  });
});

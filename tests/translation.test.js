import { describe, it, expect } from "vitest";
import { parseTranslationPairs, groupPairsBySource } from "../src/components/XRayView.jsx";
import { TRANSLATE_SCHEMA, translatePrompt } from "../src/prompts.js";

describe("parseTranslationPairs (JSON output — preferred path)", () => {
  it("parses a clean JSON array of {en, zh} pairs", () => {
    const json = JSON.stringify([
      { en: "The city breathes differently at night.", zh: "城市在夜晚的呼吸方式不一樣。" },
      { en: "Darkness peels back a second skin.", zh: "黑暗揭開了第二層皮膚。" },
    ]);
    const pairs = parseTranslationPairs(json);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({
      en: "The city breathes differently at night.",
      zh: "城市在夜晚的呼吸方式不一樣。",
    });
    expect(pairs[1].zh).toBe("黑暗揭開了第二層皮膚。");
  });

  it("strips a leading ```json code fence and trailing fence", () => {
    const fenced = "```json\n" +
      JSON.stringify([{ en: "Hello.", zh: "你好。" }]) +
      "\n```";
    const pairs = parseTranslationPairs(fenced);
    expect(pairs).toEqual([{ en: "Hello.", zh: "你好。" }]);
  });

  it("ignores prose preamble around the JSON array", () => {
    const noisy = 'Here is the translation: [{"en":"Cat.","zh":"貓。"}] Done.';
    const pairs = parseTranslationPairs(noisy);
    expect(pairs).toEqual([{ en: "Cat.", zh: "貓。" }]);
  });

  it("hides DIFFICULTY entries on the EN side", () => {
    const json = JSON.stringify([
      { en: "DIFFICULTY: Advanced", zh: "難度：高級" },
      { en: "KEY IDEA: The author opens with irony.", zh: "重點：作者以反諷開場。" },
    ]);
    const pairs = parseTranslationPairs(json);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].en).toMatch(/^KEY IDEA/);
  });

  it("does NOT leak inline 'ZH:' markers (the original bug)", () => {
    // Even if the model packs both languages into a single object, the JSON
    // shape keeps zh fenced — there is no way for a 'ZH:' marker to land
    // mid-line of the rendered output.
    const json = JSON.stringify([
      { en: "Sentence one. Sentence two.", zh: "第一句。第二句。" },
    ]);
    const pairs = parseTranslationPairs(json);
    expect(pairs[0].zh).toBe("第一句。第二句。");
    expect(pairs[0].zh).not.toMatch(/ZH\s*[:：]/);
    expect(pairs[0].en).not.toMatch(/ZH\s*[:：]/);
  });

  it("preserves annotation markers {phrase}[label]", () => {
    const json = JSON.stringify([
      { en: "{universally acknowledged}[adverb fronting]", zh: "{眾所公認}[副詞前置]" },
    ]);
    const pairs = parseTranslationPairs(json);
    expect(pairs[0].zh).toBe("{眾所公認}[副詞前置]");
  });
});

describe("parseTranslationPairs (legacy text fallbacks)", () => {
  it("still parses strict 'EN:/ZH:' pair format", () => {
    const text = [
      "EN: The dog barks.",
      "ZH: 狗在叫。",
      "",
      "EN: The cat sleeps.",
      "ZH: 貓在睡覺。",
    ].join("\n");
    const pairs = parseTranslationPairs(text);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ en: "The dog barks.", zh: "狗在叫。" });
    expect(pairs[1]).toEqual({ en: "The cat sleeps.", zh: "貓在睡覺。" });
  });

  it("falls back when JSON parse fails (truncated/invalid)", () => {
    const broken = '[{"en": "Sentence.", "zh": "句子。"';
    // No valid JSON, no EN/ZH markers either — should return empty array,
    // not throw.
    expect(() => parseTranslationPairs(broken)).not.toThrow();
  });

  it("returns [] for null/empty input", () => {
    expect(parseTranslationPairs("")).toEqual([]);
    expect(parseTranslationPairs(null)).toEqual([]);
    expect(parseTranslationPairs(undefined)).toEqual([]);
  });

  it("handles hybrid English-label + Chinese-content format", () => {
    const text = [
      "KEY IDEA: 作者使用反諷手法",
      "FROM THE TEXT: 「這真是個美好的世界」",
    ].join("\n\n");
    const pairs = parseTranslationPairs(text);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some(p => /KEY\s+IDEA/i.test(p.en))).toBe(true);
  });
});

describe("groupPairsBySource", () => {
  const sources = {
    keyIdea: "The author opens with irony.",
    body: "",
    example: "It was the best of times.",
    breakdown: "",
    whyItWorks: "",
    structure: "",
  };

  it("routes labelled pairs to the right buckets", () => {
    const pairs = [
      { en: "KEY IDEA: The author opens with irony.", zh: "作者以反諷開場。" },
      { en: "FROM THE TEXT: It was the best of times.", zh: "文中引述：那是最好的時代。" },
      { en: "WHY IT WORKS: Irony hooks the reader.", zh: "反諷能吸引讀者。" },
    ];
    const grouped = groupPairsBySource(pairs, sources);
    expect(grouped.keyIdea?.[0]?.zh).toMatch(/反諷開場/);
    expect(grouped.example?.[0]?.zh).toMatch(/最好的時代/);
    expect(grouped.whyItWorks?.[0]?.zh).toMatch(/吸引讀者/);
  });

  it("routes WATCH OUT to its own bucket (regression: previously leaked into body)", () => {
    const pairs = [
      { en: "WATCH OUT: Don't overuse irony.", zh: "注意：不要過度使用反諷。" },
    ];
    const grouped = groupPairsBySource(pairs, sources);
    expect(grouped.watchOut).toBeDefined();
    expect(grouped.watchOut[0].zh).toMatch(/不要過度使用反諷/);
  });
});

describe("translatePrompt + TRANSLATE_SCHEMA", () => {
  it("prompt asks for a JSON array (not legacy EN/ZH text)", () => {
    expect(translatePrompt).toMatch(/JSON array/);
    expect(translatePrompt).toMatch(/"en"/);
    expect(translatePrompt).toMatch(/"zh"/);
  });

  it("schema declares an array of {en, zh} objects with both required", () => {
    expect(TRANSLATE_SCHEMA.type).toBe("array");
    expect(TRANSLATE_SCHEMA.items.type).toBe("object");
    expect(TRANSLATE_SCHEMA.items.properties.en.type).toBe("string");
    expect(TRANSLATE_SCHEMA.items.properties.zh.type).toBe("string");
    expect(TRANSLATE_SCHEMA.items.required).toEqual(["en", "zh"]);
  });

  it("prompt still documents the DIFFICULTY-hiding rule", () => {
    expect(translatePrompt).toMatch(/DIFFICULTY/);
  });

  it("prompt still preserves the annotation marker rule", () => {
    expect(translatePrompt).toMatch(/PRESERVE ANNOTATIONS/);
  });
});

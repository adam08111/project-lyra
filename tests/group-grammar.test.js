import { describe, it, expect } from "vitest";
import { groupGrammarByRule } from "../src/utils.js";
import { buildProofreadPrompt } from "../src/prompts.js";

describe("§59 groupGrammarByRule (patterns over instances)", () => {
  it("grouped shape: one rule with N instances stays ONE card with N instances", () => {
    const g = groupGrammarByRule([
      { rule: "Subject-verb agreement", explanation: "x", instances: [{ wrong: "a are", right: "a is" }, { wrong: "b are", right: "b is" }, { wrong: "c are", right: "c is" }] },
    ]);
    expect(g.length).toBe(1);
    expect(g[0].instances.length).toBe(3);
    expect(g[0].rule).toBe("Subject-verb agreement");
  });

  it("flat shape: same-rule entries merge into ONE group (case-insensitive)", () => {
    const g = groupGrammarByRule([
      { rule: "Articles", phrase: "a apple", correction: "an apple", explanation: "use an" },
      { rule: "articles", phrase: "a hour", correction: "an hour" },
    ]);
    expect(g.length).toBe(1);
    expect(g[0].instances.length).toBe(2);
    expect(g[0].explanation).toBe("use an"); // first non-empty kept
  });

  it("ranks groups most-frequent-first", () => {
    const g = groupGrammarByRule([
      { rule: "Tense", phrase: "go", correction: "went" },
      { rule: "Agreement", instances: [{ wrong: "1", right: "1" }, { wrong: "2", right: "2" }, { wrong: "3", right: "3" }] },
      { rule: "Tense", phrase: "eat", correction: "ate" },
    ]);
    expect(g[0].rule).toBe("Agreement"); // 3 instances → first
    expect(g[0].instances.length).toBe(3);
    expect(g[1].rule).toBe("Tense");     // 2 instances
  });

  it("drops empty instances but keeps the group from its real ones", () => {
    const g = groupGrammarByRule([
      { rule: "Prepositions", instances: [{ wrong: "", right: "" }, { wrong: "in", right: "on" }] },
    ]);
    expect(g[0].instances.length).toBe(1);
    expect(g[0].instances[0]).toEqual({ wrong: "in", right: "on" });
  });

  it("drops a group that has NO real instances (Lite truncated the wrong→right pairs)", () => {
    // A rule header with no usable instance must NOT become a hollow "0 places"
    // card or a blank Grammar-Log row — it is dropped entirely.
    expect(groupGrammarByRule([{ rule: "Tense", explanation: "Use past tense." }])).toEqual([]);
    expect(groupGrammarByRule([
      { rule: "Spelling", explanation: "x", example_wrong: "a", example_correct: "b", instances: [{ wrong: "", right: "" }] },
    ])).toEqual([]);
    // A real group survives; the empty one beside it is removed.
    const g = groupGrammarByRule([
      { rule: "Tense", explanation: "Use past tense." },                       // empty → dropped
      { rule: "Articles", instances: [{ wrong: "a apple", right: "an apple" }] }, // real → kept
    ]);
    expect(g.length).toBe(1);
    expect(g[0].rule).toBe("Articles");
  });

  it("is safe on empty / non-array", () => {
    expect(groupGrammarByRule([])).toEqual([]);
    expect(groupGrammarByRule(undefined)).toEqual([]);
    expect(groupGrammarByRule(null)).toEqual([]);
  });
});

describe("§59 buildProofreadPrompt — cap raised + grouped", () => {
  const p = buildProofreadPrompt("topic", "Exam Essay", [], null, null);
  it("caps at ~100 as a CEILING (not a target), no-fabrication preserved", () => {
    expect(p).toMatch(/up to 100/);
    expect(p).toMatch(/CEILING, not a target/);
    expect(p).toMatch(/NO FABRICATION/); // §58 rule still present via PROOFREAD_JUDGMENT_RULES
  });
  it("asks for grouped-by-rule output (instances, ranked by frequency)", () => {
    expect(p).toMatch(/GROUP grammar issues BY RULE/);
    expect(p).toMatch(/"instances"/);
    expect(p).toMatch(/MOST-FREQUENT-FIRST/);
  });
});

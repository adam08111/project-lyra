import { describe, it, expect } from "vitest";
import {
  normGrowthText,
  grammarKey,
  skillKey,
  growthKey,
  structureKey,
  vocabKey,
  reportKey,
} from "../src/content-keys.js";

// §95: these compute the dedup identities shared by localStorage AND (Phase 1) the
// Supabase `unique(student_id, type, content_key)`. The outputs must stay byte-identical
// to the inline versions learning-sync.js used — these tests pin each function's exact
// string, case-folding, whitespace handling, and empty/undefined behaviour.

describe("normGrowthText — lowercase, collapse whitespace, trim", () => {
  it("lowercases, collapses runs of whitespace to one space, and trims", () => {
    expect(normGrowthText("  The   QUICK\tbrown\nfox  ")).toBe("the quick brown fox");
  });
  it("returns '' for empty / undefined / null", () => {
    expect(normGrowthText("")).toBe("");
    expect(normGrowthText(undefined)).toBe("");
    expect(normGrowthText(null)).toBe("");
  });
  it("is idempotent on already-normalized text", () => {
    expect(normGrowthText("a clean sentence")).toBe("a clean sentence");
  });
});

describe("grammarKey — phrase|correction, case-folded", () => {
  it("joins lowercased phrase and correction with a pipe", () => {
    expect(grammarKey({ phrase: "I Are", correction: "I Am" })).toBe("i are|i am");
  });
  it("treats missing fields as empty strings", () => {
    expect(grammarKey({})).toBe("|");
    expect(grammarKey({ phrase: "Only" })).toBe("only|");
    expect(grammarKey({ correction: "Only" })).toBe("|only");
  });
  it("does NOT collapse internal whitespace (only case-folds)", () => {
    expect(grammarKey({ phrase: "a  b", correction: "c" })).toBe("a  b|c");
  });
});

describe("skillKey — skillName|studentApplication, case-folded", () => {
  it("joins lowercased skillName and studentApplication with a pipe", () => {
    expect(skillKey({ skillName: "Start With A Shock", studentApplication: "My Opening" }))
      .toBe("start with a shock|my opening");
  });
  it("treats missing fields as empty strings", () => {
    expect(skillKey({})).toBe("|");
    expect(skillKey({ skillName: "X" })).toBe("x|");
  });
});

describe("growthKey — normGrowthText(before)|normGrowthText(after)", () => {
  it("normalizes both sides and joins with a pipe", () => {
    expect(growthKey({ before: "  The  Cat ", after: "A\tSleek Cat" })).toBe("the cat|a sleek cat");
  });
  it("treats missing sides as empty strings", () => {
    expect(growthKey({})).toBe("|");
    expect(growthKey({ before: "Only Before" })).toBe("only before|");
  });
});

describe("structureKey / vocabKey / reportKey — single-field identities", () => {
  it("structureKey is the name verbatim", () => {
    expect(structureKey({ name: "Triple" })).toBe("Triple");
  });
  it("vocabKey is the strong word verbatim", () => {
    expect(vocabKey({ strong: "meticulous" })).toBe("meticulous");
  });
  it("reportKey is the trimmed 'after' sentence", () => {
    expect(reportKey({ after: "  A polished line.  " })).toBe("A polished line.");
    expect(reportKey({})).toBe("");
    expect(reportKey({ after: undefined })).toBe("");
  });
});

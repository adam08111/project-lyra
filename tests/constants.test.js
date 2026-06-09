import { describe, it, expect } from "vitest";
import { COLORS, writingTypes, wordCounts, placeholders, writingPurposes, EXAM_CONVENTIONS, getExamRules, XRAY_SECTION_DEFAULTS, defaultXraySections } from "../src/constants.js";
import { XRAY_ALL_SECTIONS } from "../src/prompts.js";

describe("COLORS", () => {
  it("has all required color keys", () => {
    const requiredKeys = ["bg1", "bg2", "bg3", "card", "border", "text", "muted", "heading", "accent1", "accent2", "green", "red", "amber", "blue", "logoBg1", "logoBg2"];
    for (const key of requiredKeys) {
      expect(COLORS).toHaveProperty(key);
      expect(typeof COLORS[key]).toBe("string");
    }
  });

  it("all color values are valid hex or named colors", () => {
    for (const [key, value] of Object.entries(COLORS)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
    }
  });
});

describe("writingTypes", () => {
  it("has 6 writing types", () => {
    expect(writingTypes).toHaveLength(6);
  });

  it("each type has id, label, and icon", () => {
    for (const wt of writingTypes) {
      expect(wt).toHaveProperty("id");
      expect(wt).toHaveProperty("label");
      expect(wt).toHaveProperty("icon");
      expect(typeof wt.id).toBe("string");
      expect(typeof wt.label).toBe("string");
      expect(typeof wt.icon).toBe("string");
    }
  });

  it("ids are unique", () => {
    const ids = writingTypes.map(wt => wt.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes expected types", () => {
    const ids = writingTypes.map(wt => wt.id);
    expect(ids).toContain("complaint");
    expect(ids).toContain("email");
    expect(ids).toContain("essay");
    expect(ids).toContain("story");
    expect(ids).toContain("report");
    expect(ids).toContain("persuasive");
  });
});

describe("wordCounts", () => {
  it("has 8 options", () => {
    expect(wordCounts).toHaveLength(8);
  });

  it("numbers are in ascending order", () => {
    const nums = wordCounts.filter(x => typeof x === "number");
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it("last option is 600+", () => {
    expect(wordCounts[wordCounts.length - 1]).toBe("600+");
  });
});

describe("placeholders", () => {
  it("has at least 10 placeholders", () => {
    expect(placeholders.length).toBeGreaterThanOrEqual(10);
  });

  it("each starts with e.g.", () => {
    for (const p of placeholders) {
      expect(p).toMatch(/^e\.g\./);
    }
  });
});

describe("writingPurposes", () => {
  it("has 6 purpose options", () => {
    expect(writingPurposes).toHaveLength(6);
  });

  it("each purpose has id, label, and description", () => {
    for (const wp of writingPurposes) {
      expect(wp).toHaveProperty("id");
      expect(wp).toHaveProperty("label");
      expect(wp).toHaveProperty("description");
    }
  });

  it("includes HKDSE, IELTS, personal", () => {
    const ids = writingPurposes.map(wp => wp.id);
    expect(ids).toContain("hkdse");
    expect(ids).toContain("ielts_task2");
    expect(ids).toContain("personal");
  });
});

describe("EXAM_CONVENTIONS", () => {
  it("has conventions for all exam purposes", () => {
    expect(EXAM_CONVENTIONS).toHaveProperty("hkdse");
    expect(EXAM_CONVENTIONS).toHaveProperty("ielts_task2");
    expect(EXAM_CONVENTIONS).toHaveProperty("toefl");
    expect(EXAM_CONVENTIONS).toHaveProperty("cambridge");
  });

  it("HKDSE has essay-specific rules about clear position", () => {
    expect(EXAM_CONVENTIONS.hkdse.essay).toContain("CLEAR position");
  });

  it("IELTS allows showing multiple perspectives", () => {
    expect(EXAM_CONVENTIONS.ielts_task2.essay).toContain("multiple perspectives IS rewarded");
  });
});

describe("getExamRules", () => {
  it("returns empty string for null purpose", () => {
    expect(getExamRules(null, "essay")).toBe("");
  });

  it("returns empty string for unknown purpose", () => {
    expect(getExamRules("unknown_exam", "essay")).toBe("");
  });

  it("returns global + type-specific rules for hkdse essay", () => {
    const rules = getExamRules("hkdse", "essay");
    expect(rules).toContain("HKDSE");
    expect(rules).toContain("CLEAR position");
    expect(rules).toContain("Content, Language, and Organisation");
  });

  it("returns only global rules when type has no specific rules", () => {
    const rules = getExamRules("school", "essay");
    expect(rules).toContain("School Assignment");
    expect(rules).not.toContain("CRITICAL");
  });

  it("returns empty string for personal with no type-specific rules", () => {
    const rules = getExamRules("personal", "essay");
    expect(rules).toContain("Personal Writing");
  });
});

describe("defaultXraySections — task-matched X-Ray section sets", () => {
  it("returns the essay set for the essay writing type", () => {
    expect(defaultXraySections("essay")).toEqual(["HOW THE WRITER PERSUADES", "SENTENCE PATTERNS", "WORD CHOICES"]);
  });

  it("falls back to _default for an unknown or null/undefined type", () => {
    expect(defaultXraySections("nope")).toEqual(XRAY_SECTION_DEFAULTS._default);
    expect(defaultXraySections(null)).toEqual(XRAY_SECTION_DEFAULTS._default);
    expect(defaultXraySections(undefined)).toEqual(XRAY_SECTION_DEFAULTS._default);
  });

  it("has a default set for every writing type id", () => {
    for (const wt of writingTypes) {
      expect(XRAY_SECTION_DEFAULTS).toHaveProperty(wt.id);
    }
  });

  it("every default set is 3 canonical section names", () => {
    for (const key of Object.keys(XRAY_SECTION_DEFAULTS)) {
      const set = XRAY_SECTION_DEFAULTS[key];
      expect(set).toHaveLength(3);
      set.forEach(name => expect(XRAY_ALL_SECTIONS).toContain(name));
    }
  });

  it("never includes WHEN TO USE / SIGNATURE STYLE in any default set", () => {
    for (const key of Object.keys(XRAY_SECTION_DEFAULTS)) {
      expect(XRAY_SECTION_DEFAULTS[key]).not.toContain("WHEN TO USE THIS STYLE");
      expect(XRAY_SECTION_DEFAULTS[key]).not.toContain("SIGNATURE STYLE");
    }
  });
});

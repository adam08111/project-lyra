import { describe, it, expect } from "vitest";
import { COLORS, writingTypes, wordCounts, placeholders } from "../src/constants.js";

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

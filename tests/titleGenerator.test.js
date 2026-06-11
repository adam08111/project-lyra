import { describe, it, expect, beforeEach } from "vitest";
import { generateTitle, topicBrief, migrateTruncatedTitlesV1 } from "../src/titleGenerator.js";

// localStorage stub for the migration tests (node env).
const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

describe("migrateTruncatedTitlesV1 — heal pre-fix truncated titles", () => {
  beforeEach(() => localStorage.clear());

  it("regenerates '...' titles from the full topic, leaves custom titles alone", () => {
    localStorage.setItem("lyra-projects", JSON.stringify([{
      id: "default", name: "My Writings", writings: [
        { id: "w1", title: "Report — Letter to editor about cell phones should be...", topic: "write a letter to editor about cell phones should be fully banned at schools", type: "report" },
        { id: "w2", title: "My custom name", topic: "anything", type: "essay" },
      ],
    }]));
    const healed = migrateTruncatedTitlesV1();
    expect(healed).toBe(1);
    const w = JSON.parse(localStorage.getItem("lyra-projects"))[0].writings;
    expect(w[0].title).toBe("Report — Letter to editor about cell phones should be fully banned at schools");
    expect(w[0].title).not.toContain("...");
    expect(w[1].title).toBe("My custom name");
    expect(localStorage.getItem("lyra-title-detrunc-v1")).toBe("done");
  });

  it("is idempotent — second run is a no-op", () => {
    localStorage.setItem("lyra-projects", JSON.stringify([{ id: "d", writings: [{ id: "w", title: "Essay — something long that was cut...", topic: "something long that was cut short by the old limit", type: "essay" }] }]));
    expect(migrateTruncatedTitlesV1()).toBe(1);
    expect(migrateTruncatedTitlesV1()).toBe(0);
  });
});

describe("topicBrief — canned-welcome echo fix", () => {
  it("drops the instruction verb from the exact screenshot topic", () => {
    const brief = topicBrief("write a letter to editor about cell phones should be fully banned at schools", 120);
    expect(brief).toBe("Letter to editor about cell phones should be fully banned at schools");
    expect(/^write /i.test(brief)).toBe(false);
  });

  it("returns empty for empty/filler-only topics", () => {
    expect(topicBrief("")).toBe("");
    expect(topicBrief("Write a")).toBe("");
  });

  it("respects a custom max length on a word boundary", () => {
    const brief = topicBrief("Write an essay about the history of Hong Kong public transport systems", 30);
    expect(brief.length).toBeLessThanOrEqual(30);
    expect(brief.endsWith("...")).toBe(true);
  });
});

describe("generateTitle", () => {
  it("combines writing type label with topic", () => {
    const result = generateTitle("My neighbour's dog bit me", "complaint");
    expect(result).toBe("Complaint Letter — My neighbour's dog bit me");
  });

  it("strips 'e.g.' prefix from topic", () => {
    const result = generateTitle("e.g. A refund for a concert", "email");
    expect(result).toBe("Formal Business Email — Refund for a concert");
  });

  it("strips 'I want to write' filler", () => {
    const result = generateTitle("I want to write about climate change", "essay");
    expect(result).toBe("Exam Essay — About climate change");
  });

  it("strips 'I need' and chained 'a' filler", () => {
    const result = generateTitle("I need a formal request for refund", "email");
    // "I need " stripped first, then leading "a " stripped by second pass
    expect(result).toBe("Formal Business Email — Formal request for refund");
  });

  it("strips 'A ' article prefix", () => {
    const result = generateTitle("A story about my childhood", "story");
    expect(result).toBe("Story / Narrative — Story about my childhood");
  });

  it("truncates at first period", () => {
    const result = generateTitle("Dogs are dangerous. They bite people. I got bitten.", "report");
    expect(result).toBe("Report — Dogs are dangerous");
  });

  it("keeps a typical full topic intact — no baked-in '...' (title-edit fix)", () => {
    const longTopic = "The extraordinary adventures of a young boy who discovered a mysterious cave behind his grandmothers garden shed";
    const result = generateTitle(longTopic, "story");
    expect(result).toContain("grandmothers garden shed"); // full sentence survives
    expect(result).not.toContain("...");
  });

  it("still guards against pasted-paragraph topics (>200 chars)", () => {
    const pasted = "word ".repeat(80); // ~400 chars
    const result = generateTitle(pasted, "story");
    expect(result.length).toBeLessThanOrEqual(220);
    expect(result).toContain("...");
  });

  it("returns type label only when topic is empty", () => {
    expect(generateTitle("", "complaint")).toBe("Complaint Letter");
    expect(generateTitle("   ", "essay")).toBe("Exam Essay");
  });

  it("returns 'Untitled' when both topic and type are empty", () => {
    expect(generateTitle("", null)).toBe("Untitled");
    expect(generateTitle("", undefined)).toBe("Untitled");
  });

  it("handles topic with only type and no meaningful content", () => {
    const result = generateTitle("A ", "complaint");
    // After stripping "A ", brief is empty → falls back to type label
    expect(result).toBe("Complaint Letter");
  });

  it("replaces newlines with spaces", () => {
    const result = generateTitle("First line\nSecond line\nThird line", "report");
    expect(result).not.toContain("\n");
  });

  it("capitalizes the first letter of the brief", () => {
    const result = generateTitle("small dogs are scary", "essay");
    expect(result).toBe("Exam Essay — Small dogs are scary");
  });

  it("works with OCR-extracted multi-line text", () => {
    const ocrText = "Write an essay about the impact of social media on teenagers\n\nDiscuss at least three points.";
    const result = generateTitle(ocrText, "essay");
    expect(result).toContain("Exam Essay");
    expect(result).toContain("impact of social media");
  });

  it("handles topic without a known type id gracefully", () => {
    const result = generateTitle("My topic here", "unknown_type");
    expect(result).toBe("My topic here");
  });
});

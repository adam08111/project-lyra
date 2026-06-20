import { describe, it, expect } from "vitest";
import { matchesSaved } from "../src/components/StyleLab.jsx";

describe("matchesSaved (§44) — Saved-tab search over English + Chinese", () => {
  it("matches an English substring (case-insensitive)", () => {
    expect(matchesSaved({ name: "refined · 精緻" }, "ref")).toBe(true);
    expect(matchesSaved({ name: "Refined" }, "REF")).toBe(true);
  });

  it("matches a Chinese substring (words carry 中文 in name / meaning_zh)", () => {
    expect(matchesSaved({ name: "refined · 精緻" }, "精緻")).toBe(true);
    expect(matchesSaved({ name: "box", meaning_zh: "盒子" }, "盒子")).toBe(true);
  });

  it("is whitespace-insensitive on the query", () => {
    expect(matchesSaved({ name: "refined" }, "  ref ")).toBe(true);
  });

  it("empty / whitespace / null query → matches everything", () => {
    expect(matchesSaved({ name: "anything" }, "")).toBe(true);
    expect(matchesSaved({ name: "anything" }, "   ")).toBe(true);
    expect(matchesSaved({ name: "anything" }, null)).toBe(true);
  });

  it("searches content fields too (grammar / function), not just the name", () => {
    expect(matchesSaved({ name: "Appositive", grammar: "noun phrase renamer" }, "noun")).toBe(true);
  });

  it("returns false when nothing contains the query", () => {
    expect(matchesSaved({ name: "refined" }, "zzz")).toBe(false);
  });

  it("(§47/Unit 2) finds a concept by its persisted Chinese label (name_zh)", () => {
    const concept = { name: "participial phrase", name_zh: "分詞短語", grammar: "a clause acting as an adjective" };
    expect(matchesSaved(concept, "分詞短語")).toBe(true);   // Chinese search now symmetric
    expect(matchesSaved(concept, "participial")).toBe(true); // English still works
  });

  it("(§47/Unit 2) a legacy concept without name_zh doesn't crash and stays English-searchable", () => {
    const legacy = { name: "appositive", grammar: "noun phrase renamer" };
    expect(matchesSaved(legacy, "appositive")).toBe(true);
    expect(matchesSaved(legacy, "分詞短語")).toBe(false);
  });
});

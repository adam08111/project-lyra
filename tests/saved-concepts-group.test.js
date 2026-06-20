import { describe, it, expect } from "vitest";
import { groupConceptsByCategory } from "../src/components/StyleLab.jsx";

const CANON = ["COMPARING AND DESCRIBING", "SENTENCE PATTERNS", "WORD CHOICES"];

describe("groupConceptsByCategory (§44) — Saved tab concepts grouped by X-Ray category", () => {
  it("groups by the section label", () => {
    const { groups } = groupConceptsByCategory([
      { name: "Appositive", section: "SENTENCE PATTERNS" },
      { name: "Simile", section: "COMPARING AND DESCRIBING" },
      { name: "Cleft", section: "SENTENCE PATTERNS" },
    ], CANON);
    expect(groups["SENTENCE PATTERNS"].map(c => c.name)).toEqual(expect.arrayContaining(["Appositive", "Cleft"]));
    expect(groups["COMPARING AND DESCRIBING"].map(c => c.name)).toEqual(["Simile"]);
  });

  it("concepts with no/blank section go to 'Other', listed last", () => {
    const { groups, order } = groupConceptsByCategory([{ name: "x" }, { name: "y", section: "  " }], CANON);
    expect(groups.Other.map(c => c.name)).toEqual(expect.arrayContaining(["x", "y"]));
    expect(order[order.length - 1]).toBe("Other");
  });

  it("orders canonical sections first (canonical order), then 'Other' last", () => {
    const { order } = groupConceptsByCategory([
      { name: "a", section: "SENTENCE PATTERNS" },
      { name: "b", section: "COMPARING AND DESCRIBING" },
      { name: "c" },
    ], CANON);
    expect(order).toEqual(["COMPARING AND DESCRIBING", "SENTENCE PATTERNS", "Other"]);
  });

  it("non-canonical labels sort alphabetically after canonical ones, before Other", () => {
    const { order } = groupConceptsByCategory([
      { name: "a", section: "SENTENCE PATTERNS" },
      { name: "z", section: "Zebra annotation" },
      { name: "m", section: "Apple annotation" },
      { name: "o" },
    ], CANON);
    expect(order).toEqual(["SENTENCE PATTERNS", "Apple annotation", "Zebra annotation", "Other"]);
  });

  it("newest-first within a group (savedAt desc)", () => {
    const { groups } = groupConceptsByCategory([
      { name: "old", section: "WORD CHOICES", savedAt: 1 },
      { name: "new", section: "WORD CHOICES", savedAt: 3 },
      { name: "mid", section: "WORD CHOICES", savedAt: 2 },
    ], CANON);
    expect(groups["WORD CHOICES"].map(c => c.name)).toEqual(["new", "mid", "old"]);
  });

  it("empty input → no groups and an empty order", () => {
    const { groups, order } = groupConceptsByCategory([], CANON);
    expect(Object.keys(groups).length).toBe(0);
    expect(order).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { bucketWordsByLetter } from "../src/components/StyleLab.jsx";

describe("bucketWordsByLetter (§44) — A–Z index over the Saved tab's WORDS", () => {
  it("buckets by first letter, case-insensitively", () => {
    const { buckets, letters } = bucketWordsByLetter([{ name: "Refined" }, { name: "refined" }, { name: "Bold" }]);
    expect(buckets.R.length).toBe(2);
    expect(buckets.R.map(w => w.name)).toEqual(expect.arrayContaining(["Refined", "refined"]));
    expect(buckets.B.map(w => w.name)).toEqual(["Bold"]);
    expect(letters.has("R")).toBe(true);
    expect(letters.has("B")).toBe(true);
    expect(letters.has("A")).toBe(false);
  });

  it("trims leading whitespace for the bucket key, leaving the word itself untouched", () => {
    const { buckets } = bucketWordsByLetter([{ name: "  apple" }]);
    expect(buckets.A.length).toBe(1);
    expect(buckets.A[0].name).toBe("  apple"); // bucketed under A, original name preserved
  });

  it("routes non-letter first chars (digit, CJK, punctuation, empty, missing) to '#' — nothing dropped", () => {
    const { buckets, letters } = bucketWordsByLetter([{ name: "123" }, { name: "中文 · zh" }, { name: "!hi" }, { name: "" }, {}]);
    expect(buckets["#"].length).toBe(5);
    expect(letters.has("#")).toBe(true);
  });

  it("empty input → all buckets empty and an empty non-empty-letter set", () => {
    const { buckets, letters } = bucketWordsByLetter([]);
    expect(Object.values(buckets).every(b => b.length === 0)).toBe(true);
    expect(letters.size).toBe(0);
  });

  it("orders each bucket newest-first (savedAt desc)", () => {
    const { buckets } = bucketWordsByLetter([
      { name: "apt", savedAt: 1 }, { name: "ant", savedAt: 3 }, { name: "axe", savedAt: 2 },
    ]);
    expect(buckets.A.map(w => w.name)).toEqual(["ant", "axe", "apt"]);
  });

  it("the non-empty-letter set marks which chips are enabled vs disabled/greyed", () => {
    const { letters } = bucketWordsByLetter([{ name: "Zebra" }, { name: "zoo" }]);
    expect(letters.has("Z")).toBe(true);  // enabled chip
    expect(letters.has("A")).toBe(false); // disabled / greyed chip
  });
});

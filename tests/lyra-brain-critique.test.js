import { describe, it, expect } from "vitest";
import { LYRA_BRAIN } from "../src/lyra-brain.js";

// The block sits between its own header and the next ═══ header, so we can scope
// dedup checks to its text.
const block = LYRA_BRAIN.split("DIAGNOSTIC CRITIQUE — FULL-RESOLUTION")[1]
  ?.split("ONE FLAWLESS SENTENCE")[0] || "";

describe("LYRA_BRAIN — Diagnostic Critique block", () => {
  it("exists, gated to a substantial-draft critique request", () => {
    expect(LYRA_BRAIN).toContain("DIAGNOSTIC CRITIQUE");
    expect(block).toMatch(/GATE/);
    expect(block).toMatch(/SUBSTANTIAL\s+DRAFT/);
    expect(block).toMatch(/critique \/ marking \/ feedback/);
  });

  it("names all four logic-leap types", () => {
    for (const t of ["MISSING CAUSAL BRIDGE", "SIZE MISMATCH", "STACKED-BUT-DIFFERENT", "TWO TANGLED ARGUMENTS"]) {
      expect(block).toContain(t);
    }
  });

  it("forces sentence-by-sentence coverage (not grouped) + leaps with both directions", () => {
    expect(block).toMatch(/SENTENCE-BY-SENTENCE/);
    expect(block).toMatch(/Do NOT collapse this into a grouped/);   // explicitly bans the failure mode
    expect(block).toMatch(/BUILD THE BRIDGE/);
    expect(block).toMatch(/SHRINK THE CLAIM/);
    expect(block).toMatch(/let the STUDENT choose/);
  });

  it("hard-codes the correction-vs-taste guard with the akin-to example", () => {
    expect(block).toMatch(/CORRECTION vs TASTE/);
    expect(block).toContain("akin to");
    expect(block).toMatch(/Do NOT "correct" "akin to"/);            // the exact mistake both models make
  });

  it("keeps the fix an illustration, not a rewrite, and bans LaTeX arrows", () => {
    expect(block).toMatch(/ILLUSTRATION of the student's OWN intended meaning/);
    expect(block).toMatch(/NEVER a LaTeX/);
    expect(block).toContain("→");
  });

  it("dedups — cross-references the existing rules instead of restating them", () => {
    // the block points back ("apply them, don't restate them") rather than pasting
    // a fresh copy of the never-write-it / warm-register / one-question paragraphs
    expect(block).toMatch(/apply them,\s+don.t restate them/); // tolerant of the line wrap + apostrophe
    // a light bloat guard: the gated block stays well under the size of the whole brain
    expect(block.length).toBeLessThan(LYRA_BRAIN.length * 0.5);
  });
});

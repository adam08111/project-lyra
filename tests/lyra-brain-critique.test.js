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

  it("forces TWO TANGLED ARGUMENTS to be named as a located leap, not deferred to the hand-back (§50 residual)", () => {
    // §50 validation gap: the model named 3 leaps in the logic pass but surfaced
    // the two-tangled split only in the closing hand-back. The type must now be a
    // LOCATED leap (seam) named in the pass, with the hand-back-only path forbidden.
    const tangle = block.split("TWO TANGLED ARGUMENTS")[1]?.split("For EACH leap")[0] || "";
    expect(tangle).toMatch(/SEAM/);
    expect(tangle).toMatch(/name it HERE in this pass/);
    expect(tangle).toMatch(/ONLY in the closing\s+hand-back/);
    // and the silent pre-output gate checks it was named here, not left for the hand-back
    expect(block).toMatch(/TWO TANGLED\s+ARGUMENTS leap NAMED here at the seam/);
  });

  it("scopes ENGLISH-PRIMARY language discipline to the critique — 繁中 as support, never Chinese-only (§52)", () => {
    // §52: the critique is itself an English lesson — reasons / logic / task in
    // simple English; Chinese is a support gloss, never a full restatement or a
    // Chinese-only section (the Chinese-dominant inversion that was observed).
    expect(block).toMatch(/ENGLISH-PRIMARY/);
    expect(block).toMatch(/繁中 AS SUPPORT/);
    expect(block).toMatch(/never a substitute/);
    expect(block).toMatch(/NEVER a Chinese-only reason or section/);
    expect(block).toContain("原形動詞"); // grammar-term pairs stay allowed (support, not substitution)
    expect(block).toMatch(/every reason and section ENGLISH-PRIMARY/); // silent gate enforces it
  });

  it("bans leaking internal scaffolding into the visible reply — phase labels, markdown, S-notation (§54)", () => {
    // §54: the prompt's own phase labels ("Pass A/B"), markdown headers (###), and
    // S7→S9 shorthand were echoed to the student. The block must forbid all of it.
    expect(block).toMatch(/OUTPUT — WHAT THE STUDENT SEES/);
    expect(block).toMatch(/NEVER print the names of these phases or passes/);
    expect(block).toMatch(/renders \*\*bold\*\* but NO other markdown/); // ** renders; headers/LaTeX don't
    expect(block).toMatch(/no LaTeX or math/i);
    expect(block).toMatch(/7th and 9th\s+sentences/);            // plain sentence references are modelled
    expect(block).toMatch(/NEVER expose internal structure, labels, or notation/); // the standing class-closer
    expect(block).toMatch(/no phase\/pass labels/);              // silent gate enforces it
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

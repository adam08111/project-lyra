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

  it("uses no literal A)/B) pass labels — they contradicted the §54 leak ban (§56/C3)", () => {
    expect(block).not.toMatch(/(^|\n)\s*A\)\s/);  // no "A)" section marker the model could echo
    expect(block).not.toMatch(/(^|\n)\s*B\)\s/);  // no "B)" section marker
    expect(block).not.toMatch(/\([AB]\)/);         // no "(A)"/"(B)" cross-references
    // the descriptive section names remain
    expect(block).toMatch(/SENTENCE-BY-SENTENCE/);
    expect(block).toMatch(/LOGIC PASS/);
  });

  it("forces sentence-by-sentence coverage (not grouped) + leaps with both directions", () => {
    expect(block).toMatch(/SENTENCE-BY-SENTENCE/);
    expect(block).toMatch(/Do NOT collapse this into a grouped/);   // explicitly bans the failure mode
    expect(block).toMatch(/BUILD THE BRIDGE/);
    expect(block).toMatch(/SHRINK THE CLAIM/);
    expect(block).toMatch(/let the STUDENT choose/);
  });

  it("§67: MANDATES numbered every-sentence coverage — no sampling, clean sentences marked clean", () => {
    // The §48 sample bug: it said "take the FLAWED sentences", which let the model
    // pick a handful. Now it must number EVERY sentence 1..N and account for each.
    expect(block).toMatch(/EVERY SENTENCE, NUMBERED/);
    expect(block).toMatch(/Number the draft's sentences/);
    expect(block).toMatch(/each gets its own numbered line/);
    expect(block).toMatch(/do NOT sample/);
    expect(block).toMatch(/wrap up early/);                 // the bail-to-logic-pass failure mode
    // clean sentences are explicitly marked, not skipped
    expect(block).toMatch(/A CLEAN sentence/);
    expect(block).toMatch(/this one's fine/);
    // unparseable still flagged-and-asked (gold standard sentence 3)
    expect(block).toMatch(/UNPARSEABLE sentence/);
    // the silent gate now counts lines against the sentence count
    expect(block).toMatch(/count your numbered lines against the draft's sentence count/);
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

import { describe, it, expect } from "vitest";
import { buildProofreadPrompt } from "../src/prompts.js";
import { LYRA_BRAIN } from "../src/lyra-brain.js";
import { PROOFREAD_JUDGMENT_RULES, CORRECTION_VS_TASTE, NO_REWRITE_ILLUSTRATION, NAME_THE_RULE } from "../src/judgment-rules.js";

describe("§58 proofread judgment rules", () => {
  const prompt = buildProofreadPrompt("Is AI good?", "Exam Essay", [], null, "Some exam rules here.");

  it("PROOFREAD_JUDGMENT_RULES carries the judgment anchors", () => {
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/CORRECTION vs TASTE/);
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/Do NOT "correct" "akin to"/);   // the unmistakable anchor
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/NO FABRICATION/);
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/ILLUSTRATION of the student's OWN intended meaning/);
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/FORMALITY-AWARE/);
    expect(PROOFREAD_JUDGMENT_RULES).toMatch(/EXPLAIN THE WHY/);
  });

  it("buildProofreadPrompt prepends the rules and keeps the JSON shape + formality/exam context", () => {
    expect(prompt).toContain(PROOFREAD_JUDGMENT_RULES);             // the §58 judgment block is embedded…
    expect(prompt.startsWith("APOLITICAL — do NOT polish or translate")).toBe(true); // …after the §124 band guard, which gates first
    expect(prompt).toMatch(/Return ONLY a single raw JSON object/); // JSON-shape instruction intact (§57)
    expect(prompt).toMatch(/"grammar":\[/);                         // card shape intact
    expect(prompt).toMatch(/FORMALITY:/);                           // formality context intact
    expect(prompt).toContain("Some exam rules here.");              // exam rules wired through
  });

  it("single source of truth — critique and proofread embed the SAME constants (cannot drift)", () => {
    expect(LYRA_BRAIN).toContain(CORRECTION_VS_TASTE);
    expect(LYRA_BRAIN).toContain(NO_REWRITE_ILLUSTRATION);
    expect(PROOFREAD_JUDGMENT_RULES).toContain(CORRECTION_VS_TASTE);
    expect(PROOFREAD_JUDGMENT_RULES).toContain(NO_REWRITE_ILLUSTRATION);
    // §108 — the rule-naming nudge is ONE shared constant on BOTH correction surfaces.
    expect(LYRA_BRAIN).toContain(NAME_THE_RULE);
    expect(PROOFREAD_JUDGMENT_RULES).toContain(NAME_THE_RULE);
  });

  it("§108 — NAME_THE_RULE demands a specific plain-English rule and bans the generic fallback", () => {
    expect(NAME_THE_RULE).toMatch(/NAME THE SPECIFIC RULE/);
    expect(NAME_THE_RULE).toMatch(/Subject-Verb Agreement/);      // a plain-English example, no jargon
    expect(NAME_THE_RULE).toMatch(/grammar fix/i);                // names the banned fallback explicitly
    expect(NAME_THE_RULE).toMatch(/NEVER a vague catch-all/);
    expect(NAME_THE_RULE).not.toMatch(/collocation|concord|morpheme/i); // stays student-plain (no linguistics jargon)
  });
});

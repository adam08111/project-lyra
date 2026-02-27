import { describe, it, expect } from "vitest";
import { buildCoachPrompt, buildStructuralPrompt, buildProofreadPrompt, ghostPrompt } from "../src/prompts.js";

describe("buildCoachPrompt", () => {
  it("includes topic, type, and word count", () => {
    const result = buildCoachPrompt("climate change", "Persuasive Writing", 300);
    expect(result).toContain("climate change");
    expect(result).toContain("Persuasive Writing");
    expect(result).toContain("300");
  });

  it("includes Socratic teaching rules", () => {
    const result = buildCoachPrompt("dogs", "Story / Narrative", 100);
    expect(result).toContain("NEVER write a full sentence");
    expect(result).toContain("Socratic questions");
  });

  it("includes PEEL framework", () => {
    const result = buildCoachPrompt("anything", "Essay", 200);
    expect(result).toContain("PEEL");
    expect(result).toContain("Point, Evidence, Explanation, Link");
  });
});

describe("ghostPrompt", () => {
  it("specifies 4-9 word continuation", () => {
    expect(ghostPrompt).toContain("4-9 word");
    expect(ghostPrompt).toContain("continuation");
  });

  it("disallows explanations", () => {
    expect(ghostPrompt).toContain("No explanation");
  });
});

describe("buildStructuralPrompt", () => {
  it("flags formality for complaint letters", () => {
    const result = buildStructuralPrompt("bad service", "Complaint Letter");
    expect(result).toContain("FORMAL");
    expect(result).toContain("informal");
  });

  it("allows casual language for stories", () => {
    const result = buildStructuralPrompt("my adventure", "Story / Narrative");
    expect(result).toContain("creative/narrative");
    expect(result).toContain("Casual or conversational language is acceptable");
  });

  it("requests exactly 3 suggestions as JSON", () => {
    const result = buildStructuralPrompt("test", "Essay");
    expect(result).toContain("exactly 3 suggestions");
    expect(result).toContain("valid JSON");
  });

  it("includes meaning preservation rules", () => {
    const result = buildStructuralPrompt("test", "Report");
    expect(result).toContain("EXACT meaning");
    expect(result).toContain("Do NOT add new ideas");
  });

  it("flags formality for all formal types", () => {
    const formalTypes = ["Complaint Letter", "Formal Business Email", "Exam Essay", "Report", "Persuasive Writing"];
    for (const type of formalTypes) {
      const result = buildStructuralPrompt("test", type);
      expect(result).toContain("FORMAL");
    }
  });
});

describe("buildProofreadPrompt", () => {
  it("includes topic and type", () => {
    const result = buildProofreadPrompt("test topic", "Report", []);
    expect(result).toContain("test topic");
    expect(result).toContain("Report");
  });

  it("includes applied suggestions context when provided", () => {
    const applied = [
      { technique: "Relative Clause", original: "The dog barked.", improved: "The dog, which was large, barked." }
    ];
    const result = buildProofreadPrompt("dogs", "Story / Narrative", applied);
    expect(result).toContain("ALREADY APPLIED");
    expect(result).toContain("Relative Clause");
    expect(result).toContain("The dog barked.");
    expect(result).toContain("The dog, which was large, barked.");
  });

  it("omits applied context when empty", () => {
    const result = buildProofreadPrompt("dogs", "Story / Narrative", []);
    expect(result).not.toContain("ALREADY APPLIED");
  });

  it("requests grammar, style, and vocabulary analysis", () => {
    const result = buildProofreadPrompt("test", "Essay", []);
    expect(result).toContain('"grammar"');
    expect(result).toContain('"style"');
    expect(result).toContain('"vocabulary"');
  });

  it("requires example_wrong and example_correct for grammar", () => {
    const result = buildProofreadPrompt("test", "Essay", []);
    expect(result).toContain("example_wrong");
    expect(result).toContain("example_correct");
  });

  it("detects formality correctly for formal types", () => {
    const result = buildProofreadPrompt("test", "Formal Business Email", []);
    expect(result).toContain("FORMAL writing");
  });

  it("detects formality correctly for creative types", () => {
    const result = buildProofreadPrompt("test", "Story / Narrative", []);
    expect(result).toContain("creative/narrative");
  });
});

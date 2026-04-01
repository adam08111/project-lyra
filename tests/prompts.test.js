import { describe, it, expect } from "vitest";
import { buildCoachPrompt, buildStructuralPrompt, buildProofreadPrompt, buildTrainingExercisesPrompt, buildTrainingEvalPrompt, buildTrainingHintPrompt } from "../src/prompts.js";

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

// ghostPrompt was removed from prompts.js in the exam-context patch

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
    expect(result).toContain("Do NOT change the student's position");
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

  it("includes exam rules when provided", () => {
    const rules = "HKDSE ARGUMENTATIVE ESSAY RULES";
    const result = buildProofreadPrompt("test", "Essay", [], null, rules);
    expect(result).toContain("EXAM RULES");
    expect(result).toContain("HKDSE");
  });

  it("omits exam block when no rules", () => {
    const result = buildProofreadPrompt("test", "Essay", []);
    expect(result).not.toContain("EXAM RULES");
  });
});

describe("buildTrainingExercisesPrompt", () => {
  const techniques = [
    { technique: "Short sentences for impact", description: "Use a short sentence after long ones" },
    { technique: "Fronted adverbial", description: "Put a describing phrase at the front" },
  ];

  it("frames sentences as Reporter Voice", () => {
    const result = buildTrainingExercisesPrompt(techniques);
    expect(result).toContain("Reporter Voice");
    expect(result).toContain("Columnist Voice");
  });

  it("includes all technique names", () => {
    const result = buildTrainingExercisesPrompt(techniques);
    expect(result).toContain("Short sentences for impact");
    expect(result).toContain("Fronted adverbial");
  });

  it("requests correct number of sentences", () => {
    const result = buildTrainingExercisesPrompt(techniques);
    expect(result).toContain(`exactly ${techniques.length} sentences`);
  });

  it("requests valid JSON output", () => {
    const result = buildTrainingExercisesPrompt(techniques);
    expect(result).toContain("valid JSON");
  });
});

describe("buildTrainingEvalPrompt", () => {
  const technique = { technique: "Short sentences for impact", description: "Use short sentences after long ones", structure: "Long sentence. Short." };

  it("includes technique and attempt", () => {
    const result = buildTrainingEvalPrompt(technique, "The dog walked slowly.", "The dog walked. Slowly.");
    expect(result).toContain("Short sentences for impact");
    expect(result).toContain("The dog walked slowly.");
    expect(result).toContain("The dog walked. Slowly.");
  });

  it("uses Reporter Voice vs Columnist Voice framework", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt");
    expect(result).toContain("Reporter Voice");
    expect(result).toContain("Columnist Voice");
    expect(result).toContain("VOICE SHIFT");
    expect(result).toContain("EFFECT");
  });

  it("includes student explanation when provided", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt", "I wanted rhythm");
    expect(result).toContain("I wanted rhythm");
    expect(result).toContain("EXPLANATION OF THEIR INTENT");
  });

  it("omits explanation block when not provided", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt");
    expect(result).not.toContain("EXPLANATION OF THEIR INTENT");
  });

  it("omits explanation block when undefined", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt", undefined);
    expect(result).not.toContain("EXPLANATION OF THEIR INTENT");
  });

  it("requests JSON with stars, feedback, strengths, improvement", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt");
    expect(result).toContain('"stars"');
    expect(result).toContain('"feedback"');
    expect(result).toContain('"strengths"');
    expect(result).toContain('"improvement"');
  });

  it("describes 3-star, 2-star, and 1-star criteria", () => {
    const result = buildTrainingEvalPrompt(technique, "plain", "attempt");
    expect(result).toContain("3 stars");
    expect(result).toContain("2 stars");
    expect(result).toContain("1 star");
  });
});

describe("buildTrainingHintPrompt", () => {
  const technique = { technique: "Short sentences for impact", description: "Use short sentences after long ones", structure: "Long sentence. Short.", example: "She waited. He didn't come." };

  it("level 1 gives a gentle hint", () => {
    const result = buildTrainingHintPrompt(technique, "The dog sat on the mat.", 1);
    expect(result).toContain("GENTLE first hint");
    expect(result).toContain("approach");
    expect(result).toContain("question");
  });

  it("level 1 does NOT include vocabulary or template", () => {
    const result = buildTrainingHintPrompt(technique, "plain", 1);
    expect(result).not.toContain('"vocabulary"');
    expect(result).not.toContain('"template"');
  });

  it("level 2 gives a stronger hint with vocabulary", () => {
    const result = buildTrainingHintPrompt(technique, "The dog sat on the mat.", 2);
    expect(result).toContain("STRONGER hint");
    expect(result).toContain("vocabulary");
    expect(result).toContain("question");
  });

  it("level 2 does NOT provide a template", () => {
    const result = buildTrainingHintPrompt(technique, "plain", 2);
    expect(result).toContain("Do NOT give a fill-in-the-blank template");
    expect(result).not.toContain('"template"');
  });

  it("level 2 asks Socratic question about PURPOSE", () => {
    const result = buildTrainingHintPrompt(technique, "plain", 2);
    expect(result).toContain("Socratic question");
    expect(result).toContain("PURPOSE");
  });

  it("includes technique name and plain sentence", () => {
    const result = buildTrainingHintPrompt(technique, "It was raining.", 1);
    expect(result).toContain("Short sentences for impact");
    expect(result).toContain("It was raining.");
  });
});

describe("exam rules integration", () => {
  it("buildCoachPrompt includes exam rules", () => {
    const result = buildCoachPrompt("test", "Essay", 300, "HKDSE RULES");
    expect(result).toContain("HKDSE RULES");
    expect(result).toContain("exam rules");
  });

  it("buildStructuralPrompt includes exam rules", () => {
    const result = buildStructuralPrompt("test", "Essay", null, "HKDSE RULES");
    expect(result).toContain("HKDSE RULES");
    expect(result).toContain("EXAM RULES");
  });

  it("prompts omit dynamic exam block when no rules provided", () => {
    const coach = buildCoachPrompt("test", "Essay", 300);
    const structural = buildStructuralPrompt("test", "Essay");
    expect(coach).not.toContain("You MUST follow these exam rules in ALL coaching advice");
    expect(structural).not.toContain("EXAM RULES — OVERRIDE ALL SUGGESTIONS");
  });
});

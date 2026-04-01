import { describe, it, expect } from "vitest";
import { LYRA_BRAIN } from "../src/lyra-brain.js";
import {
  buildCoachPrompt, buildScaffoldingPrompt, buildTrainingExercisesPrompt,
  buildTrainingEvalPrompt, buildTrainingHintPrompt, styleProfilerPrompt, styleCoachPrompt,
  buildStructuralPrompt, buildProofreadPrompt,
} from "../src/prompts.js";

describe("LYRA_BRAIN export", () => {
  it("exports a non-empty string", () => {
    expect(typeof LYRA_BRAIN).toBe("string");
    expect(LYRA_BRAIN.length).toBeGreaterThan(100);
  });

  it("contains core pedagogical principles", () => {
    expect(LYRA_BRAIN).toContain("4-STEP COACHING PROTOCOL");
    expect(LYRA_BRAIN).toContain("Reporter Voice");
    expect(LYRA_BRAIN).toContain("Columnist Voice");
    expect(LYRA_BRAIN).toContain("PARALLEL UNIVERSE");
    expect(LYRA_BRAIN).toContain("NEVER GHOSTWRITE");
  });

  it("contains learning data sync instructions", () => {
    expect(LYRA_BRAIN).toContain("LYRA_LEARNING_DATA");
    expect(LYRA_BRAIN).toContain("learning_sync");
  });
});

describe("LYRA_BRAIN is prepended to coaching prompts", () => {
  it("buildCoachPrompt includes LYRA_BRAIN", () => {
    const result = buildCoachPrompt("test", "Essay", 300);
    expect(result).toContain("4-STEP COACHING PROTOCOL");
    expect(result).toContain("LYRA_LEARNING_DATA");
  });

  it("buildScaffoldingPrompt includes LYRA_BRAIN", () => {
    const result = buildScaffoldingPrompt("test", "Essay", 300);
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });

  it("buildTrainingExercisesPrompt includes LYRA_BRAIN", () => {
    const result = buildTrainingExercisesPrompt([{ technique: "Test", description: "d" }]);
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });

  it("buildTrainingEvalPrompt includes LYRA_BRAIN", () => {
    const result = buildTrainingEvalPrompt({ technique: "T", description: "d" }, "plain", "attempt");
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });

  it("buildTrainingHintPrompt includes LYRA_BRAIN", () => {
    const result = buildTrainingHintPrompt({ technique: "T", description: "d" }, "plain", 1);
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });

  it("styleProfilerPrompt includes LYRA_BRAIN", () => {
    expect(styleProfilerPrompt).toContain("4-STEP COACHING PROTOCOL");
  });

  it("styleCoachPrompt includes LYRA_BRAIN", () => {
    const result = styleCoachPrompt("profile text", "Author Name");
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });
});

describe("LYRA_BRAIN is NOT prepended to non-coaching prompts", () => {
  it("buildStructuralPrompt does NOT include LYRA_BRAIN", () => {
    const result = buildStructuralPrompt("test", "Essay");
    expect(result).not.toContain("4-STEP COACHING PROTOCOL");
  });

  it("buildProofreadPrompt does NOT include LYRA_BRAIN", () => {
    const result = buildProofreadPrompt("test", "Essay", []);
    expect(result).not.toContain("4-STEP COACHING PROTOCOL");
  });
});

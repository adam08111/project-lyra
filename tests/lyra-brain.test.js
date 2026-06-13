import { describe, it, expect } from "vitest";
import { LYRA_BRAIN } from "../src/lyra-brain.js";
import {
  buildCoachPrompt, buildScaffoldingPrompt, buildTrainingExercisesPrompt,
  buildTrainingEvalPrompt, buildTrainingHintPrompt, buildStyleProfilerPrompt, styleCoachPrompt,
  buildStructuralPrompt, buildProofreadPrompt, buildTrainingChatPrompt,
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

  it("demands standard written Chinese (書面語) and bans spoken Cantonese forms", () => {
    expect(LYRA_BRAIN).toContain("CHINESE REGISTER");
    expect(LYRA_BRAIN).toContain("書面語");
    // the spoken forms from the live bug must be explicitly banned/mapped
    expect(LYRA_BRAIN).toContain("我哋 → 我們");
    expect(LYRA_BRAIN).toContain("同埋 → 和");
    expect(LYRA_BRAIN).toContain("喺 → 在");
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

  it("buildStyleProfilerPrompt includes LYRA_BRAIN", () => {
    expect(buildStyleProfilerPrompt()).toContain("4-STEP COACHING PROTOCOL");
  });

  it("styleCoachPrompt includes LYRA_BRAIN", () => {
    const result = styleCoachPrompt("profile text", "Author Name");
    expect(result).toContain("4-STEP COACHING PROTOCOL");
  });
});

describe("no-semicolon rule — coach toward ONE integrated sentence (universal)", () => {
  it("LYRA_BRAIN carries the rule", () => {
    expect(LYRA_BRAIN).toContain("ONE FLAWLESS SENTENCE");
    expect(LYRA_BRAIN).toContain("NEVER suggest joining them with a semicolon");
  });

  it("LYRA_BRAIN's gold-standard exemplars no longer splice with a semicolon", () => {
    // The old Parallel Universe models were "Undeniably, … ; yet, …" — replaced
    // by integrated "Although …, …" sentences so the model imitates the right move.
    expect(LYRA_BRAIN).toContain("Although a 6 a.m. alarm is a minor irritation,");
    expect(LYRA_BRAIN).not.toContain("Undeniably, a 6 a.m. alarm");
    expect(LYRA_BRAIN).not.toContain("is a minor irritation; yet");
    // The Masterclass before/after model is integrated too (no "; on the other").
    expect(LYRA_BRAIN).not.toContain("bleeds your account dry; on the other");
  });

  it("buildTrainingChatPrompt (the practice chat) reinforces it as a hard constraint", () => {
    const p = buildTrainingChatPrompt({ technique: "T", description: "d" }, "She wore a red dress.", []);
    expect(p).toContain("NEVER suggest joining two ideas with a semicolon");
  });

  it("the non-brain Lite surfaces carry it too (structural + proofread)", () => {
    expect(buildStructuralPrompt("test", "Essay")).toContain("NEVER suggest joining two sentences with a semicolon");
    expect(buildProofreadPrompt("test", "Essay", [])).toContain("NEVER advise joining two sentences with a semicolon");
  });
});

describe("add-a-new-sentence: Lyra invites, generator avoids repeats", () => {
  it("buildTrainingChatPrompt tells Lyra to invite a fresh sentence on a win (same skill)", () => {
    // The invitation lives in the ONGOING-turn branch (a conversation exists),
    // not the opening turn — pass a prior student message.
    const p = buildTrainingChatPrompt({ technique: "T", description: "d" }, "She wore a red dress.", [{ role: "student", text: "my rewrite" }]);
    expect(p).toContain("WHEN THE REWRITE LANDS");
    expect(p).toContain("fresh practice sentence");
    expect(p).toContain("same skill, new sentence");
  });

  it("buildTrainingExercisesPrompt lists already-practised sentences to avoid when given some", () => {
    const techs = [{ technique: "Painted Style Pictures", description: "d" }];
    const withAvoid = buildTrainingExercisesPrompt(techs, ["The red dress looked nice.", "The library was quiet."]);
    expect(withAvoid).toContain("ALREADY PRACTISED");
    expect(withAvoid).toContain("The red dress looked nice.");
    expect(withAvoid).toContain("The library was quiet.");
  });

  it("buildTrainingExercisesPrompt omits the avoid block when none given (back-compat)", () => {
    expect(buildTrainingExercisesPrompt([{ technique: "T", description: "d" }])).not.toContain("ALREADY PRACTISED");
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

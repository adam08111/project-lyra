import { describe, it, expect } from "vitest";
import { detectFormatCue, typeLabelOf } from "../src/genre-cues.js";

// The exact live-bug topic (declared type was "email").
const SCREENSHOT_TOPIC = "write a letter to editor about cell phones should be fully banned at schools";

describe("detectFormatCue", () => {
  it("detects the exact screenshot topic as Letter to the Editor → editorial", () => {
    expect(detectFormatCue(SCREENSHOT_TOPIC)).toEqual({ cueLabel: "Letter to the Editor", typeId: "editorial" });
  });

  it("mismatch logic: cue typeId differs from the declared email type", () => {
    const cue = detectFormatCue(SCREENSHOT_TOPIC);
    expect(cue.typeId !== "email").toBe(true);   // mismatch when email is selected
    expect(cue.typeId !== "editorial").toBe(false); // no mismatch when editorial is selected
  });

  it('detects "write a speech" → speech (no longer a persuasive nearest-fit)', () => {
    expect(detectFormatCue("Write a speech for the school assembly about recycling")).toEqual({ cueLabel: "Speech", typeId: "speech" });
  });

  it("returns null when there is no explicit cue", () => {
    expect(detectFormatCue("cell phones should be banned at schools")).toBeNull();
    expect(detectFormatCue("")).toBeNull();
    expect(detectFormatCue(undefined)).toBeNull();
  });

  it("returns null on two cues mapping to DIFFERENT types (ambiguous)", () => {
    expect(detectFormatCue("write a report and then write a short story about it")).toBeNull();
    // speech + letter-to-editor used to share the persuasive nearest-fit;
    // they are distinct genres now, so this is genuinely ambiguous.
    expect(detectFormatCue("write a speech for assembly, like a letter to the editor")).toBeNull();
  });

  it("allows two cues mapping to the SAME type", () => {
    // "write an article" + "to what extent" both → essay
    expect(detectFormatCue("Write an article: to what extent do you agree that homework helps learning?")).toEqual(
      expect.objectContaining({ typeId: "essay" })
    );
  });

  it('detects "story which begins" → story', () => {
    expect(detectFormatCue("Continue the story which begins: The door creaked open...")).toEqual({ cueLabel: "Story", typeId: "story" });
  });

  it("detects essay-style prompts (to what extent)", () => {
    expect(detectFormatCue("To what extent do you agree that homework helps learning?")).toEqual({ cueLabel: "Essay", typeId: "essay" });
  });

  it("typeLabelOf maps ids to display labels", () => {
    expect(typeLabelOf("persuasive")).toBe("Persuasive Writing");
    expect(typeLabelOf("email")).toBe("Formal Business Email");
    expect(typeLabelOf("editorial")).toBe("Letter to the Editor");
    expect(typeLabelOf("speech")).toBe("Speech / Talk");
    expect(typeLabelOf("nonexistent")).toBe("nonexistent");
  });
});

import { describe, it, expect } from "vitest";
import { detectFormatCue, typeLabelOf } from "../src/genre-cues.js";

// The exact live-bug topic (declared type was "email").
const SCREENSHOT_TOPIC = "write a letter to editor about cell phones should be fully banned at schools";

describe("detectFormatCue", () => {
  it("detects the exact screenshot topic as Letter to the Editor → persuasive", () => {
    expect(detectFormatCue(SCREENSHOT_TOPIC)).toEqual({ cueLabel: "Letter to the Editor", typeId: "persuasive" });
  });

  it("mismatch logic: cue typeId differs from the declared email type", () => {
    const cue = detectFormatCue(SCREENSHOT_TOPIC);
    expect(cue.typeId !== "email").toBe(true);   // mismatch when email is selected
    expect(cue.typeId !== "persuasive").toBe(false); // no mismatch when persuasive is selected
  });

  it("returns null when there is no explicit cue", () => {
    expect(detectFormatCue("cell phones should be banned at schools")).toBeNull();
    expect(detectFormatCue("")).toBeNull();
    expect(detectFormatCue(undefined)).toBeNull();
  });

  it("returns null on two cues mapping to DIFFERENT types (ambiguous)", () => {
    expect(detectFormatCue("write a report and then write a short story about it")).toBeNull();
  });

  it("allows two cues mapping to the SAME type", () => {
    // "letter to the editor" + "write a speech" both → persuasive
    expect(detectFormatCue("write a speech for assembly, like a letter to the editor")).toEqual(
      expect.objectContaining({ typeId: "persuasive" })
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
    expect(typeLabelOf("nonexistent")).toBe("nonexistent");
  });
});

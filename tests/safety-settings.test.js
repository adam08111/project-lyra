import { describe, it, expect } from "vitest";
import { SAFETY_SETTINGS, SAFETY_BLOCK_MESSAGE, isSafetyBlocked } from "../src/safety-settings.js";

// §102 F4: explicit Gemini safetySettings for a minors' English coach + the never-stuck
// (#7) companion guard. These assertions pin the deliberate threshold decision so a future
// edit can't silently drift it, and prove the block-detector never throws.
describe("safety-settings (§102 F4)", () => {
  it("sets all four settable Gemini harm categories explicitly at BLOCK_MEDIUM_AND_ABOVE", () => {
    const byCat = Object.fromEntries(SAFETY_SETTINGS.map((s) => [s.category, s.threshold]));
    expect(byCat).toEqual({
      HARM_CATEGORY_HARASSMENT: "BLOCK_MEDIUM_AND_ABOVE",
      HARM_CATEGORY_HATE_SPEECH: "BLOCK_MEDIUM_AND_ABOVE",
      HARM_CATEGORY_SEXUALLY_EXPLICIT: "BLOCK_MEDIUM_AND_ABOVE",
      HARM_CATEGORY_DANGEROUS_CONTENT: "BLOCK_MEDIUM_AND_ABOVE",
    });
  });

  it("never cedes the floor (no BLOCK_NONE) nor refuses the syllabus (no BLOCK_LOW_AND_ABOVE)", () => {
    expect(SAFETY_SETTINGS).toHaveLength(4);
    for (const s of SAFETY_SETTINGS) {
      expect(s.threshold).not.toBe("BLOCK_NONE");
      expect(s.threshold).not.toBe("BLOCK_LOW_AND_ABOVE");
    }
  });

  it("isSafetyBlocked detects a candidate that finished with reason SAFETY", () => {
    expect(isSafetyBlocked({ candidates: [{ finishReason: "SAFETY" }] })).toBe(true);
  });

  it("isSafetyBlocked detects a prompt-side block (promptFeedback.blockReason)", () => {
    expect(isSafetyBlocked({ promptFeedback: { blockReason: "SAFETY" } })).toBe(true);
  });

  it("isSafetyBlocked is false for a normal completed response", () => {
    expect(isSafetyBlocked({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "hi" }] } }] })).toBe(false);
  });

  it("isSafetyBlocked never throws on empty / malformed input", () => {
    expect(isSafetyBlocked(null)).toBe(false);
    expect(isSafetyBlocked(undefined)).toBe(false);
    expect(isSafetyBlocked({})).toBe(false);
  });

  it("SAFETY_BLOCK_MESSAGE is a non-empty, student-facing string with no prompt scaffolding (#4)", () => {
    expect(typeof SAFETY_BLOCK_MESSAGE).toBe("string");
    expect(SAFETY_BLOCK_MESSAGE.length).toBeGreaterThan(0);
    expect(SAFETY_BLOCK_MESSAGE).not.toMatch(/SAFETY|blockReason|finishReason|Gemini|safetySettings/i);
  });
});

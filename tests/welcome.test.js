import { describe, it, expect } from "vitest";
import { buildWelcomePrompt } from "../src/prompts.js";
import { FALLBACK_WELCOME, chooseWelcome, shouldSuppressWelcomeBanner } from "../src/welcome.js";
import { getRouteConfig } from "../src/ai-router.js";

const base = { name: "Mei", type: "Letter to the Editor", purpose: "hkdse", wordCount: 300, topic: "Phones should be banned at school" };

describe("buildWelcomePrompt (§43)", () => {
  it("includes the student name, the topic verbatim, and the type", () => {
    const p = buildWelcomePrompt(base);
    expect(p).toContain("Mei");
    expect(p).toContain("Phones should be banned at school");
    expect(p).toContain("Letter to the Editor");
  });

  it("enforces the brevity + voice constraints in the instruction text", () => {
    const p = buildWelcomePrompt(base);
    expect(p).toMatch(/60[–-]90 words/);          // brevity cap
    expect(p).toContain("every word will be theirs"); // never write it for them
    expect(p.toLowerCase()).toContain("hollow praise"); // no hollow praise
    expect(p).toMatch(/I'm Lyra, your writing coach/); // names the banned boilerplate
  });

  it("includes the GENRE CHECK instruction when a mismatch cue is passed", () => {
    const p = buildWelcomePrompt({ ...base, cue: { cueLabel: "Speech", typeId: "speech" } });
    expect(p).toContain("GENRE CHECK");
    expect(p).toContain("Speech");
  });

  it("omits the GENRE CHECK instruction when no cue", () => {
    expect(buildWelcomePrompt({ ...base, cue: null })).not.toContain("GENRE CHECK");
    expect(buildWelcomePrompt(base)).not.toContain("GENRE CHECK");
  });

  it("tells Lyra not to invent a name when none is given", () => {
    expect(buildWelcomePrompt({ ...base, name: "" })).toMatch(/do NOT invent a name/i);
  });
});

describe("welcome route resolves to flash + brain", () => {
  it("is the cheap flash model with brain:true", () => {
    const r = getRouteConfig("welcome");
    expect(r.model).toBe("gemini-flash-latest");
    expect(r.brain).toBe(true);
    expect(r.thinkingBudget).toBe(512);
  });
});

describe("chooseWelcome — fallback floor", () => {
  const fb = { name: "Mei", type: "Essay", topic: "School uniforms", wordCount: 300 };
  it("returns the generated greeting when present and no error", () => {
    expect(chooseWelcome("Hi Mei, your uniforms angle is sharp...", null, fb)).toBe("Hi Mei, your uniforms angle is sharp...");
  });
  it("falls back to the template on error", () => {
    const out = chooseWelcome("anything", new Error("network"), fb);
    expect(out).toBe(FALLBACK_WELCOME(fb));
    expect(out).toContain("Mei");
  });
  it("falls back to the template on empty / whitespace-only generation", () => {
    expect(chooseWelcome("", null, fb)).toBe(FALLBACK_WELCOME(fb));
    expect(chooseWelcome("   \n  ", null, fb)).toBe(FALLBACK_WELCOME(fb));
  });
});

describe("shouldSuppressWelcomeBanner — banner deferral (Unit 3)", () => {
  it("suppresses the §28 banner when a cue was present AND the greeting succeeded", () => {
    expect(shouldSuppressWelcomeBanner(true, true)).toBe(true);
  });
  it("keeps the banner when the greeting fell back (template is genre-blind)", () => {
    expect(shouldSuppressWelcomeBanner(true, false)).toBe(false);
  });
  it("no suppression when there was no cue at all", () => {
    expect(shouldSuppressWelcomeBanner(false, true)).toBe(false);
    expect(shouldSuppressWelcomeBanner(false, false)).toBe(false);
  });
});

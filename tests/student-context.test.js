import { describe, it, expect } from "vitest";
import { getStudentContext } from "../src/growth-report.js";

// §66 — the distiller is PURE when passed a profile (no localStorage needed).
const profile = {
  level: { name: "Developing Writer", trajectory: "rising" },
  weaknesses: [
    { id: "sva", label: "Subject-verb agreement", status: "active", distinctForms: ["he go", "the data show"], prescription: { en: "the -s hops from the noun onto the verb" } },
    { id: "art", label: "Article usage", status: "active", distinctForms: ["best idea"], prescription: { en: "put 'the' before a superlative" } },
    { id: "tense", label: "Tense consistency", status: "active", prescription: null }, // no prescription → watch-list, not focus
    { id: "frag", label: "Sentence fragments", status: "watch", prescription: null },
  ],
  graduated: [{ id: "runon", label: "Run-on sentences" }],
};

describe("§66 getStudentContext (distil the growth profile)", () => {
  it("distils level + focus (prescription weaknesses) + wins + watch-list", () => {
    const ctx = getStudentContext(profile);
    expect(ctx.level).toBe("Developing Writer (rising)");
    // focus = the two weaknesses that carry a prescription
    expect(ctx.focus.map((f) => f.rule)).toEqual(["Subject-verb agreement", "Article usage"]);
    expect(ctx.focus[0]).toEqual({ rule: "Subject-verb agreement", status: "active", note: "he go, the data show" });
    // wins = graduated rule names (ammunition for explicit win-citing)
    expect(ctx.wins).toContain("Run-on sentences");
    // watch-list = open weaknesses WITHOUT a prescription, name only, not in focus
    expect(ctx.watchList).toContain("Tense consistency");
    expect(ctx.watchList).not.toContain("Subject-verb agreement");
  });

  it("caps focus at 3 and watch-list at 2", () => {
    const many = {
      weaknesses: [
        ...Array.from({ length: 5 }, (_, i) => ({ id: "f" + i, label: "Focus " + i, status: "active", prescription: { en: "x" } })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: "w" + i, label: "Watch " + i, status: "active", prescription: null })),
      ],
    };
    const ctx = getStudentContext(many);
    expect(ctx.focus.length).toBe(3);
    expect(ctx.watchList.length).toBe(2);
  });

  it("falls back to the prescription text for the note when there are no distinctForms", () => {
    const ctx = getStudentContext({ weaknesses: [{ id: "art", label: "Article usage", status: "active", prescription: { en: "put 'the' before a superlative" } }] });
    expect(ctx.focus[0].note).toBe("put 'the' before a superlative");
  });

  it("excludes resolved weaknesses from focus; surfaces them as wins", () => {
    const ctx = getStudentContext({
      weaknesses: [{ id: "sva", label: "Subject-verb agreement", status: "resolved", prescription: { en: "x" } }],
    });
    // resolved → not a focus, but counts as a win
    expect(ctx).not.toBeNull();
    expect(ctx.focus.length).toBe(0);
    expect(ctx.wins).toContain("Subject-verb agreement");
  });

  it("cold start: returns null on no profile / empty profile (no injection)", () => {
    expect(getStudentContext(null)).toBeNull();
    expect(getStudentContext({})).toBeNull();
    expect(getStudentContext({ weaknesses: [] })).toBeNull();
    expect(getStudentContext("not an object")).toBeNull();
  });
});

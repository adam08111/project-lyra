import { describe, it, expect } from "vitest";
import { remainingSections, mergeNewSectionsIntoSkill } from "../src/components/XRayView.jsx";
import { XRAY_ALL_SECTIONS } from "../src/prompts.js";

const TECHNIQUE = XRAY_ALL_SECTIONS.filter(n => n !== "WHEN TO USE THIS STYLE" && n !== "SIGNATURE STYLE");

describe("remainingSections — what 'Analyse more' still has to cover", () => {
  it("excludes saved technique sections and populated WHEN/SIGNATURE", () => {
    const skill = {
      sections: [{ title: "SENTENCE PATTERNS", content: "" }, { title: "WORD CHOICES", content: "" }],
      whenToUse: { keyIdea: "use it here", bullets: [] },
      signatureStyle: "punchy",
    };
    const rem = remainingSections(skill);
    expect(rem).not.toContain("SENTENCE PATTERNS");
    expect(rem).not.toContain("WORD CHOICES");
    expect(rem).not.toContain("WHEN TO USE THIS STYLE");
    expect(rem).not.toContain("SIGNATURE STYLE");
    expect(rem).toContain("GRAMMAR TRICKS");
    expect(rem).toContain("COMPARING AND DESCRIBING");
  });

  it("counts WHEN/SIGNATURE as missing when their fields are empty", () => {
    const skill = { sections: [{ title: "SENTENCE PATTERNS" }], whenToUse: { keyIdea: "", bullets: [] }, signatureStyle: "" };
    const rem = remainingSections(skill);
    expect(rem).toContain("WHEN TO USE THIS STYLE");
    expect(rem).toContain("SIGNATURE STYLE");
  });

  it("returns [] once every canonical section is present (button hides)", () => {
    const skill = {
      sections: TECHNIQUE.map(title => ({ title, content: "" })),
      whenToUse: { keyIdea: "x", bullets: [] },
      signatureStyle: "y",
    };
    expect(remainingSections(skill)).toEqual([]);
  });
});

describe("mergeNewSectionsIntoSkill — append without duplicates", () => {
  it("appends new technique sections + WHEN/SIGNATURE, never duplicating an existing title", () => {
    const skill = {
      id: "skill_1",
      sections: [{ title: "SENTENCE PATTERNS", content: "KEY IDEA: a" }],
      analysedTechniques: [{ technique: "a" }],
      whenToUse: { keyIdea: "", bullets: [] },
      signatureStyle: "",
    };
    const newSections = [
      { title: "SENTENCE PATTERNS", content: "KEY IDEA: dup" }, // overlapping title → ignored
      { title: "GRAMMAR TRICKS", content: "SHORT TITLE: Trick\nKEY IDEA: g" },
      { title: "WHEN TO USE THIS STYLE", content: "KEY IDEA: use here" },
      { title: "SIGNATURE STYLE", content: "KEY IDEA: signature here" },
    ];
    const merged = mergeNewSectionsIntoSkill(skill, newSections);
    const titles = merged.sections.map(s => s.title);
    expect(titles.filter(t => t === "SENTENCE PATTERNS")).toHaveLength(1); // no duplicate
    expect(titles).toContain("GRAMMAR TRICKS");
    expect(merged.analysedTechniques).toHaveLength(2);
    expect(merged.whenToUse.keyIdea).toBe("use here");
    expect(merged.signatureStyle).toBe("signature here");
    expect(merged.id).toBe("skill_1"); // identity preserved
  });

  it("dedupes titles case/whitespace-insensitively", () => {
    const skill = { sections: [{ title: "WORD CHOICES", content: "" }], analysedTechniques: [] };
    const merged = mergeNewSectionsIntoSkill(skill, [{ title: "  word choices ", content: "KEY IDEA: z" }]);
    expect(merged.sections).toHaveLength(1);
  });

  it("does not mutate the input skill", () => {
    const skill = { sections: [{ title: "WORD CHOICES", content: "" }], analysedTechniques: [] };
    mergeNewSectionsIntoSkill(skill, [{ title: "GRAMMAR TRICKS", content: "KEY IDEA: g" }]);
    expect(skill.sections).toHaveLength(1);
    expect(skill.analysedTechniques).toHaveLength(0);
  });
});

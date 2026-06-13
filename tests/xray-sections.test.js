import { describe, it, expect, beforeEach } from "vitest";
import { remainingSections, mergeNewSectionsIntoSkill, saveStyleSkill, filterSectionsToRequested, SOURCE_TEXT_MAX_CHARS } from "../src/components/XRayView.jsx";
import { XRAY_ALL_SECTIONS } from "../src/prompts.js";

// saveStyleSkill touches localStorage at call time — stub it for the node env.
const store = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

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

describe("saveStyleSkill — sourceText cap", () => {
  const TWO_SECTIONS = [
    { title: "SENTENCE PATTERNS", content: "KEY IDEA: short sentences punch" },
    { title: "WORD CHOICES", content: "KEY IDEA: strong verbs do real work" },
  ];
  beforeEach(() => localStorage.clear());

  it("stores a pathological paste truncated to exactly SOURCE_TEXT_MAX_CHARS", () => {
    const huge = "a".repeat(SOURCE_TEXT_MAX_CHARS + 5000);
    const skill = saveStyleSkill("Cap Test Author", TWO_SECTIONS, huge);
    expect(skill).not.toBeNull();
    expect(skill.sourceText).toHaveLength(SOURCE_TEXT_MAX_CHARS);
    const stored = JSON.parse(localStorage.getItem("lyra-style-skills")).find(s => s.authorName === "Cap Test Author");
    expect(stored.sourceText).toHaveLength(SOURCE_TEXT_MAX_CHARS);
  });

  it("stores a normal-length passage byte-identical", () => {
    const normal = "It is a truth universally acknowledged that articles are shorter than the cap. ".repeat(10);
    const skill = saveStyleSkill("Normal Author", TWO_SECTIONS, normal);
    expect(skill.sourceText).toBe(normal);
  });
});

describe("coveredSections ledger — 'Analyse more' always terminates", () => {
  it("records every returned header as covered — even thin WHEN/SIGNATURE — so remaining empties", () => {
    const skill = {
      sections: ["SENTENCE PATTERNS", "WORD CHOICES", "COMPARING AND DESCRIBING"].map(title => ({ title, content: "KEY IDEA: x" })),
      analysedTechniques: [{ technique: "x" }, { technique: "y" }, { technique: "z" }],
      coveredSections: ["SENTENCE PATTERNS", "WORD CHOICES", "COMPARING AND DESCRIBING"],
      whenToUse: { keyIdea: "", bullets: [] },
      signatureStyle: "",
    };
    // The remaining 4 techniques + WHEN/SIGNATURE, where WHEN/SIGNATURE come back
    // with NO parseable content (header only) — the exact non-termination edge.
    const newSections = [
      { title: "HOW IDEAS ARE CONNECTED", content: "KEY IDEA: a" },
      { title: "GRAMMAR TRICKS", content: "KEY IDEA: b" },
      { title: "HOW THE WRITER PERSUADES", content: "KEY IDEA: c" },
      { title: "FEELING AND PERSONALITY", content: "KEY IDEA: d" },
      { title: "WHEN TO USE THIS STYLE", content: "" },
      { title: "SIGNATURE STYLE", content: "" },
    ];
    const merged = mergeNewSectionsIntoSkill(skill, newSections);
    expect(merged.whenToUse.keyIdea).toBe(""); // content genuinely stayed empty
    expect(merged.signatureStyle).toBe("");
    expect(remainingSections(merged)).toEqual([]); // …but the button still hides
  });

  it("remainingSections trusts the ledger over thin content", () => {
    const skill = { coveredSections: [...XRAY_ALL_SECTIONS], sections: [], whenToUse: { keyIdea: "", bullets: [] }, signatureStyle: "" };
    expect(remainingSections(skill)).toEqual([]);
  });
});

describe("filterSectionsToRequested — display/persistence never exceed the request", () => {
  const asSections = (titles) => titles.map(title => ({ title, content: "KEY IDEA: x" }));

  it("drops over-produced sections (the live 9-on-a-3-request case)", () => {
    const requested = ["SENTENCE PATTERNS", "WORD CHOICES", "COMPARING AND DESCRIBING"];
    const overProduced = asSections(XRAY_ALL_SECTIONS); // model emitted all 9
    const kept = filterSectionsToRequested(overProduced, requested);
    expect(kept).toHaveLength(3);
    expect(kept.map(s => s.title)).toEqual(["COMPARING AND DESCRIBING", "SENTENCE PATTERNS", "WORD CHOICES"]); // canonical emit order preserved
  });

  it("keeps a compliant response unchanged", () => {
    const requested = ["SENTENCE PATTERNS", "WORD CHOICES"];
    const compliant = asSections(["SENTENCE PATTERNS", "WORD CHOICES"]);
    expect(filterSectionsToRequested(compliant, requested)).toEqual(compliant);
  });

  it("matches case/space-insensitively", () => {
    const kept = filterSectionsToRequested(
      [{ title: " Sentence Patterns ", content: "" }],
      ["SENTENCE PATTERNS"]
    );
    expect(kept).toHaveLength(1);
  });

  it("empty or invalid request = no filtering (Analyse-more manages its own subsets)", () => {
    const all = asSections(XRAY_ALL_SECTIONS);
    expect(filterSectionsToRequested(all, [])).toEqual(all);
    expect(filterSectionsToRequested(all, null)).toEqual(all);
  });

  it("invalid sections input returns []", () => {
    expect(filterSectionsToRequested(null, ["WORD CHOICES"])).toEqual([]);
  });
});

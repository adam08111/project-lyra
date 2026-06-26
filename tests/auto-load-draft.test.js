import { describe, it, expect } from "vitest";
import { shouldAutoLoadDraft } from "../src/utils.js";

const longDraft = Array.from({ length: 60 }, (_, i) => "word" + i).join(" "); // 60 words

describe("§76 shouldAutoLoadDraft — paste a draft into chat → fill the empty editor", () => {
  it("loads a substantial draft when the editor is empty", () => {
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "" })).toBe(true);
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "   " })).toBe(true);
  });

  it("NEVER overwrites existing writing", () => {
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "I already started my essay here." })).toBe(false);
  });

  it("ignores short messages (a question, not a draft)", () => {
    expect(shouldAutoLoadDraft({ text: "is my thesis okay?", draft: "" })).toBe(false);
    expect(shouldAutoLoadDraft({ text: "", draft: "" })).toBe(false);
    expect(shouldAutoLoadDraft({ draft: "" })).toBe(false);
  });

  it("ignores reloads, quick-actions (search) and scaffolding turns", () => {
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "", isReload: true })).toBe(false);
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "", useSearch: true })).toBe(false);
    expect(shouldAutoLoadDraft({ text: longDraft, draft: "", scaffolding: true })).toBe(false);
  });
});

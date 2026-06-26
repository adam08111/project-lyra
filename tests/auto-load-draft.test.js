import { describe, it, expect } from "vitest";
import { shouldAutoLoadDraft, buildConversationContext } from "../src/utils.js";

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

describe("§77 buildConversationContext — My Writing sees the FULL chat", () => {
  it("renders every turn labelled Student/Lyra and strips the hidden learning data", () => {
    const msgs = [
      { role: "user", text: "is my thesis clear?" },
      { role: "ai", text: "Yes — strong stance. Keep 'akin to', it's a deliberate formal choice.<!--LYRA_LEARNING_DATA\n{\"x\":1}\nLYRA_LEARNING_DATA-->" },
      { role: "user", text: "ok thanks" },
    ];
    const ctx = buildConversationContext(msgs);
    expect(ctx).toContain("Student: is my thesis clear?");
    expect(ctx).toContain("Lyra: Yes — strong stance");
    expect(ctx).toContain("akin to");
    expect(ctx).not.toContain("LYRA_LEARNING_DATA");   // hidden payload stripped
    expect(ctx).not.toContain("{");
  });

  it("returns null on an empty conversation", () => {
    expect(buildConversationContext([])).toBeNull();
    expect(buildConversationContext(null)).toBeNull();
  });

  it("keeps the MOST RECENT turns + a marker when over budget (never a silent cut)", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? "ai" : "user", text: "message number " + i + " " + "x".repeat(300) }));
    const ctx = buildConversationContext(many, { maxTotal: 3000, maxPerMsg: 400 });
    expect(ctx).toContain("(…earlier conversation trimmed…)"); // explicit, not silent
    expect(ctx).toContain("message number 99");                // newest kept
    expect(ctx).not.toContain("message number 0 ");            // oldest dropped
    expect(ctx.length).toBeLessThan(3600);
  });
});

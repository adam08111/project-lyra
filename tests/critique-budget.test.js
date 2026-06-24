import { describe, it, expect } from "vitest";
import { getRouteConfig } from "../src/ai-router.js";

// §67 — the 6-of-15 sample was partly truncation: thinking tokens count toward
// maxOutputTokens, so a 4096 thinking budget under a 4096 output cap left almost
// nothing for the visible sweep. The coaching route now budgets generously.
describe("§67 chat_coaching maxTokens — the full critique sweep can't truncate", () => {
  it("budgets generously, well above the thinking budget", () => {
    const r = getRouteConfig("chat_coaching");
    expect(r.maxTokens).toBeGreaterThanOrEqual(16384);
    expect(r.maxTokens).toBeGreaterThan(r.thinkingBudget * 2); // real room for visible output after thinking
  });

  it("scaffolding keeps a margin over its thinking budget too", () => {
    const r = getRouteConfig("scaffolding");
    expect(r.maxTokens).toBeGreaterThan(r.thinkingBudget);
  });
});

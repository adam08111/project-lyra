import { describe, it, expect } from "vitest";
import { cleanMessageText, canReloadMessage, getMessageTranslation } from "../src/chat-actions.js";
import { buildMessageTranslatePrompt } from "../src/prompts.js";

describe("§53 chat action row — pure helpers", () => {
  describe("cleanMessageText (copy / translate input)", () => {
    it("strips the hidden LYRA_LEARNING_DATA block and markdown", () => {
      const raw = "Here is **bold** advice for you.\n<!--LYRA_LEARNING_DATA\n{\"type\":\"learning_sync\"}\nLYRA_LEARNING_DATA-->";
      const clean = cleanMessageText(raw);
      expect(clean).toContain("Here is bold advice for you.");
      expect(clean).not.toContain("**");
      expect(clean).not.toContain("LYRA_LEARNING_DATA");
      expect(clean).not.toContain("{");
    });
    it("is safe on empty / undefined input", () => {
      expect(cleanMessageText("")).toBe("");
      expect(cleanMessageText(undefined)).toBe("");
    });
  });

  describe("canReloadMessage (reload reconstruction predicate)", () => {
    it("is true only for AI messages that retained reqText", () => {
      expect(canReloadMessage({ role: "ai", reqText: "mark my draft please" })).toBe(true);
    });
    it("is false for AI messages with no/blank reqText (welcome / legacy)", () => {
      expect(canReloadMessage({ role: "ai" })).toBe(false);
      expect(canReloadMessage({ role: "ai", reqText: "" })).toBe(false);
      expect(canReloadMessage({ role: "ai", reqText: "   " })).toBe(false);
    });
    it("is false for user bubbles and nullish", () => {
      expect(canReloadMessage({ role: "user", reqText: "x" })).toBe(false);
      expect(canReloadMessage(null)).toBe(false);
      expect(canReloadMessage(undefined)).toBe(false);
    });
  });

  describe("getMessageTranslation (cache)", () => {
    it("returns the cached translation WITHOUT calling the fetcher", async () => {
      let calls = 0;
      const fetcher = async () => { calls++; return "fresh"; };
      const got = await getMessageTranslation({ translation_zh: "已快取的譯文" }, fetcher);
      expect(got).toBe("已快取的譯文");
      expect(calls).toBe(0);
    });
    it("calls the fetcher once on a miss; a re-tap (now cached) does not call again", async () => {
      let calls = 0;
      const fetcher = async () => { calls++; return "新的中文翻譯"; };
      const m = {}; // no translation_zh yet
      const first = await getMessageTranslation(m, fetcher);
      expect(first).toBe("新的中文翻譯");
      expect(calls).toBe(1);
      m.translation_zh = first; // component caches it on the message
      const second = await getMessageTranslation(m, fetcher);
      expect(second).toBe("新的中文翻譯");
      expect(calls).toBe(1); // cached — no second call
    });
  });

  describe("buildMessageTranslatePrompt", () => {
    it("requests Traditional (繁體), never Simplified, output-only", () => {
      const p = buildMessageTranslatePrompt();
      expect(p).toMatch(/繁體/);
      expect(p).toMatch(/never Simplified/i);
      expect(p).toMatch(/Output ONLY the translation/i);
    });
  });
});

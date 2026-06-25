import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanMessageText, canReloadMessage, getMessageTranslation, copyToClipboard, parseChatGrammarFixes } from "../src/chat-actions.js";
import { buildMessageTranslatePrompt } from "../src/prompts.js";

describe("§70 parseChatGrammarFixes — save chat critique fixes to the Grammar Log", () => {
  it("parses numbered original → correction lines (quotes + bold), skips clean / unparseable / no-change", () => {
    const critique = [
      "Let's go through your sentences one by one:",
      `1. "Every decades technology is difference." → "Every decade's technology is different." (Every 之後要接單數名詞; agreement)`,
      `2. **2010s of popularity was smartwatch.** → **In the 2010s, smartwatches were popular.** (提及一般類別時用眾數)`,
      "3. Sentence 3 — I can't fully decode this one; my best guess is \"X,\" but tell me if I'm wrong.", // unparseable → skip
      "4. This sentence is fine.",                                  // clean → skip
      `5. "Some teachers think AI helps." → "Some teachers think AI helps."`, // no change → skip
    ].join("\n");
    const fixes = parseChatGrammarFixes(critique);
    expect(fixes.length).toBe(2);
    expect(fixes[0]).toMatchObject({ phrase: "Every decades technology is difference.", correction: "Every decade's technology is different.", rule: "Subject-Verb Agreement" });
    expect(fixes[1]).toMatchObject({ phrase: "2010s of popularity was smartwatch.", correction: "In the 2010s, smartwatches were popular.", rule: "Plural / Singular" });
    expect(fixes[0].explanation).toContain("agreement");
  });

  it("strips ALL markdown bold from the saved fields — no raw ** leaks onto the plain-text card", () => {
    // The reported bug: the 繁中 explanation kept inline **bold** ("**agreement**"),
    // and the Grammar-Log card renders plain text, so raw asterisks showed.
    const line = `1. **"Every decades technology is difference."** → **"Every decade's technology is different."** (這裡又見到了你正在練習的 **agreement** 錯誤：**Every** 之後要用單數 **decade**；**difference** 是名詞，需要 **different**。)`;
    const [fix] = parseChatGrammarFixes(line);
    expect(fix.phrase).toBe("Every decades technology is difference.");
    expect(fix.correction).toBe("Every decade's technology is different.");
    expect(fix.phrase).not.toContain("*");
    expect(fix.correction).not.toContain("*");
    expect(fix.explanation).not.toContain("*");      // the bug: no raw ** in the explanation
    expect(fix.explanation).toContain("agreement");  // inner text preserved
    expect(fix.rule).toBe("Subject-Verb Agreement");
  });

  it("§70.A two-arrow sweep (original → reason → fix): clean fix pill, reason routed to explanation", () => {
    // The CANONICAL §67 shape (lyra-brain.js:217) has TWO arrows — the reason in the
    // middle, the fix at the END. The old parser jammed reason+arrow+fix into the pill.
    const line = `1. "Every decades technology is difference." → "every" takes a singular noun ("every decade"); the possessive is missing → "Every decade's technology is different."`;
    const [fix] = parseChatGrammarFixes(line);
    expect(fix.phrase).toBe("Every decades technology is difference.");
    expect(fix.correction).toBe("Every decade's technology is different."); // the FIX, not the reason-blob
    expect(fix.correction).not.toContain("→");                 // no raw arrow leaked into the pill
    expect(fix.correction).not.toMatch(/singular|possessive/); // the reason stayed OUT of the green pill
    expect(fix.explanation).toContain("singular noun");        // reason routed to the explanation
  });

  it("§70.B skips outlines / plans (numbered arrows but unquoted) — no false-positive 'fixes'", () => {
    const outline = "Here's a plan for your essay:\n1. Introduction → hook the reader with a question\n2. Body → give your three reasons, don't forget examples\n3. Conclusion → restate and end strong";
    expect(parseChatGrammarFixes(outline)).toEqual([]);
  });

  it("§70.C skips a flagged-undecodable line even when its best guess contains an arrow", () => {
    const line = `3. Sentence 3 — I can't fully decode this one; my best guess is you meant "cats" → "dogs", but tell me if I'm wrong.`;
    expect(parseChatGrammarFixes(line)).toEqual([]);
  });

  it("§70.D/E strips single * and backticks; absorbs a nested-paren reason + trailing period", () => {
    const a = '4. *runned* → `ran` (past tense of "run").';
    const [fa] = parseChatGrammarFixes(a);
    expect(fa.phrase).toBe("runned");
    expect(fa.correction).toBe("ran");
    expect(fa.phrase + "|" + fa.correction).not.toMatch(/[*`]/);
    const b = `5. "its raining" → "it's raining" (use "it's" (with apostrophe) for "it is")`;
    const [fb] = parseChatGrammarFixes(b);
    expect(fb.correction).toBe("it's raining");      // nested-paren reason peeled off cleanly
    expect(fb.explanation).toContain("apostrophe");
  });

  it("dedups repeated fixes and returns [] for a normal coaching turn", () => {
    const dup = `1. "a are" → "a is" (agreement)\n2. "a are" → "a is" (agreement)`;
    expect(parseChatGrammarFixes(dup).length).toBe(1);
    expect(parseChatGrammarFixes("Great work! What's your main point? Try writing one more sentence.")).toEqual([]);
    expect(parseChatGrammarFixes("")).toEqual([]);
  });
});

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

  describe("copyToClipboard (secure-context + insecure-context fallback)", () => {
    afterEach(() => { vi.unstubAllGlobals(); });
    it("uses navigator.clipboard.writeText when available and returns true", async () => {
      let written = null;
      vi.stubGlobal("navigator", { clipboard: { writeText: async (v) => { written = v; } } });
      const ok = await copyToClipboard("hello 世界");
      expect(ok).toBe(true);
      expect(written).toBe("hello 世界");
    });
    it("returns false (no crash) when neither clipboard nor document is available", async () => {
      vi.stubGlobal("navigator", {}); // insecure context → no navigator.clipboard; node env → no document
      const ok = await copyToClipboard("x");
      expect(ok).toBe(false);
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

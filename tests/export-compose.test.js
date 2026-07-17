// BRIEF-116 / §127 — the take-home COMPOSER. Pure function, so tested hard: determinism, the
// D-O3 render-surface characterization (every field HTML-escaped; the JSON island can't break out),
// the honest contents line, the empty path, and a 繁中 UTF-8 round-trip (the file must open correctly
// forever). No DOM, no network — the composer is (corpus, meta) -> string.
import { describe, it, expect } from "vitest";
import { composeExport, escapeHtml } from "../src/export/compose.js";

const CORPUS = {
  studentName: "Ming",
  writings: [{ title: "My Essay", topic: "Smartphones", draft: "Line one.\nLine two.", date: "2026-07-10T00:00:00.000Z" }],
  learning: { total: 2, byRule: [{ rule: "Subject-Verb Agreement", count: 2, examples: [{ phrase: "he go", correction: "he goes" }] }] },
  growth: {
    studentName: "Ming",
    level: { name: "Developing Writer", summary: "Good progress." },
    sections: { level: { en: "You are developing." }, strengths: { en: "Strong openings." } },
    strengths: [{ label: "Vivid verbs" }],
    weaknesses: [{ label: "Comma splices", status: "active" }],
  },
  snapshots: null,
};
const META = { included: ["1 writing", "your growth report"], omitted: ["your online history (this copy is from your device)"], date: "2026-07-17T00:00:00.000Z", dateLabel: "17 July 2026" };

describe("composeExport — the take-home .html", () => {
  it("is deterministic for a fixed corpus + meta (no Date.now/random inside)", () => {
    expect(composeExport(CORPUS, META)).toBe(composeExport(CORPUS, META));
  });

  it("renders a self-contained document with the content, the contents line, and a JSON island", () => {
    const html = composeExport(CORPUS, META);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Line one.\nLine two.");                 // the draft, verbatim
    expect(html).toContain("Subject-Verb Agreement");
    expect(html).toContain("Developing Writer");
    expect(html).toContain("This file contains: 1 writing, your growth report.");
    expect(html).toContain("Not included: your online history");
    expect(html).toContain('<script type="application/json" id="lyra-export-data">');
    expect(html).not.toMatch(/https?:\/\//);                        // zero remote resources
  });

  it("D-O3 — every field is HTML-escaped; live markup and island breakout are neutralized", () => {
    const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const hostile = {
      studentName: XSS,
      writings: [{ title: XSS, topic: XSS, draft: XSS, date: "" }],
      learning: { total: 1, byRule: [{ rule: XSS, count: 1, examples: [{ phrase: XSS, correction: XSS }] }] },
      growth: { level: { name: XSS, summary: XSS }, sections: { level: { en: XSS } }, strengths: [{ label: XSS }], weaknesses: [{ label: XSS, status: XSS }] },
      snapshots: { writings: [{ writingId: XSS, content: XSS, trigger: XSS, date: "" }], reports: [] },
    };
    const html = composeExport(hostile, { included: [XSS], omitted: [XSS], dateLabel: XSS });
    // The ONLY <script ...> is the JSON island opener; the ONLY </script> is its close.
    expect((html.match(/<script/gi) || []).length).toBe(1);
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    expect(html).not.toMatch(/<img/i);                              // hostile <img> never lands as a tag
    expect(html).toContain("&lt;script&gt;");                       // payload survives as inert text
    expect(html).toContain("\\u003c/script");                       // island breakout neutralized (< -> <)
  });

  it("empty corpus → an honest empty message, still a valid document with an island", () => {
    const html = composeExport({ studentName: "", writings: [], learning: null, growth: null, snapshots: null }, { included: [], omitted: [] });
    expect(html).toContain("Nothing has been written yet");
    expect(html).toContain("This file is empty.");
    expect(html).toContain('<script type="application/json"');
  });

  it("繁中 content round-trips intact (the file opens correctly, forever)", () => {
    const zh = "我今天寫了一篇關於智能電話的文章。";
    const html = composeExport({ studentName: "", writings: [{ title: "我的文章", topic: "", draft: zh, date: "" }], learning: null, growth: null, snapshots: null }, {});
    expect(html).toContain(zh);
    expect(html).toContain("我的文章");
  });

  it("escapeHtml handles the five HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
    expect(escapeHtml(null)).toBe("");
  });
});

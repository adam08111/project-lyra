import { describe, it, expect, vi, afterEach } from "vitest";
import { logTokenUsage } from "../src/token-metrics.js";

// logTokenUsage logs (no return value) and must NEVER throw — it sits in a proxy
// response path (#7 never-stuck). We assert the computed [tokens] line + the guards.

afterEach(() => vi.restoreAllMocks());

describe("logTokenUsage — Step-0 token diagnostic", () => {
  it("computes cached / prompt / hit% from a real usageMetadata shape", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    // The exact shape Gemini returned on a cached 2nd Pro call (verified live).
    logTokenUsage(
      { promptTokenCount: 14926, cachedContentTokenCount: 8173, candidatesTokenCount: 1, totalTokenCount: 14927 },
      { model: "gemini-3-flash-preview", stream: true }
    );
    const line = spy.mock.calls.map((c) => c.join(" ")).find((s) => s.includes("[tokens]"));
    expect(line).toBeTruthy();
    expect(line).toContain("model=gemini-3-flash-preview");
    expect(line).toContain("stream=1");
    expect(line).toContain("prompt=14926");
    expect(line).toContain("cached=8173");
    expect(line).toContain("(55% hit)"); // 8173/14926 = 54.8% -> 55
    expect(line).toContain("out=1");
    expect(line).toContain("total=14927");
  });

  it("falls back total to prompt+out and reports 0% hit when uncached", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logTokenUsage({ promptTokenCount: 100, candidatesTokenCount: 20 }, { model: "m" });
    const line = spy.mock.calls.map((c) => c.join(" ")).find((s) => s.includes("[tokens]"));
    expect(line).toContain("cached=0 (0% hit)");
    expect(line).toContain("total=120"); // fallback: prompt + out
  });

  it("never throws and logs nothing for null / undefined / non-object", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => logTokenUsage(null, { model: "m" })).not.toThrow();
    expect(() => logTokenUsage(undefined)).not.toThrow();
    expect(() => logTokenUsage("nope")).not.toThrow();
    expect(spy.mock.calls.some((c) => c.join(" ").includes("[tokens]"))).toBe(false);
  });

  it("never throws on an empty or missing-field object (the never-stuck guard)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => logTokenUsage({})).not.toThrow();
    expect(() => logTokenUsage({ promptTokenCount: 0 })).not.toThrow();
    // {} is still an object → it logs a zeroed line, which is fine (no throw is the point).
    const line = spy.mock.calls.map((c) => c.join(" ")).find((s) => s.includes("[tokens]"));
    expect(line).toContain("prompt=0 cached=0 (0% hit)");
  });
});

import { describe, it, expect } from "vitest";
import { extractJsonObject } from "../src/utils.js";

// §57 — the proofread Lite response is unreliable JSON. extractJsonObject must
// recover a complete object from fences/preamble/trailing prose, and THROW (so
// the caller can retry / show an error) on prose-without-braces or truncated JSON.
describe("§57 extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"grammar":[],"style":[]}')).toEqual({ grammar: [], style: [] });
  });
  it("strips ```json fences", () => {
    expect(extractJsonObject('```json\n{"grammar":[1]}\n```')).toEqual({ grammar: [1] });
  });
  it("strips a preamble before the object", () => {
    expect(extractJsonObject('Here is the analysis:\n{"style":["x"]}')).toEqual({ style: ["x"] });
  });
  it("ignores trailing prose after the object", () => {
    expect(extractJsonObject('{"vocabulary":[]}\n\nLet me know if you need more!')).toEqual({ vocabulary: [] });
  });
  it("THROWS on prose with no JSON object (the Lite maxTokens=1000 failure mode)", () => {
    expect(() => extractJsonObject("rather than the singular 'ourself'). Example wrong: ...")).toThrow();
  });
  it("THROWS on truncated / unterminated JSON (the Lite maxTokens cutoff)", () => {
    expect(() => extractJsonObject('{ "grammar": [ { "phrase": "everyone use", "correction": "every')).toThrow();
  });
  it("is safe on empty / nullish input (throws, not crashes)", () => {
    expect(() => extractJsonObject("")).toThrow();
    expect(() => extractJsonObject(undefined)).toThrow();
  });
});

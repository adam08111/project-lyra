import { describe, it, expect } from "vitest";
import { hashContent, byteLen } from "../src/content-hash.js";

// BRIEF-RS — pin the shared dedup-hash contract. It is the single source of truth for the
// writing-snapshot and report-snapshot content keys, so a silent change to the algorithm would
// fork every dedup key. Not a security hash — determinism + stability are the whole contract.
describe("content-hash (shared dedup primitive)", () => {
  it("is deterministic — same input ⇒ same hash", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"));
    const s = JSON.stringify({ a: 1, b: [2, 3] });
    expect(hashContent(s)).toBe(hashContent(s));
  });

  it("distinguishes different inputs", () => {
    expect(hashContent("a")).not.toBe(hashContent("b"));
    expect(hashContent('{"a":1}')).not.toBe(hashContent('{"a":2}'));
  });

  it("carries a ':<length>' suffix and is null-safe", () => {
    expect(hashContent("abc").endsWith(":3")).toBe(true);
    expect(hashContent(null)).toBe(hashContent(""));
    expect(hashContent(null).endsWith(":0")).toBe(true);
  });

  it("byteLen counts UTF-8 bytes and is null-safe", () => {
    expect(byteLen("abc")).toBe(3);
    expect(byteLen("€")).toBe(3);       // 3-byte UTF-8
    expect(byteLen(null)).toBe(0);
  });
});

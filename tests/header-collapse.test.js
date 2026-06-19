import { describe, it, expect } from "vitest";
import { nextHeaderCollapsed } from "../src/header-collapse.js";

describe("nextHeaderCollapsed — scroll-driven header collapse with hysteresis", () => {
  it("collapses once scrolled past 24", () => {
    expect(nextHeaderCollapsed(25, false)).toBe(true);
    expect(nextHeaderCollapsed(200, false)).toBe(true);
  });

  it("does NOT collapse at or below 24 from the expanded state", () => {
    expect(nextHeaderCollapsed(24, false)).toBe(false); // not strictly > 24
    expect(nextHeaderCollapsed(10, false)).toBe(false);
    expect(nextHeaderCollapsed(0, false)).toBe(false);
  });

  it("stays collapsed across the hysteresis band [8, 24]", () => {
    expect(nextHeaderCollapsed(24, true)).toBe(true);
    expect(nextHeaderCollapsed(12, true)).toBe(true);
    expect(nextHeaderCollapsed(8, true)).toBe(true);  // not strictly < 8
  });

  it("expands only when back under 8", () => {
    expect(nextHeaderCollapsed(7, true)).toBe(false);
    expect(nextHeaderCollapsed(0, true)).toBe(false);
  });

  it("no flicker: a single 24→8 round trip flips state exactly once each way", () => {
    let c = false;
    c = nextHeaderCollapsed(30, c); expect(c).toBe(true);   // collapse
    c = nextHeaderCollapsed(20, c); expect(c).toBe(true);   // band — hold
    c = nextHeaderCollapsed(15, c); expect(c).toBe(true);   // band — hold
    c = nextHeaderCollapsed(5, c);  expect(c).toBe(false);  // expand
    c = nextHeaderCollapsed(15, c); expect(c).toBe(false);  // band — hold
    c = nextHeaderCollapsed(25, c); expect(c).toBe(true);   // collapse
  });
});

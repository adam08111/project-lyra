import { describe, it, expect } from "vitest";
import { bubblePosition, cardPosition } from "../src/components/WordLookup.jsx";

// A typical phone visual viewport (no zoom — pinch is disabled app-wide).
const VW = 390, VH = 844;

describe("bubblePosition — 📖 bubble sits below the selection, clamped on-screen", () => {
  it("anchors just below a mid-screen selection", () => {
    const p = bubblePosition({ x: 200, yBottom: 400 }, VW, VH);
    expect(p.top).toBe(410);            // yBottom + 10, below the selection (§24)
    expect(p.left).toBe(140);           // x - 60, centred-ish
  });

  it("clamps near the BOTTOM so it stays on-screen (never below vh-48)", () => {
    const p = bubblePosition({ x: 200, yBottom: 840 }, VW, VH);
    expect(p.top).toBe(VH - 48);        // 796 — the bug-C concern: still visible
    expect(p.top + 44).toBeLessThanOrEqual(VH); // 44px button fits within viewport
  });

  it("clamps the left edge (selection near left margin)", () => {
    const p = bubblePosition({ x: 10, yBottom: 300 }, VW, VH);
    expect(p.left).toBe(8);             // Math.max(8, 10-60) = 8
  });

  it("clamps the right edge (selection near right margin)", () => {
    const p = bubblePosition({ x: 380, yBottom: 300 }, VW, VH);
    expect(p.left).toBe(VW - 130);      // 260 — stays fully on-screen
  });
});

describe("cardPosition — definition card below the selection, clamped", () => {
  it("anchors below a mid-screen selection", () => {
    const p = cardPosition({ x: 200, yBottom: 400 }, VW, VH);
    expect(p.top).toBe(412);            // yBottom + 12
    expect(p.left).toBe(50);            // x - 150
  });

  it("clamps the top so a tall card stays in view near the bottom", () => {
    const p = cardPosition({ x: 200, yBottom: 800 }, VW, VH);
    expect(p.top).toBe(VH - 260);       // 584 — leaves room for the card body
  });

  it("never goes off the left/right edges", () => {
    expect(cardPosition({ x: 5, yBottom: 300 }, VW, VH).left).toBe(12);
    expect(cardPosition({ x: 385, yBottom: 300 }, VW, VH).left).toBe(VW - 312); // 78
  });

  it("degrades gracefully on a very narrow viewport (clamps don't invert)", () => {
    const p = cardPosition({ x: 100, yBottom: 100 }, 200, 300);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.top).toBeGreaterThanOrEqual(12);
  });
});

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

// Card width mirrors the component: min(360, vw - 32), box-sizing border-box.
// §40: gutter widened 12→16px each side so the × clears the phone edge / iOS swipe zone.
const cardW = (vw) => Math.min(360, vw - 32);

describe("cardPosition — card sits a 16px gutter off the screen edge (× reachable by finger)", () => {
  const cases = [
    { name: "mid-screen", vw: 390, vh: 844, x: 200, yBottom: 400 },
    { name: "far-left selection", vw: 390, vh: 844, x: 5, yBottom: 300 },
    { name: "far-right selection", vw: 390, vh: 844, x: 385, yBottom: 300 },
    { name: "bottom-of-screen", vw: 390, vh: 844, x: 200, yBottom: 820 },
    { name: "narrow phone 320", vw: 320, vh: 700, x: 300, yBottom: 200 },
    { name: "very narrow 280", vw: 280, vh: 600, x: 270, yBottom: 100 },
  ];
  for (const c of cases) {
    it(`${c.name}: width ≤ vw-32, left ≥ 16, RIGHT edge ≤ vw-16`, () => {
      const w = cardW(c.vw);
      const p = cardPosition({ x: c.x, yBottom: c.yBottom }, c.vw, c.vh, w);
      expect(p.width).toBeLessThanOrEqual(c.vw - 32);
      expect(p.left).toBeGreaterThanOrEqual(16);
      expect(p.left + p.width).toBeLessThanOrEqual(c.vw - 16); // right edge off the screen edge
      expect(p.top).toBeGreaterThanOrEqual(12);
      expect(p.top).toBeLessThanOrEqual(Math.max(12, c.vh - 260));
    });
  }

  it("anchors below the selection when there's room (yBottom + 12)", () => {
    expect(cardPosition({ x: 200, yBottom: 400 }, 390, 844, cardW(390)).top).toBe(412);
  });

  it("caps width at 360 on a wide desktop viewport, still on-screen", () => {
    const p = cardPosition({ x: 600, yBottom: 300 }, 1200, 800, cardW(1200));
    expect(p.width).toBe(360);
    expect(p.left + p.width).toBeLessThanOrEqual(1200 - 16);
  });
});

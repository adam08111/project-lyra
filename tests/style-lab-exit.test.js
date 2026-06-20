import { describe, it, expect } from "vitest";
import { styleLabBackExits } from "../src/components/StyleLab.jsx";

describe("styleLabBackExits (§44 model A) — empty history ⇒ the ← backs out of Style Lab", () => {
  it("returns true when there is no tab history (← exits Style Lab)", () => {
    expect(styleLabBackExits([])).toBe(true);
  });
  it("returns false when there is at least one earlier tab (← steps back a tab)", () => {
    expect(styleLabBackExits(["analyze"])).toBe(false);
    expect(styleLabBackExits(["analyze", "saved"])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { pushTabHistory, popTabHistory, styleLabBackExits, TAB_HISTORY_CAP } from "../src/components/StyleLab.jsx";

describe("pushTabHistory (§44) — record the tab being left on a switch", () => {
  it("pushes the leaving tab when switching to a different tab", () => {
    expect(pushTabHistory([], "analyze", "saved")).toEqual(["analyze"]);
    expect(pushTabHistory(["analyze"], "saved", "report")).toEqual(["analyze", "saved"]);
  });
  it("collapses consecutive duplicates — a same-tab switch pushes nothing (same ref)", () => {
    const h = ["analyze"];
    expect(pushTabHistory(h, "saved", "saved")).toBe(h);
  });
  it("caps the stack at TAB_HISTORY_CAP, dropping the oldest entry", () => {
    const full = Array.from({ length: TAB_HISTORY_CAP }, (_, i) => `t${i}`);
    const next = pushTabHistory(full, "leaving", "to");
    expect(next).toHaveLength(TAB_HISTORY_CAP);
    expect(next[0]).toBe("t1");                    // oldest dropped
    expect(next[next.length - 1]).toBe("leaving"); // newest kept
  });
});

describe("popTabHistory (§44) — step back to the previous tab", () => {
  it("pops the most-recent tab and returns the shortened history", () => {
    expect(popTabHistory(["analyze", "saved"])).toEqual({ tab: "saved", history: ["analyze"] });
    expect(popTabHistory(["analyze"])).toEqual({ tab: "analyze", history: [] });
  });
  it("returns null on an empty stack (the signal that ← should exit)", () => {
    expect(popTabHistory([])).toBeNull();
  });
});

describe("styleLabBackExits (§44) — the exit-vs-tab-back decision (history empty ⇒ exit)", () => {
  it("empty history ⇒ the ← backs out of Style Lab", () => {
    expect(styleLabBackExits([])).toBe(true);
  });
  it("non-empty history ⇒ the ← steps back a tab", () => {
    expect(styleLabBackExits(["analyze"])).toBe(false);
    expect(styleLabBackExits(["analyze", "saved"])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { styleLabBackLabel, nextStyleLabStack } from "../src/components/StyleLab.jsx";

describe("styleLabBackLabel (§45) — contextual back-chevron label = the destination", () => {
  it("names the X-Ray root at the floor", () => {
    expect(styleLabBackLabel("analyze")).toBe("X-Ray");
  });
  it("names workspace tabs", () => {
    expect(styleLabBackLabel("saved")).toBe("Saved");
    expect(styleLabBackLabel("skills")).toBe("Writers");
    expect(styleLabBackLabel("achievements")).toBe("Achievements");
    expect(styleLabBackLabel("report")).toBe("Report");
  });
  it("falls back to 'Back' for an unknown key", () => {
    expect(styleLabBackLabel("mystery")).toBe("Back");
    expect(styleLabBackLabel(undefined)).toBe("Back");
  });
});

describe("nextStyleLabStack (§45) — view-stack tab navigation", () => {
  it("pushes a new tab onto the stack", () => {
    expect(nextStyleLabStack(["analyze"], "saved")).toEqual(["analyze", "saved"]);
    expect(nextStyleLabStack(["analyze", "achievements"], "report")).toEqual(["analyze", "achievements", "report"]);
  });
  it("re-selecting a tab already in the stack pops back to it (no duplicate)", () => {
    // Achievements → Report → tap Achievements → lands on Achievements
    expect(nextStyleLabStack(["analyze", "achievements", "report"], "achievements")).toEqual(["analyze", "achievements"]);
  });
  it("re-selecting the X-Ray root pops all the way to the floor", () => {
    expect(nextStyleLabStack(["analyze", "saved", "skills"], "analyze")).toEqual(["analyze"]);
  });
  it("is a no-op when the tab is already on top", () => {
    const s = ["analyze", "saved"];
    expect(nextStyleLabStack(s, "saved")).toBe(s);
  });
});

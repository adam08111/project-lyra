import { describe, it, expect } from "vitest";
import { styleLabExitLabel } from "../src/components/StyleLab.jsx";

describe("styleLabExitLabel (§44) — destination-aware Style Lab exit", () => {
  it("names the active writing when one is open", () => {
    expect(styleLabExitLabel("w_1718800000000")).toBe("Back to my writing");
  });

  it("falls back to 'Back' (start screen) when there's no active writing", () => {
    expect(styleLabExitLabel(null)).toBe("Back");
    expect(styleLabExitLabel(undefined)).toBe("Back");
    expect(styleLabExitLabel("")).toBe("Back");
  });
});

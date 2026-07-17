// @vitest-environment happy-dom
//
// BRIEF-PRV / §128 (D-P1/D-P2/D-P3) — the ProofreadPedagogy render. Proves both fields show, a band
// refusal's warm line (routed into nextFocus by the §124 guard) is visible, student-typed text is inert
// (React-default escaping), and absent fields render no empty chrome. The "leads above the tabs" ordering
// is structural in EditorTab (component placed before the tabs) + the operator §5 check.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ProofreadPedagogy from "../src/components/ProofreadPedagogy.jsx";

describe("ProofreadPedagogy — What's working / Next focus", () => {
  it("renders both fields when present (the pedagogy the panel used to discard)", () => {
    const { container } = render(<ProofreadPedagogy strengths="Strong, punchy opening." nextFocus="Vary your sentence length." />);
    expect(container.textContent).toContain("What's working");
    expect(container.textContent).toContain("Strong, punchy opening.");
    expect(container.textContent).toContain("Next focus");
    expect(container.textContent).toContain("Vary your sentence length.");
  });

  it("a band-refusal note in nextFocus is visible (the §124 warm line finally shows)", () => {
    const note = "That's not a piece I can help with — but I'm here for any other writing.";
    const { container } = render(<ProofreadPedagogy strengths="" nextFocus={note} />);
    expect(container.textContent).toContain(note);
    expect(container.textContent).toContain("Next focus");
    expect(container.textContent).not.toContain("What's working");   // absent strengths → no chrome
  });

  it("hostile text renders inert — no live node (D-P3)", () => {
    const XSS = '<img src=x onerror="alert(1)">';
    const { container } = render(<ProofreadPedagogy strengths={XSS} nextFocus="ok" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.textContent).toContain(XSS);   // present as literal text
  });

  it("absent fields render nothing (no empty chrome)", () => {
    const { container } = render(<ProofreadPedagogy strengths="" nextFocus="" />);
    expect(container.textContent).toBe("");
    expect(container.querySelector("div")).toBeNull();
  });
});

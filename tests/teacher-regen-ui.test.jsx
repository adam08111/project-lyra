// @vitest-environment happy-dom
//
// BRIEF-TR — the RegenControl UI. teacherRegenCode mocked (no network). Proves: button → confirm
// dialog (the destructive-action copy) → success shows the code via <CodeDisplay> + the D-M3
// self-regen nudge; a hostile displayName renders as inert text (Class D); the error path is
// retryable (never-stuck); Done discards the code from state.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ regenResult: { status: "ok", code: "TCHR-CODE-1111-2222" } }));
vi.mock("../src/teacher/regen.js", () => ({ teacherRegenCode: () => Promise.resolve(h.regenResult) }));

import RegenControl from "../src/teacher/RegenControl.jsx";

const btn = (c, re) => [...c.querySelectorAll("button")].find((b) => re.test(b.textContent));
const IMG = '<img src=x onerror="alert(1)">';

beforeEach(() => { h.regenResult = { status: "ok", code: "TCHR-CODE-1111-2222" }; });

describe("RegenControl — teacher regen UI", () => {
  it("button → confirm dialog (destructive copy) → success shows the code + the self-regen nudge", async () => {
    const { container } = render(<RegenControl studentId="s1" displayName="Ming" />);
    fireEvent.click(btn(container, /Regenerate recovery code/i));
    expect(container.textContent).toMatch(/old code stops working immediately/i);
    fireEvent.click(btn(container, /Yes, regenerate/i));
    await waitFor(() => expect(container.textContent).toContain("TCHR-CODE-1111-2222"));
    expect(container.textContent).toMatch(/regenerate their own code/i);   // the D-M3 nudge
  });

  it("Class D — a hostile displayName renders as inert text in the confirm dialog, no live node", () => {
    const { container } = render(<RegenControl studentId="s1" displayName={IMG} />);
    fireEvent.click(btn(container, /Regenerate recovery code/i));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.textContent).toContain(IMG);   // present as escaped text
  });

  it("never-stuck — a not-permitted result shows an honest error and stays retryable", async () => {
    h.regenResult = { status: "not-permitted" };
    const { container } = render(<RegenControl studentId="s1" displayName="Ming" />);
    fireEvent.click(btn(container, /Regenerate recovery code/i));
    fireEvent.click(btn(container, /Yes, regenerate/i));
    await waitFor(() => expect(container.textContent).toMatch(/your own classes/i));
    expect(btn(container, /Yes, regenerate/i)).toBeTruthy();   // still on the confirm dialog, retryable
  });

  it("Done discards the shown code from state", async () => {
    const { container } = render(<RegenControl studentId="s1" displayName="Ming" />);
    fireEvent.click(btn(container, /Regenerate recovery code/i));
    fireEvent.click(btn(container, /Yes, regenerate/i));
    await waitFor(() => expect(container.textContent).toContain("TCHR-CODE-1111-2222"));
    fireEvent.click(btn(container, /^Done$/i));
    expect(container.textContent).not.toContain("TCHR-CODE-1111-2222");
  });
});

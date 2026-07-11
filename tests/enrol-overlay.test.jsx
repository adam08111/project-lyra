// @vitest-environment happy-dom
//
// BRIEF-ENROL — the EnrolOverlay. Renders with the client mocked (flag) and enrolStudent mocked
// (no network). Proves: invisible unless configured + not-enrolled; the enter/success/skip states;
// never-stuck on a rejected code; and CLASS D — a hostile display name echoes on the success
// screen as inert TEXT, never a live node.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ configured: true, enrolResult: { ok: true, class: { name: "7B English", teacher: "Ms Wong" } } }));
vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => (h.configured ? {} : null) }));
vi.mock("../src/enrol/enrol.js", () => ({ enrolStudent: () => Promise.resolve(h.enrolResult) }));

import EnrolOverlay from "../src/enrol/EnrolOverlay.jsx";

const IMG = '<img src=x onerror="alert(1)">';

beforeEach(() => {
  h.configured = true;
  h.enrolResult = { ok: true, class: { name: "7B English", teacher: "Ms Wong" } };
  localStorage.clear();
  sessionStorage.clear();
});

function fillCode(container, value) {
  const input = container.querySelector("#enrol-code");
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("EnrolOverlay — visibility gating", () => {
  it("renders nothing when sync is off (flag pin)", () => {
    h.configured = false;
    const { container } = render(<EnrolOverlay userName="Ming" />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when already enrolled", () => {
    localStorage.setItem("lyra-enrol-state", "enrolled");
    const { container } = render(<EnrolOverlay userName="Ming" />);
    expect(container.textContent).toBe("");
  });

  it("shows the enter form with the name prefilled from userName", () => {
    const { container } = render(<EnrolOverlay userName="Ming" />);
    expect(container.querySelector("#enrol-code")).not.toBeNull();
    expect(container.querySelector("#enrol-name").value).toBe("Ming");
    expect(container.textContent).toMatch(/Join your class/i);
  });
});

describe("EnrolOverlay — enrol flow", () => {
  it("on success shows the class + teacher + the recovery-code moment", async () => {
    localStorage.setItem("lyra-recovery-code", "WOLF-2931");
    const { container } = render(<EnrolOverlay userName="Ming" />);
    fillCode(container, "DEMO-CLASS-1");
    fireEvent.click(container.querySelector('button')); // Join class (first button)
    await waitFor(() => expect(container.textContent).toMatch(/You're in/i));
    expect(container.textContent).toContain("7B English");
    expect(container.textContent).toContain("Ms Wong");
    expect(container.textContent).toContain("WOLF-2931");
    expect(localStorage.getItem("lyra-enrol-state")).toBe("enrolled");
  });

  it("CLASS D — a hostile display name echoes on the success screen as inert text, no live node", async () => {
    localStorage.setItem("lyra-recovery-code", "WOLF-2931");
    const { container } = render(<EnrolOverlay userName={IMG} />);
    fillCode(container, "DEMO-CLASS-1");
    fireEvent.click(container.querySelector('button'));
    await waitFor(() => expect(container.textContent).toMatch(/You're in/i));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.textContent).toContain(IMG); // present as escaped text
  });

  it("never-stuck: a rejected code shows an honest, retryable error and stays on the form", async () => {
    h.enrolResult = { ok: false, reason: "not-recognised" };
    const { container } = render(<EnrolOverlay userName="Ming" />);
    fillCode(container, "NOPE");
    fireEvent.click(container.querySelector('button'));
    await waitFor(() => expect(container.textContent).toMatch(/couldn't find that class code/i));
    expect(container.querySelector("#enrol-code")).not.toBeNull(); // still on the enter form
    expect(localStorage.getItem("lyra-enrol-state")).toBeNull();   // not marked enrolled
  });

  it("Skip for now collapses to a re-openable pill and does not mark enrolled", () => {
    const { container } = render(<EnrolOverlay userName="Ming" />);
    const btn = (re) => [...container.querySelectorAll("button")].find((b) => re.test(b.textContent));
    fireEvent.click(btn(/Skip for now/i));
    const pill = btn(/Join your class/i);
    expect(pill).toBeTruthy();                                       // collapsed to the pill
    expect(container.querySelector("#enrol-code")).toBeNull();       // form gone
    expect(sessionStorage.getItem("lyra-enrol-skipped")).toBe("1");
    expect(localStorage.getItem("lyra-enrol-state")).toBeNull();
    // Re-open from the pill returns to the form.
    fireEvent.click(pill);
    expect(container.querySelector("#enrol-code")).not.toBeNull();
  });
});

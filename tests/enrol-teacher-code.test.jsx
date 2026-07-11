// @vitest-environment happy-dom
//
// BRIEF-ENROL D-L6 — the class code renders in the teacher Dashboard header so a teacher can put
// it on the board. It is operator-set (lower risk than a student-typed name), but it still renders
// as an inert React text child — prove it (Class D), and prove the enrol hint shows.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ classes: null, roster: null }));
vi.mock("../src/teacher/queries.js", () => ({
  myClasses: () => Promise.resolve(h.classes),
  roster: () => Promise.resolve(h.roster),
  studentDetail: () => Promise.resolve({ ok: true, data: { ruleFrequency: [], profile: null, lastRegenAt: null, activityByType: {} } }),
}));

import Dashboard from "../src/teacher/Dashboard.jsx";

const IMG = '<img src=x onerror="alert(1)">';

beforeEach(() => {
  h.classes = { ok: true, data: [{ id: "c1", name: "7B English", class_code: "DEMO-CLASS-1", studentCount: 3 }] };
  h.roster = { ok: true, data: [] };
});

describe("Dashboard — class code header (D-L6)", () => {
  it("shows the class code with the enrol hint", async () => {
    const { container } = render(<Dashboard teacher={{ display_name: "Ms Wong" }} onSignOut={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain("DEMO-CLASS-1"));
    expect(container.textContent).toMatch(/students enrol with this/i);
  });

  it("CLASS D — a hostile class code renders as inert text, no live node", async () => {
    h.classes = { ok: true, data: [{ id: "c1", name: "7B", class_code: IMG, studentCount: 0 }] };
    const { container } = render(<Dashboard teacher={{ display_name: "Ms Wong" }} onSignOut={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain(IMG));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });
});

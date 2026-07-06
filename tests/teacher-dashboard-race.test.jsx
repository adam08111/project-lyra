// @vitest-environment happy-dom
//
// §107 (review follow-up) — regression test for the stale-response race the adversarial
// review found: switching class while a roster load is in flight must NOT let the older
// class's response land last and pin the wrong students under the new class. Deterministic:
// we control the resolve ORDER with manual deferreds (no real timing), so it can't flake.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";

vi.mock("../src/teacher/queries.js", () => ({ myClasses: vi.fn(), roster: vi.fn(), studentDetail: vi.fn() }));
import { myClasses, roster } from "../src/teacher/queries.js";
import Dashboard from "../src/teacher/Dashboard.jsx";

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => vi.clearAllMocks());

describe("§107 Dashboard — class-switch stale-response guard", () => {
  it("a stale earlier roster response cannot overwrite the newer class's roster", async () => {
    myClasses.mockResolvedValue({ ok: true, data: [
      { id: "c1", name: "Class One", studentCount: 1 },
      { id: "c2", name: "Class Two", studentCount: 1 },
    ] });
    const dA = deferred();
    const dB = deferred();
    roster.mockImplementation((id) => (id === "c1" ? dA.promise : dB.promise));

    await act(async () => {
      render(<Dashboard teacher={{ display_name: "Ms T" }} onSignOut={() => {}} />);
    });

    // classes loaded → the <select> is present; c1's roster (dA) is in flight.
    const select = await screen.findByRole("combobox");

    // switch to c2 while c1 is still loading → loadRoster(c2) supersedes.
    await act(async () => { fireEvent.change(select, { target: { value: "c2" } }); });

    // Resolve the NEWER class first, then the stale earlier one LAST.
    await act(async () => {
      dB.resolve({ ok: true, data: [{ studentId: "b1", displayName: "BravoStudent", counts: {}, total: 0 }] });
    });
    await act(async () => {
      dA.resolve({ ok: true, data: [{ studentId: "a1", displayName: "AlphaStudent", counts: {}, total: 0 }] });
    });

    // The guard drops the stale c1 response: class two's student stays, class one's never appears.
    expect(screen.getByText("BravoStudent")).toBeTruthy();
    expect(screen.queryByText("AlphaStudent")).toBeNull();
  });
});

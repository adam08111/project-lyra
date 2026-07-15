// @vitest-environment happy-dom
//
// BRIEF-112 — the RecoveryModal. Client mocked (flag pin) + the recovery lib mocked (no network).
// Proves: invisible when sync is off (even if the open event fires); opens on the Sidebar trigger
// event into "Your code" (reusing CodeDisplay) with the teacher line; the regenerate confirm step;
// the §99 D8 auto-open into claim mode; never-stuck on a rejected code; and no rule-scaffolding leaks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

const h = vi.hoisted(() => ({ configured: true, code: "WOLF-2931-ABCD-EFGH", regenResult: "FRSH-CODE-1111-2222", claimResult: false }));

vi.mock("../src/supabase-client.js", () => ({ getSupabase: () => (h.configured ? {} : null) }));
vi.mock("../src/recovery/recovery.js", () => ({
  currentCode: () => h.code,
  regenerate: () => Promise.resolve(h.regenResult),
  claim: () => Promise.resolve(h.claimResult),
}));

import RecoveryModal from "../src/recovery/RecoveryModal.jsx";

const btn = (container, re) => [...container.querySelectorAll("button")].find((b) => re.test(b.textContent));
const openViaEvent = () => act(() => { window.dispatchEvent(new CustomEvent("lyra:open-recovery")); });

beforeEach(() => {
  h.configured = true; h.code = "WOLF-2931-ABCD-EFGH"; h.regenResult = "FRSH-CODE-1111-2222"; h.claimResult = false;
  localStorage.clear();
  sessionStorage.clear();
  delete window.lyraSync;
});

describe("RecoveryModal — visibility", () => {
  it("renders nothing when sync is off, even if the open event fires (D-G4)", () => {
    h.configured = false;
    const { container } = render(<RecoveryModal />);
    openViaEvent();
    expect(container.textContent).toBe("");
  });

  it("renders nothing until opened", () => {
    const { container } = render(<RecoveryModal />);
    expect(container.textContent).toBe("");
  });
});

describe("RecoveryModal — Your code view", () => {
  it("opens on the trigger event and shows the device's code + the teacher line", () => {
    const { container } = render(<RecoveryModal />);
    openViaEvent();
    expect(container.textContent).toMatch(/Your recovery code/i);
    expect(container.textContent).toContain("WOLF-2931-ABCD-EFGH");
    expect(container.textContent).toMatch(/ask your teacher/i);
  });

  it("regenerate takes a confirm step, then shows the fresh code", async () => {
    const { container } = render(<RecoveryModal />);
    openViaEvent();
    fireEvent.click(btn(container, /^Make a new code/i));
    expect(container.textContent).toMatch(/old code will stop working/i);
    fireEvent.click(btn(container, /Yes, make a new code/i));
    await waitFor(() => expect(container.textContent).toContain("FRSH-CODE-1111-2222"));
  });
});

describe("RecoveryModal — §99 D8 fork interstitial", () => {
  it("auto-opens in claim mode on the lyra:identity-changed event (the async-boot bridge)", () => {
    const { container } = render(<RecoveryModal />);
    // Production ordering: the modal mounts first, then initSync fires the event AFTER the network.
    act(() => { window.dispatchEvent(new CustomEvent("lyra:identity-changed")); });
    expect(container.textContent).toMatch(/different student/i);
    expect(container.querySelector("#recovery-code")).not.toBeNull();
  });

  it("auto-opens on mount when the fork session-flag is already set (a later remount)", () => {
    sessionStorage.setItem("lyra-fork-pending", "1");
    const { container } = render(<RecoveryModal />);
    expect(container.textContent).toMatch(/different student/i);
  });

  it("remembers 'Continue as new' — does not re-open on a later fork signal", () => {
    sessionStorage.setItem("lyra-fork-pending", "1");
    const { container } = render(<RecoveryModal />);
    fireEvent.click(btn(container, /Continue as new/i));
    expect(container.textContent).toBe("");
    expect(sessionStorage.getItem("lyra-fork-ack")).toBe("1");
    act(() => { window.dispatchEvent(new CustomEvent("lyra:identity-changed")); });
    expect(container.textContent).toBe("");   // stays closed — acknowledged
  });
});

describe("RecoveryModal — Use a code (claim)", () => {
  it("never-stuck: a rejected code shows an honest, retryable error and stays on the form", async () => {
    h.claimResult = false;
    const { container } = render(<RecoveryModal />);
    openViaEvent();
    fireEvent.click(btn(container, /Have a code from another device/i));
    fireEvent.change(container.querySelector("#recovery-code"), { target: { value: "NOPE" } });
    fireEvent.click(btn(container, /Bring my work back/i));
    await waitFor(() => expect(container.textContent).toMatch(/wasn't recognised/i));
    expect(container.querySelector("#recovery-code")).not.toBeNull();
  });
});

describe("RecoveryModal — copy discipline (CLAUDE.md #4)", () => {
  it("student-facing copy carries no rule scaffolding tokens", () => {
    const { container } = render(<RecoveryModal />);
    openViaEvent();
    const t = container.textContent;
    for (const tok of ["D-G", "BRIEF", "§", "RPC", "lyraSync", "current_student_id", "claim_student"]) {
      expect(t).not.toContain(tok);
    }
  });
});

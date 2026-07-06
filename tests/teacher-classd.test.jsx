// @vitest-environment happy-dom
//
// §107 Class D — CHARACTERIZATION test. Renders the teacher views with HOSTILE strings in
// every student-derived field and proves React default escaping neutralizes them: the
// literal text is present, but NO live element (img/script/anchor) materializes. This is
// the render-side proof that the dashboard cannot be used to run one student's payload in a
// teacher's session. (Per-file happy-dom env; the rest of the suite stays node-env.)
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RosterTable from "../src/teacher/RosterTable.jsx";
import StudentDetailView from "../src/teacher/StudentDetailView.jsx";

const IMG = '<img src=x onerror="alert(1)">';
const SCRIPT = "<script>alert(document.cookie)</script>";
const JS_URL = "javascript:alert(1)";

function assertNoLiveInjection(container) {
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("a")).toBeNull();               // we never render anchors in v1
  expect(container.querySelector("[onerror]")).toBeNull();
}

describe("§107 Class D — RosterTable escapes hostile display names", () => {
  it("renders a hostile display_name as text, not HTML", () => {
    const rows = [{ studentId: "s1", displayName: IMG, counts: { grammar: 2 }, total: 2 }];
    const { container } = render(<RosterTable rows={rows} onOpen={() => {}} />);
    assertNoLiveInjection(container);
    expect(container.textContent).toContain(IMG); // the literal markup shows as text
  });
});

describe("§107 Class D — StudentDetailView escapes hostile profile + rule fields", () => {
  const detail = {
    ruleFrequency: [{ rule: SCRIPT, occurrences: 4, first_seen: "2026-06-01", last_seen: "2026-07-01" }],
    profile: {
      studentName: IMG, // deliberately NOT rendered, but present to prove it can't leak
      level: { name: IMG, trajectory: "rising", bandEstimate: "Band 4", summary: JS_URL },
      strengths: [{ id: "a", label: SCRIPT }],
      weaknesses: [{ id: "b", label: IMG, occurrences: 3, status: "active", prescription: { en: SCRIPT } }],
      sections: { growth: { en: IMG } },
    },
    lastRegenAt: "2026-07-05",
    activityByType: { grammar: 5 },
  };

  it("renders every hostile field as inert text, no live node", () => {
    const { container } = render(<StudentDetailView displayName={IMG} detail={detail} onBack={() => {}} />);
    assertNoLiveInjection(container);
    // The hostile strings are present as escaped text somewhere in the DOM.
    expect(container.textContent).toContain(IMG);
    expect(container.textContent).toContain(SCRIPT);
    expect(container.textContent).toContain(JS_URL);
  });

  it("renders the band estimate labelled as an estimate (D-B1)", () => {
    const { container } = render(<StudentDetailView displayName="Amy" detail={detail} onBack={() => {}} />);
    expect(container.textContent).toMatch(/estimate/i);
    expect(container.textContent).toContain("Band 4");
  });

  it("does NOT render profile.studentName (the highest-risk raw field is omitted entirely)", () => {
    // displayName here is a safe roster name; studentName in the profile is hostile. The
    // heading must show the roster name, and studentName must not add a second occurrence.
    const safe = { ...detail, profile: { ...detail.profile, level: { bandEstimate: "Band 4" }, strengths: [], weaknesses: [], sections: null } };
    const { container } = render(<StudentDetailView displayName="Ms Roster Name" detail={safe} onBack={() => {}} />);
    expect(container.textContent).toContain("Ms Roster Name");
    expect(container.textContent).not.toContain(IMG); // studentName (=IMG) never rendered
  });

  it("renders an honest empty state when there is no profile / no rules", () => {
    const empty = { ruleFrequency: [], profile: null, lastRegenAt: null, activityByType: {} };
    const { container } = render(<StudentDetailView displayName="Amy" detail={empty} onBack={() => {}} />);
    expect(container.textContent).toMatch(/No growth report yet/i);
    expect(container.textContent).toMatch(/No grammar rules logged yet/i);
  });
});

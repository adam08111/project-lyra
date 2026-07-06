import { describe, it, expect, vi, beforeEach } from "vitest";

// §107 — teacher read queries against a MOCKED Supabase client (no network). The mock's
// query builder is a chainable thenable: select/order/eq/in/limit all return the builder,
// and awaiting it resolves to the per-table { data, error } configured for the test.
vi.mock("../src/teacher/teacher-client.js", () => ({ getTeacherClient: vi.fn() }));

import { getTeacherClient } from "../src/teacher/teacher-client.js";
import { myClasses, roster, studentDetail } from "../src/teacher/queries.js";

function makeClient(tables) {
  const build = (resp) => {
    const b = {
      select: () => b, order: () => b, eq: () => b, in: () => b, limit: () => b,
      then: (res) => res(resp),
    };
    return b;
  };
  return { from: (t) => build(tables[t] || { data: [], error: null }) };
}

beforeEach(() => { getTeacherClient.mockReset(); });

describe("teacher queries — myClasses()", () => {
  it("→ classes with enrolment counts", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      classes: { data: [{ id: "c1", name: "3B" }, { id: "c2", name: "3A" }], error: null },
      enrolments: { data: [{ class_id: "c1" }, { class_id: "c1" }, { class_id: "c2" }], error: null },
    }));
    const r = await myClasses();
    expect(r).toEqual({ ok: true, data: [
      { id: "c1", name: "3B", studentCount: 2 },
      { id: "c2", name: "3A", studentCount: 1 },
    ] });
  });

  it("→ empty list when the teacher has no classes", async () => {
    getTeacherClient.mockReturnValue(makeClient({ classes: { data: [], error: null } }));
    expect(await myClasses()).toEqual({ ok: true, data: [] });
  });

  it("→ query-failed when the classes select errors", async () => {
    getTeacherClient.mockReturnValue(makeClient({ classes: { data: null, error: { code: "42501" } } }));
    expect(await myClasses()).toEqual({ ok: false, error: "query-failed" });
  });

  it("→ not-configured when Supabase is off", async () => {
    getTeacherClient.mockReturnValue(null);
    expect(await myClasses()).toEqual({ ok: false, error: "not-configured" });
  });
});

describe("teacher queries — roster()", () => {
  it("→ rows with per-type event counts", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      enrolments: { data: [{ student_id: "s1", display_name: "Amy" }, { student_id: "s2", display_name: "Ben" }], error: null },
      learning_events: { data: [
        { student_id: "s1", type: "grammar" }, { student_id: "s1", type: "grammar" },
        { student_id: "s1", type: "structure" }, { student_id: "s2", type: "vocabulary" },
      ], error: null },
    }));
    const r = await roster("c1");
    expect(r.ok).toBe(true);
    expect(r.data).toEqual([
      { studentId: "s1", displayName: "Amy", counts: { grammar: 2, structure: 1 }, total: 3 },
      { studentId: "s2", displayName: "Ben", counts: { vocabulary: 1 }, total: 1 },
    ]);
  });

  it("→ empty rows for an empty class (and does not error)", async () => {
    getTeacherClient.mockReturnValue(makeClient({ enrolments: { data: [], error: null } }));
    expect(await roster("c1")).toEqual({ ok: true, data: [] });
  });

  it("→ query-failed when the events select errors", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      enrolments: { data: [{ student_id: "s1", display_name: "Amy" }], error: null },
      learning_events: { data: null, error: { code: "500" } },
    }));
    expect(await roster("c1")).toEqual({ ok: false, error: "query-failed" });
  });
});

describe("teacher queries — studentDetail()", () => {
  it("→ rule frequency + profile + activity counts", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      student_rule_frequency: { data: [
        { rule: "Tense", occurrences: 3, first_seen: "2026-06-01", last_seen: "2026-07-01" },
        { rule: "Articles", occurrences: 1, first_seen: "2026-06-10", last_seen: "2026-06-10" },
      ], error: null },
      growth_profiles: { data: [{ profile: { level: { name: "Developing Writer", bandEstimate: "Band 4" } }, last_regen_at: "2026-07-05" }], error: null },
      learning_events: { data: [{ type: "grammar" }, { type: "grammar" }, { type: "structure" }], error: null },
    }));
    const r = await studentDetail("s1");
    expect(r.ok).toBe(true);
    expect(r.data.ruleFrequency).toHaveLength(2);
    expect(r.data.profile.level.bandEstimate).toBe("Band 4");
    expect(r.data.lastRegenAt).toBe("2026-07-05");
    expect(r.data.activityByType).toEqual({ grammar: 2, structure: 1 });
  });

  it("→ profile:null (honest empty) when the student has no growth profile", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      student_rule_frequency: { data: [], error: null },
      growth_profiles: { data: [], error: null },
      learning_events: { data: [], error: null },
    }));
    const r = await studentDetail("s1");
    expect(r).toEqual({ ok: true, data: { ruleFrequency: [], profile: null, lastRegenAt: null, activityByType: {} } });
  });

  it("→ query-failed when any of the three reads errors", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      student_rule_frequency: { data: [], error: null },
      growth_profiles: { data: null, error: { code: "500" } },
      learning_events: { data: [], error: null },
    }));
    expect(await studentDetail("s1")).toEqual({ ok: false, error: "query-failed" });
  });

  it("→ not-configured when Supabase is off", async () => {
    getTeacherClient.mockReturnValue(null);
    expect(await studentDetail("s1")).toEqual({ ok: false, error: "not-configured" });
  });
});

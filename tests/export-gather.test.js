// @vitest-environment happy-dom
//
// BRIEF-116 / §127 — GATHER. Local-first: reads the on-device corpus (authoritative); enriches with
// own-RLS snapshots when sync is on; a network failure folds into an honest "not included", never a
// throw (#7). Security: D-O1/D-O4 — bandEstimate stripped from every profile/report; NO snapshot
// query selects student_id; the recovery/id/class keys are never read. getSupabase is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ client: null }));
vi.mock("../src/supabase-client.js", async (importOriginal) => ({ ...(await importOriginal()), getSupabase: () => h.client }));

import { gatherCorpus } from "../src/export/gather.js";
import { GROWTH_PROFILE_KEY } from "../src/growth-report.js";

function seed({ projects, grammarLog, growth } = {}) {
  if (projects) localStorage.setItem("lyra-projects", JSON.stringify(projects));
  if (grammarLog) localStorage.setItem("grammar-log", JSON.stringify(grammarLog));
  if (growth) localStorage.setItem(GROWTH_PROFILE_KEY, JSON.stringify(growth));
}
const oneWriting = [{ id: "d", name: "My Writings", writings: [{ id: "w1", title: "Essay", topic: "Phones", draft: "Hello there.", updatedAt: 1720569600000 }] }];

beforeEach(() => { h.client = null; localStorage.clear(); });

describe("gatherCorpus", () => {
  it("flag-off — reads local writings/learning/growth; no snapshots; honest device-only omission", async () => {
    seed({ projects: oneWriting, grammarLog: [{ rule: "SVA", phrase: "he go", correction: "he goes" }] });
    const { corpus, included, omitted } = await gatherCorpus();
    expect(corpus.writings).toHaveLength(1);
    expect(corpus.writings[0].title).toBe("Essay");
    expect(corpus.learning.total).toBe(1);
    expect(corpus.snapshots).toBeNull();
    expect(included).toContain("1 writing");
    expect(omitted.join(" ")).toMatch(/device/);
  });

  it("D-O1 — strips the teacher-only bandEstimate from the growth profile", async () => {
    seed({ growth: { studentName: "Ming", level: { name: "Developing", bandEstimate: "Band 4", summary: "ok" } } });
    const { corpus } = await gatherCorpus();
    expect(corpus.growth.level.bandEstimate).toBeUndefined();
    expect(corpus.growth.level.name).toBe("Developing");
    expect(JSON.stringify(corpus)).not.toContain("Band 4");
  });

  it("D-O4 — never reads or embeds the recovery code, the device student-id key, or class codes", async () => {
    localStorage.setItem("lyra-recovery-code", "ABCD-EFGH-JKLM-NPQR");
    localStorage.setItem("lyra-sb-student-id", "auth-uuid-abc-123");
    localStorage.setItem("lyra-class-code", "CLASS99");
    seed({ projects: oneWriting, growth: { studentName: "Ming", level: { name: "Dev" } } });
    const { corpus } = await gatherCorpus();
    const json = JSON.stringify(corpus);
    expect(json).not.toContain("ABCD-EFGH-JKLM-NPQR");
    expect(json).not.toContain("auth-uuid-abc-123");
    expect(json).not.toContain("CLASS99");
  });

  it("never-stuck — a snapshot read failure folds into 'not included', local content survives", async () => {
    h.client = { from: () => { throw new Error("boom"); } };
    seed({ projects: oneWriting });
    const { corpus, omitted } = await gatherCorpus();
    expect(corpus.writings).toHaveLength(1);          // local, still there
    expect(corpus.snapshots).toBeNull();              // both reads failed
    expect(omitted.join(" ")).toMatch(/couldn't reach/);
  });

  it("flag-on — enriches with own-RLS snapshots, strips report bandEstimate, NEVER selects student_id", async () => {
    const selects = [];
    const wsRows = [{ writing_id: "w1", content: "draft v1", trigger: "proofread", deleted: false, ts: "2026-07-01T00:00:00Z" }];
    const rsRows = [{ report: { level: { name: "Dev", bandEstimate: "Band 4" } }, trigger: "regen", ts: "2026-07-02T00:00:00Z" }];
    h.client = {
      from: (table) => ({
        select: (cols) => { selects.push(cols); return { order: () => ({ range: async (from) => ({ data: from === 0 ? (table === "writing_snapshots" ? wsRows : rsRows) : [], error: null }) }) }; },
      }),
    };
    seed({ projects: oneWriting });
    const { corpus, included } = await gatherCorpus();
    expect(corpus.snapshots.writings).toHaveLength(1);
    expect(corpus.snapshots.writings[0].writingId).toBe("w1");
    expect(corpus.snapshots.reports).toHaveLength(1);
    expect(corpus.snapshots.reports[0].report.level.bandEstimate).toBeUndefined();  // stripped
    expect(JSON.stringify(corpus)).not.toContain("Band 4");
    for (const cols of selects) expect(cols).not.toContain("student_id");            // D-O4
    expect(included.join(" ")).toMatch(/saved draft version/);
  });
});

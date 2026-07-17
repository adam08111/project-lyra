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
import { composeExport } from "../src/export/compose.js";
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

  it("D-O1 — strips bandEstimate from the profile AND the per-regen history[] trajectory (§127 review)", async () => {
    seed({ growth: {
      studentName: "Ming",
      level: { name: "Developing", bandEstimate: "Band 4", summary: "ok" },
      history: [
        { date: "2026-06-01T00:00:00Z", levelName: "Emerging", bandEstimate: "Band 3", activeWeaknessCount: 5 },
        { date: "2026-07-01T00:00:00Z", levelName: "Developing", bandEstimate: "Band 4", activeWeaknessCount: 3 },
      ],
    } });
    const { corpus } = await gatherCorpus();
    expect(corpus.growth.level.bandEstimate).toBeUndefined();
    expect(corpus.growth.level.name).toBe("Developing");
    expect(corpus.growth.history[0].bandEstimate).toBeUndefined();  // the leak the review caught
    expect(corpus.growth.history[1].bandEstimate).toBeUndefined();
    expect(corpus.growth.history[0].levelName).toBe("Emerging");    // non-band fields survive
    expect(JSON.stringify(corpus)).not.toContain("Band 3");
    expect(JSON.stringify(corpus)).not.toContain("Band 4");
  });

  it("end-to-end — a history-bearing profile yields a .html with NO band estimate anywhere (leak closed)", async () => {
    seed({ growth: { studentName: "Ming", level: { name: "Developing", bandEstimate: "Band 4" }, history: [{ levelName: "Emerging", bandEstimate: "Band 3" }] } });
    const { corpus, included, omitted } = await gatherCorpus();
    const html = composeExport(corpus, { included, omitted, date: "2026-07-17T00:00:00Z", dateLabel: "17 July 2026" });
    expect(html).not.toContain("Band 3");
    expect(html).not.toContain("Band 4");
    expect(html).not.toContain("bandEstimate");
  });

  it("never-stuck — a malformed writing updatedAt doesn't throw; the export still succeeds", async () => {
    seed({ projects: [{ id: "d", name: "n", writings: [{ id: "w", title: "T", draft: "hi", updatedAt: "not-a-real-date" }] }] });
    const { corpus } = await gatherCorpus();
    expect(corpus.writings).toHaveLength(1);
    expect(corpus.writings[0].date).toBe("");   // bad date → empty string, never a throw
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
    const rsRows = [{ report: { level: { name: "Dev", bandEstimate: "Band 4" }, history: [{ levelName: "Dev", bandEstimate: "Band 4" }] }, trigger: "regen", ts: "2026-07-02T00:00:00Z" }];
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
    expect(corpus.snapshots.reports[0].report.level.bandEstimate).toBeUndefined();       // stripped
    expect(corpus.snapshots.reports[0].report.history[0].bandEstimate).toBeUndefined();  // history too (§127 review)
    expect(JSON.stringify(corpus)).not.toContain("Band 4");
    for (const cols of selects) expect(cols).not.toContain("student_id");            // D-O4
    expect(included.join(" ")).toMatch(/saved draft version/);
  });

  it("D-P5 — when a snapshot ledger fills the page cap, the contents line says 'most recent 25,000' (no silent cap)", async () => {
    const fullPage = () => Array.from({ length: 1000 }, () => ({ writing_id: "w", content: "x", trigger: "t", deleted: false, ts: "2026-01-01T00:00:00Z" }));
    h.client = { from: (table) => ({ select: () => ({ order: () => ({ range: async () => ({ data: table === "writing_snapshots" ? fullPage() : [], error: null }) }) }) }) };
    seed({ projects: oneWriting });
    const { included } = await gatherCorpus();
    expect(included.join(" | ")).toMatch(/most recent 25,000 saved draft versions/);
  });
});

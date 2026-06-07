import { describe, it, expect } from "vitest";
import { groupReports, consolidateMistakes, buildDelta } from "../src/report-utils.js";

describe("consolidateMistakes — cross-source dedup (accuracy keystone)", () => {
  it("counts ONE mistake logged across grammar-log + report.grammar + before-sentence as one", () => {
    // The exact §11 fixture: the same subject-verb slip appears in all three places.
    const grammarLog = [
      {
        id: "1717000000000_a1",
        rule: "subject-verb agreement",
        phrase: "he go",
        correction: "he goes",
        example_wrong: "He go to the shop.",
        date: "7 Jun 2026",
        source: "coaching",
      },
    ];
    const reports = [
      {
        id: "report_1717000000001_b2",
        date: "2026-06-07T10:00:00.000Z",
        technique: "Short sentence to break a list",
        before: "He go to the shop.", // the same wrong sentence (3rd source)
        after: "He goes to the shop, then stops.",
        skills: [{ skillName: "Short sentence to break a list", studentApplication: "He goes..." }],
        grammar: [{ phrase: "he go", correction: "he goes", rule: "subject-verb agreement" }],
      },
    ];

    const mistakes = consolidateMistakes({ grammarLog, reportClusters: groupReports(reports) });

    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].sources).toEqual(expect.arrayContaining(["grammar-log", "report.grammar"]));
  });

  it("keeps genuinely different mistakes separate", () => {
    const grammarLog = [
      { id: "1717000000000_a1", rule: "subject-verb agreement", phrase: "he go", correction: "he goes", example_wrong: "He go home." },
      { id: "1717000000001_a2", rule: "homophone", phrase: "their", correction: "there", example_wrong: "Their is a cat." },
    ];
    const mistakes = consolidateMistakes({ grammarLog, reportClusters: [] });
    expect(mistakes).toHaveLength(2);
  });
});

describe("groupReports — one card per practice moment", () => {
  it("collapses the same sentence re-logged under different names, keeping the richest report", () => {
    const reports = [
      // a freeform chat dump (richness 0) logged newest
      { id: "report_1717000000002_c1", date: "2026-06-07T12:00:00Z", technique: "The One Person Reset", reportText: "...verbatim chat...", after: "The cafeteria was loud, then Sam sat perfectly still." },
      // the structured report for the SAME sentence
      { id: "report_1717000000001_c2", date: "2026-06-07T11:00:00Z", technique: "Syntactic Whiplash", before: "The cafeteria was loud and very busy.", after: "The cafeteria was loud, then Sam sat perfectly still.", skills: [{ skillName: "Syntactic Whiplash" }], grammar: [{ phrase: "x", correction: "y", rule: "z" }] },
    ];
    const groups = groupReports(reports);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    // the structured report (real gains+mistakes) wins over the chat dump
    expect(groups[0].display.technique).toBe("Syntactic Whiplash");
  });
});

describe("buildDelta — only data newer than `since`", () => {
  it("includes only practices/mistakes after the last regen boundary", () => {
    const reports = [
      { id: "report_1717000000000_old", date: "2026-06-01T00:00:00Z", before: "old sentence one here", after: "old upgraded sentence here", grammar: [{ phrase: "a go", correction: "a goes" }] },
      { id: "report_1717000000999_new", date: "2026-06-07T00:00:00Z", before: "new sentence two here", after: "new upgraded sentence here", grammar: [{ phrase: "c run", correction: "c runs" }] },
    ];
    const since = new Date(1717000000500).toISOString();
    const delta = buildDelta({ reportClusters: groupReports(reports), since });

    expect(delta.practices).toHaveLength(1);
    expect(delta.practices[0].before).toBe("new sentence two here");
    expect(delta.mistakes).toHaveLength(1);
  });
});

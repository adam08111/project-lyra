import { describe, it, expect } from "vitest";
import { groupReports, groupAchievements, consolidateMistakes, buildDelta } from "../src/report-utils.js";
import {
  milestoneImminent,
  effectiveRegenThreshold,
  computeMilestones,
  hasMilestone,
  REGEN_EVERY_N_PRACTICES,
} from "../src/growth-report.js";

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

describe("groupAchievements — one card per technique (Achievements tab)", () => {
  it("folds continued practice on the SAME technique (different sentences) into ONE card", () => {
    // The reported bug: each continued turn had a different example sentence, so
    // groupReports (sentence-moment) made a new card every turn.
    const reports = [
      { id: "report_1717000000003_a", technique: "Painted Style Pictures", after: "The red dress exudes a commanding presence." },
      { id: "report_1717000000002_b", technique: "Painted Style Pictures", after: "The old library breathes a quiet, scholarly calm." },
      { id: "report_1717000000001_c", technique: "Painted Style Pictures", after: "The storm threw a petulant tantrum across the sky." },
    ];
    // groupReports fragments them (different sentences)…
    expect(groupReports(reports).length).toBe(3);
    // …groupAchievements keeps them as ONE technique card.
    const groups = groupAchievements(reports);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].display.technique).toBe("Painted Style Pictures");
  });

  it("keeps DIFFERENT techniques as separate cards", () => {
    const reports = [
      { id: "report_1_a", technique: "Painted Style Pictures", after: "one sentence here about dresses" },
      { id: "report_2_b", technique: "Concession Then Punch", after: "a different sentence about something" },
    ];
    expect(groupAchievements(reports)).toHaveLength(2);
  });

  it("prefers a structured report as the card display over a freeform dump", () => {
    const reports = [
      { id: "report_2_a", technique: "Painted Style Pictures", reportText: "...wall of words...", after: "dress sentence alpha" },
      { id: "report_1_b", technique: "Painted Style Pictures", before: "plain", after: "dress sentence beta", skills: [{ skillName: "Painted Style Pictures" }] },
    ];
    const groups = groupAchievements(reports);
    expect(groups).toHaveLength(1);
    expect(groups[0].display.reportText).toBeUndefined(); // structured one wins
  });

  it("reports with no technique fall back to sentence-moment grouping (no untitled merge)", () => {
    const reports = [
      { id: "report_1_a", after: "the cafeteria was loud and crowded today" },
      { id: "report_2_b", after: "a completely unrelated point about homework load" },
    ];
    // Two unrelated sentences, no technique → must stay two cards, not collapse.
    expect(groupAchievements(reports)).toHaveLength(2);
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

describe("milestoneImminent — eager regen only when the AI flagged a turning point", () => {
  it("is true when any weakness is marked improving", () => {
    expect(milestoneImminent({ weaknesses: [{ id: "a", status: "active" }, { id: "b", status: "improving" }] })).toBe(true);
  });
  it("is true when the trajectory is rising", () => {
    expect(milestoneImminent({ level: { trajectory: "rising" }, weaknesses: [{ id: "a", status: "active" }] })).toBe(true);
  });
  it("is false when nothing is on the verge (active/watch weaknesses, steady level)", () => {
    expect(milestoneImminent({ level: { trajectory: "steady" }, weaknesses: [{ id: "a", status: "active" }, { id: "b", status: "watch" }] })).toBe(false);
  });
  it("is false for an empty/missing profile", () => {
    expect(milestoneImminent(null)).toBe(false);
    expect(milestoneImminent({})).toBe(false);
  });
});

describe("effectiveRegenThreshold — drop the cadence bar to 1 at a turning point", () => {
  it("returns 1 when a milestone is imminent", () => {
    expect(effectiveRegenThreshold({ weaknesses: [{ id: "a", status: "improving" }] })).toBe(1);
  });
  it("returns the normal cadence otherwise", () => {
    expect(effectiveRegenThreshold({ weaknesses: [{ id: "a", status: "active" }] })).toBe(REGEN_EVERY_N_PRACTICES);
  });
});

describe("computeMilestones — what changed since the last report", () => {
  it("flags a level change as a level-up", () => {
    const prev = { level: { name: "Emerging Writer" } };
    const updated = { level: { name: "Developing Writer", name_zh: "發展中的寫作者" } };
    const m = computeMilestones(prev, updated);
    expect(m.leveledUp).toBe(true);
    expect(m.levelFrom).toBe("Emerging Writer");
    expect(m.levelTo).toBe("Developing Writer");
    expect(hasMilestone(m)).toBe(true);
  });

  it("reports a tracked weakness that graduated as resolved", () => {
    const prev = { weaknesses: [{ id: "tense_drift", label: "Tense Drift", status: "improving" }] };
    const updated = {
      weaknesses: [],
      graduated: [{ id: "tense_drift", label: "Tense Drift", label_zh: "時態飄移" }],
    };
    const m = computeMilestones(prev, updated);
    expect(m.resolved).toHaveLength(1);
    expect(m.resolved[0].id).toBe("tense_drift");
    expect(m.resolved[0].label_zh).toBe("時態飄移");
  });

  it("reports a tracked weakness flipped to status resolved", () => {
    const prev = { weaknesses: [{ id: "sva", label: "Subject-Verb", status: "active" }] };
    const updated = { weaknesses: [{ id: "sva", label: "Subject-Verb", status: "resolved" }] };
    expect(computeMilestones(prev, updated).resolved.map((r) => r.id)).toEqual(["sva"]);
  });

  it("never reports a phantom milestone on a cold start (no prior profile)", () => {
    const updated = {
      level: { name: "Emerging Writer" },
      weaknesses: [{ id: "x", status: "resolved" }],
      graduated: [{ id: "y" }],
    };
    const m = computeMilestones({}, updated);
    expect(m.leveledUp).toBe(false);
    expect(m.resolved).toHaveLength(0);
    expect(hasMilestone(m)).toBe(false);
  });

  it("reports no milestone when level and weaknesses are unchanged", () => {
    const prev = { level: { name: "Developing Writer" }, weaknesses: [{ id: "a", status: "active" }] };
    const updated = { level: { name: "Developing Writer" }, weaknesses: [{ id: "a", status: "active" }] };
    expect(hasMilestone(computeMilestones(prev, updated))).toBe(false);
  });
});

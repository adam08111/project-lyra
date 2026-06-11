import { describe, it, expect } from "vitest";
import { upsertSwitchNotice } from "../src/utils.js";
import { swapTitleTypePrefix } from "../src/titleGenerator.js";

describe("upsertSwitchNotice — no stacking", () => {
  const notice = (label) => `Switched to ${label}. I'll coach for that now — the conventions are different.`;

  it("appending twice yields ONE notice (the latest)", () => {
    let msgs = [{ role: "ai", text: "welcome" }];
    msgs = upsertSwitchNotice(msgs, notice("Report"));
    msgs = upsertSwitchNotice(msgs, notice("Story / Narrative"));
    msgs = upsertSwitchNotice(msgs, notice("Exam Essay"));
    expect(msgs).toHaveLength(2);
    expect(msgs[1].text).toContain("Exam Essay");
  });

  it("appends normally when the last message is not a switch notice", () => {
    const msgs = upsertSwitchNotice([{ role: "ai", text: "some coaching" }], notice("Report"));
    expect(msgs).toHaveLength(2);
  });

  it("does not replace a USER message that happens to start similarly", () => {
    const msgs = upsertSwitchNotice([{ role: "user", text: "Switched to Report. I'll coach for that now — ha" }], notice("Exam Essay"));
    expect(msgs).toHaveLength(2);
  });
});

describe("swapTitleTypePrefix — title follows the switch only when auto-generated", () => {
  it("swaps the auto prefix", () => {
    expect(swapTitleTypePrefix("Formal Business Email — Letter to editor about cell phones", "Formal Business Email", "Persuasive Writing"))
      .toBe("Persuasive Writing — Letter to editor about cell phones");
  });

  it("leaves a customised title untouched", () => {
    expect(swapTitleTypePrefix("My masterpiece", "Formal Business Email", "Persuasive Writing")).toBe("My masterpiece");
  });

  it("handles missing labels gracefully", () => {
    expect(swapTitleTypePrefix("Anything", "", "Report")).toBe("Anything");
  });
});

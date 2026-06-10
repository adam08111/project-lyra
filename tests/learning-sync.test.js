import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractLearningData, syncLearningData } from "../src/learning-sync.js";

describe("extractLearningData", () => {
  it("returns displayText unchanged when no learning block", () => {
    const response = "Great work on that sentence! Try adding a fronted adverbial.";
    const { displayText, learningData } = extractLearningData(response);
    expect(displayText).toBe(response);
    expect(learningData).toBeNull();
  });

  it("extracts learning data and strips it from display text", () => {
    const visible = "Nice job using the concession clause!";
    const json = JSON.stringify({
      type: "learning_sync",
      grammar: [{ phrase: "slow bleeds", correction: "slowly bleeds", rule: "Adverb Formation" }],
    });
    const response = `${visible}\n<!--LYRA_LEARNING_DATA\n${json}\nLYRA_LEARNING_DATA-->`;

    const { displayText, learningData } = extractLearningData(response);
    expect(displayText).toBe(visible);
    expect(learningData).not.toBeNull();
    expect(learningData.type).toBe("learning_sync");
    expect(learningData.grammar).toHaveLength(1);
    expect(learningData.grammar[0].correction).toBe("slowly bleeds");
  });

  it("handles malformed JSON gracefully", () => {
    const response = "Good.\n<!--LYRA_LEARNING_DATA\n{bad json\nLYRA_LEARNING_DATA-->";
    const { displayText, learningData } = extractLearningData(response);
    expect(displayText).toBe("Good.");
    expect(learningData).toBeNull();
  });

  it("handles multiline JSON blocks", () => {
    const json = JSON.stringify({
      type: "learning_sync",
      growth: [{ before: "He ran fast.", after: "He sprinted.", technique_used: "Verb upgrade", why_better: "More vivid" }],
      vocabulary_acquired: [{ weak: "ran fast", strong: "sprinted", chinese: "衝刺" }],
    }, null, 2);
    const response = `Well done!\n<!--LYRA_LEARNING_DATA\n${json}\nLYRA_LEARNING_DATA-->`;

    const { displayText, learningData } = extractLearningData(response);
    expect(displayText).toBe("Well done!");
    expect(learningData.growth).toHaveLength(1);
    expect(learningData.vocabulary_acquired).toHaveLength(1);
  });
});

describe("syncLearningData", () => {
  let mockSetGrammarLog;

  beforeEach(() => {
    mockSetGrammarLog = vi.fn();
    // Clear localStorage mocks
    vi.stubGlobal("localStorage", {
      _store: {},
      getItem(key) { return this._store[key] || null; },
      setItem(key, val) { this._store[key] = val; },
    });
  });

  it("does nothing when data is null", () => {
    syncLearningData(null, { setGrammarLog: mockSetGrammarLog, topic: "test" });
    expect(mockSetGrammarLog).not.toHaveBeenCalled();
  });

  it("does nothing when type is not learning_sync", () => {
    syncLearningData({ type: "other" }, { setGrammarLog: mockSetGrammarLog, topic: "test" });
    expect(mockSetGrammarLog).not.toHaveBeenCalled();
  });

  it("syncs grammar entries to setGrammarLog", () => {
    const data = {
      type: "learning_sync",
      grammar: [
        { phrase: "a amazing", correction: "an amazing", rule: "Article Selection", explanation: "Use an before vowels" },
      ],
    };
    syncLearningData(data, { setGrammarLog: mockSetGrammarLog, topic: "test" });
    expect(mockSetGrammarLog).toHaveBeenCalledTimes(1);

    // Call the updater function to verify the entries
    const updater = mockSetGrammarLog.mock.calls[0][0];
    const result = updater([]);
    expect(result).toHaveLength(1);
    expect(result[0].phrase).toBe("a amazing");
    expect(result[0].correction).toBe("an amazing");
    expect(result[0].source).toBe("coaching");
  });

  it("syncs growth entries to localStorage", () => {
    const data = {
      type: "learning_sync",
      growth: [{ before: "It was bad.", after: "It was devastating.", technique_used: "Word upgrade", why_better: "Stronger emotion" }],
    };
    // Provenance is now mandatory: the entry only syncs because `before`
    // traces to a text the student actually typed this session.
    syncLearningData(data, { setGrammarLog: mockSetGrammarLog, topic: "climate", studentTexts: ["It was bad."] });

    const stored = JSON.parse(localStorage.getItem("lyra-growth-log"));
    expect(stored).toHaveLength(1);
    expect(stored[0].before).toBe("It was bad.");
    expect(stored[0].after).toBe("It was devastating.");
    expect(stored[0].topic).toBe("climate");
  });

  it("syncs vocabulary with deduplication", () => {
    // Pre-populate with existing vocab
    localStorage.setItem("lyra-vocabulary", JSON.stringify([
      { id: "v1", strong: "devastating", weak: "bad" },
    ]));

    const data = {
      type: "learning_sync",
      vocabulary_acquired: [
        { weak: "bad", strong: "devastating", chinese: "毀滅性的" }, // duplicate
        { weak: "big", strong: "enormous", chinese: "巨大的" }, // new
      ],
    };
    syncLearningData(data, { setGrammarLog: mockSetGrammarLog, topic: "test" });

    const stored = JSON.parse(localStorage.getItem("lyra-vocabulary"));
    // Should have 2: the new "enormous" + the existing "devastating"
    expect(stored).toHaveLength(2);
    expect(stored.map(v => v.strong).sort()).toEqual(["devastating", "enormous"]);
  });

  it("syncs structures with deduplication", () => {
    localStorage.setItem("lyra-structures", JSON.stringify([
      { id: "s1", name: "The Vice Grip" },
    ]));

    const data = {
      type: "learning_sync",
      structures_learned: [
        { name: "The Vice Grip", description: "dup" }, // duplicate
        { name: "Cold Reality Punch", description: "Short jab", student_example: "test", effect: "shock" }, // new
      ],
    };
    syncLearningData(data, { setGrammarLog: mockSetGrammarLog, topic: "test" });

    const stored = JSON.parse(localStorage.getItem("lyra-structures"));
    expect(stored).toHaveLength(2);
    expect(stored.map(s => s.name).sort()).toEqual(["Cold Reality Punch", "The Vice Grip"]);
  });

  it("syncs skill deployments", () => {
    const data = {
      type: "learning_sync",
      skills_deployed: [
        { skill_name: "Pretense Shattering", source_author: "Marina Hyde", mastery_signal: "partial" },
      ],
    };
    syncLearningData(data, { setGrammarLog: mockSetGrammarLog, topic: "school phones" });

    const stored = JSON.parse(localStorage.getItem("lyra-skill-deployments"));
    expect(stored).toHaveLength(1);
    expect(stored[0].skillName).toBe("Pretense Shattering");
    expect(stored[0].mastery).toBe("partial");
    expect(stored[0].topic).toBe("school phones");
  });
});

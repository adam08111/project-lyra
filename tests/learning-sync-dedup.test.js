import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncLearningData } from "../src/learning-sync.js";

// §56/A2 — a Reload re-runs syncLearningData on the regenerated reply. These guard
// that re-syncing the SAME learning data does not duplicate the persistent logs or
// double-count the Growth-Report regen cadence.

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

describe("§56/A2 — syncLearningData dedups on reload re-sync", () => {
  let store;
  beforeEach(() => { store = memStorage(); vi.stubGlobal("localStorage", store); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("growth: re-sync does not duplicate the growth log or double-count pending", () => {
    const before = "the cat are happy today";
    const data = { type: "learning_sync", growth: [{ before, after: "the cat is happy today", technique_used: "subject-verb agreement", why_better: "agreement" }] };
    const ctx = { setGrammarLog: () => {}, topic: "pets", studentTexts: [before] };
    syncLearningData(data, ctx);
    syncLearningData(data, ctx); // reload re-sync
    expect(JSON.parse(store.getItem("lyra-growth-log") || "[]").length).toBe(1);
    expect(Number(store.getItem("lyra-growth-pending"))).toBe(1);
  });

  it("grammar: re-sync dedups by phrase+correction", () => {
    let grammar = [];
    const setGrammarLog = (fn) => { grammar = fn(grammar); };
    const data = { type: "learning_sync", grammar: [{ phrase: "the cat are", correction: "the cat is", rule: "SV agreement", explanation: "..." }] };
    const ctx = { setGrammarLog, topic: "pets", studentTexts: [] };
    syncLearningData(data, ctx);
    syncLearningData(data, ctx);
    expect(grammar.length).toBe(1);
  });

  it("skills_deployed: re-sync dedups by skillName+studentApplication", () => {
    const data = { type: "learning_sync", skills_deployed: [{ skill_name: "Start with a Shock", student_application: "opened with a sharp question" }] };
    const ctx = { setGrammarLog: () => {}, topic: "t", studentTexts: [] };
    syncLearningData(data, ctx);
    syncLearningData(data, ctx);
    expect(JSON.parse(store.getItem("lyra-skill-deployments") || "[]").length).toBe(1);
  });

  it("a genuinely DIFFERENT growth entry still appends (dedup is content-keyed, not a blanket block)", () => {
    const ctx = { setGrammarLog: () => {}, topic: "pets", studentTexts: ["the cat are happy today", "him go to school"] };
    syncLearningData({ type: "learning_sync", growth: [{ before: "the cat are happy today", after: "the cat is happy today", technique_used: "x", why_better: "y" }] }, ctx);
    syncLearningData({ type: "learning_sync", growth: [{ before: "him go to school", after: "he goes to school", technique_used: "x", why_better: "y" }] }, ctx);
    expect(JSON.parse(store.getItem("lyra-growth-log") || "[]").length).toBe(2);
    expect(Number(store.getItem("lyra-growth-pending"))).toBe(2);
  });
});

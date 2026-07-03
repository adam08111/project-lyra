import { describe, it, expect, vi, beforeEach } from "vitest";

// §96: exercise the pure mapping + producer-enqueue helpers with the OUTBOX mocked, so
// we assert exactly what would be enqueued without touching localStorage/Supabase.
const h = vi.hoisted(() => ({ enqueued: [] }));
vi.mock("../src/sync-outbox.js", () => ({ enqueue: (item) => { h.enqueued.push(item); } }));

async function load() {
  const dl = await import("../src/data-layer.js");
  const ck = await import("../src/content-keys.js");
  return { ...dl, ...ck };
}

beforeEach(() => { vi.resetModules(); h.enqueued = []; });

describe("data-layer mapping (§96)", () => {
  it("LEARNING_KEYS is the seven local stores, defined once", async () => {
    const { LEARNING_KEYS } = await load();
    expect(LEARNING_KEYS).toEqual([
      "grammar-log", "lyra-growth-log", "lyra-skill-deployments",
      "lyra-structures", "lyra-vocabulary", "lyra-masterclass-reports", "lyra-growth-profile",
    ]);
  });

  it("eventTs: id numeric prefix wins → date → now fallback (reuses tsOf, no 2nd parser)", async () => {
    const { eventTs } = await load();
    expect(eventTs({ id: "1717000000000_a", date: "7 Jun 2026" })).toBe(new Date(1717000000000).toISOString());
    expect(eventTs({ date: "2026-07-04T00:00:00.000Z" })).toBe("2026-07-04T00:00:00.000Z");
    expect(Math.abs(Date.parse(eventTs({})) - Date.now())).toBeLessThan(5000);
  });

  it("toEvent maps promoted columns + full payload per type", async () => {
    const { toEvent, grammarKey, growthKey, skillKey, structureKey, vocabKey, reportKey } = await load();

    const g = { id: "1717000000000_a", phrase: "I are", correction: "I am", rule: "SVA", topic: "school" };
    const ge = toEvent("grammar", g, grammarKey(g));
    expect(ge).toMatchObject({ type: "grammar", content_key: "i are|i am", rule: "SVA", technique: null, topic: "school", payload: g });
    expect(ge.ts).toBe(new Date(1717000000000).toISOString());

    const sk = { id: "deploy_1717000000000_b", skillName: "Start with a Shock", studentApplication: "my hook", topic: "school" };
    expect(toEvent("skill_deployed", sk, skillKey(sk))).toMatchObject({ type: "skill_deployed", content_key: "start with a shock|my hook", technique: "Start with a Shock", topic: "school" });

    const gr = { id: "growth_1717000000000_c", before: "x cat", after: "y cat", technique: "Triple", topic: "school" };
    expect(toEvent("growth", gr, growthKey(gr))).toMatchObject({ type: "growth", technique: "Triple", content_key: "x cat|y cat" });

    const st = { id: "struct_1717000000000_d", name: "Triple" };
    expect(toEvent("structure", st, structureKey(st))).toMatchObject({ type: "structure", content_key: "Triple", rule: null, technique: null });

    const vo = { id: "vocab_1717000000000_e", strong: "meticulous" };
    expect(toEvent("vocabulary", vo, vocabKey(vo))).toMatchObject({ type: "vocabulary", content_key: "meticulous" });

    const rp = { id: "report_1717000000000_f", after: "  polished line  ", technique: "Analogy", topic: "school" };
    expect(toEvent("report", rp, reportKey(rp))).toMatchObject({ type: "report", content_key: "polished line", technique: "Analogy" });
  });

  it("toEvent skips (returns null) a blank-ish content_key — garbage identities don't mirror", async () => {
    const { toEvent } = await load();
    expect(toEvent("grammar", { phrase: "", correction: "" }, "|")).toBe(null);
    expect(toEvent("vocabulary", {}, "")).toBe(null);
    expect(toEvent("structure", { name: "Real" }, "Real")).not.toBe(null);
  });

  it("recordLearningEvents enqueues each non-blank entry (blank keys skipped)", async () => {
    const { recordLearningEvents, vocabKey } = await load();
    recordLearningEvents("vocabulary", [{ strong: "meticulous" }, { strong: "" }, { strong: "ephemeral" }], vocabKey);
    expect(h.enqueued).toHaveLength(2);
    expect(h.enqueued.map((x) => x.payload.content_key)).toEqual(["meticulous", "ephemeral"]);
    expect(h.enqueued.every((x) => x.kind === "event")).toBe(true);
  });

  it("saveProfileRemote enqueues a profile payload; no-ops on a null profile", async () => {
    const { saveProfileRemote } = await load();
    saveProfileRemote({ level: 3 }, "2026-07-04T00:00:00.000Z");
    expect(h.enqueued).toEqual([{ kind: "profile", payload: { profile: { level: 3 }, last_regen_at: "2026-07-04T00:00:00.000Z" } }]);
    saveProfileRemote(null, "x");
    expect(h.enqueued).toHaveLength(1);
  });

  it("recordGrammarLogDelta: FIRST call baselines (enqueues nothing), later calls diff, deletions inert", async () => {
    const { recordGrammarLogDelta, grammarKey } = await load();
    const e1 = { id: "1717000000001_a", phrase: "I are", correction: "I am", rule: "SVA" };
    const e2 = { id: "1717000000002_b", phrase: "he go", correction: "he goes", rule: "SVA" };
    const e3 = { id: "1717000000003_c", phrase: "she dont", correction: "she doesn't", rule: "SVA" };

    recordGrammarLogDelta([e1, e2]);            // first call = baseline of the loaded log
    expect(h.enqueued).toHaveLength(0);

    recordGrammarLogDelta([e3, e1, e2]);        // e3 is new → one event
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0]).toMatchObject({ kind: "event", payload: { type: "grammar", content_key: grammarKey(e3) } });

    recordGrammarLogDelta([e1]);                // a deletion (log shrank) → inert
    expect(h.enqueued).toHaveLength(1);
  });
});

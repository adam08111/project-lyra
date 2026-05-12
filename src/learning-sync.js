/**
 * LYRA LEARNING SYNC — Extracts hidden learning data from AI coaching responses
 * and writes it silently to persistent storage.
 *
 * The AI appends a hidden JSON block to coaching messages:
 *   <!--LYRA_LEARNING_DATA { ... } LYRA_LEARNING_DATA-->
 *
 * The student never sees this. The app strips it before display.
 */

const MARKER = /<!--LYRA_LEARNING_DATA\n?([\s\S]*?)\nLYRA_LEARNING_DATA-->/;

/**
 * Extract hidden learning data from an AI response.
 * Returns { displayText, learningData } where displayText is clean
 * (no JSON block) and learningData is the parsed object or null.
 */
export function extractLearningData(response) {
  const match = response.match(MARKER);
  if (!match) return { displayText: response, learningData: null };

  const displayText = response.replace(MARKER, "").trim();

  let learningData = null;
  try {
    learningData = JSON.parse(match[1].trim());
  } catch (e) {
    console.warn("Failed to parse learning data:", e);
  }

  return { displayText, learningData };
}

/**
 * Sync learning data to persistent storage.
 *
 * @param {object} data - The parsed learning data object
 * @param {object} ctx  - Context from the app:
 *   ctx.setGrammarLog — React state setter for grammar log
 *   ctx.topic         — current writing topic (for tagging entries)
 */
export function syncLearningData(data, ctx) {
  if (!data || data.type !== "learning_sync") return;

  const { setGrammarLog, topic } = ctx;

  // 1. Grammar → existing Grammar Log
  if (data.grammar?.length && setGrammarLog) {
    const newEntries = data.grammar.map(g => ({
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      phrase: g.phrase,
      correction: g.correction,
      rule: g.rule,
      explanation: g.explanation,
      example_wrong: g.example_wrong || "",
      example_correct: g.example_correct || "",
      chinese: g.chinese || "",
      source: "coaching",
    }));
    setGrammarLog(prev => [...newEntries, ...prev]);
  }

  // 2. Skills deployed → skill deployment log
  if (data.skills_deployed?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-skill-deployments") || "[]");
      const newEntries = data.skills_deployed.map(s => ({
        id: "deploy_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        skillName: s.skill_name,
        sourceAuthor: s.source_author || "",
        sourceContext: s.source_context || "",
        studentApplication: s.student_application || "",
        mastery: s.mastery_signal || "partial",
        topic: topic?.slice(0, 80) || "",
        date: new Date().toISOString(),
      }));
      localStorage.setItem("lyra-skill-deployments", JSON.stringify([...newEntries, ...existing].slice(0, 500)));
    } catch (e) { console.error("learning-sync skill-deployments:", e); }
  }

  // 3. Growth → before/after evolution log
  if (data.growth?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-growth-log") || "[]");
      const newEntries = data.growth.map(g => ({
        id: "growth_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString(),
        before: g.before,
        after: g.after,
        technique: g.technique_used,
        why: g.why_better,
        topic: topic?.slice(0, 80) || "",
      }));
      localStorage.setItem("lyra-growth-log", JSON.stringify([...newEntries, ...existing].slice(0, 500)));
    } catch (e) { console.error("learning-sync growth-log:", e); }
  }

  // 4. Structures learned → structure library
  if (data.structures_learned?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-structures") || "[]");
      const newEntries = data.structures_learned.map(s => ({
        id: "struct_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name: s.name,
        description: s.description,
        example: s.student_example,
        effect: s.effect,
        chinese: s.chinese || "",
        learnedAt: new Date().toISOString(),
      }));
      // Deduplicate by name
      const names = new Set(existing.map(s => s.name));
      const unique = newEntries.filter(s => !names.has(s.name));
      if (unique.length) {
        localStorage.setItem("lyra-structures", JSON.stringify([...unique, ...existing].slice(0, 500)));
      }
    } catch (e) { console.error("learning-sync structures:", e); }
  }

  // 5. Vocabulary acquired → vocabulary arsenal
  if (data.vocabulary_acquired?.length) {
    try {
      const existing = JSON.parse(localStorage.getItem("lyra-vocabulary") || "[]");
      const newEntries = data.vocabulary_acquired.map(v => ({
        id: "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        weak: v.weak,
        strong: v.strong,
        chinese: v.chinese || "",
        collocation: v.collocation || "",
        category: v.category || "",
        learnedAt: new Date().toISOString(),
      }));
      // Deduplicate by strong word
      const words = new Set(existing.map(v => v.strong));
      const unique = newEntries.filter(v => !words.has(v.strong));
      if (unique.length) {
        localStorage.setItem("lyra-vocabulary", JSON.stringify([...unique, ...existing].slice(0, 500)));
      }
    } catch (e) { console.error("learning-sync vocabulary:", e); }
  }
}

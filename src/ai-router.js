/**
 * AI Router — Three-tier model strategy.
 *
 * PRO (gemini-3-flash-preview):
 *   The brain. Used for tasks where pedagogical quality, voice detection,
 *   craft evaluation, and Socratic coaching matter. These are the calls
 *   where the LYRA_BRAIN prompt is prepended.
 *
 * FLASH (gemini-flash-latest):
 *   The workhorse. Used for structured tasks that need decent reasoning
 *   but not the full pedagogical engine. Skill enrichment, PEEL classification,
 *   writer search with grounding.
 *
 * FLASH LITE (gemini-3.1-flash-lite-preview):
 *   The cheapest tier. Used for purely mechanical JSON tasks where
 *   the output format is rigid and no coaching philosophy is needed.
 *   Proofread, exercise generation, grammar lessons.
 *
 * Cost estimates (per 1M tokens, input/output):
 *   Pro:        ~$1.25 / $10.00
 *   Flash:      ~$0.50 / $3.00
 *   Flash Lite: ~$0.25 / $1.50
 */

const MODELS = {
  pro: "gemini-3-flash-preview",
  flash: "gemini-flash-latest",
  lite: "gemini-3.1-flash-lite-preview",
};

const ROUTE_CONFIG = {
  // ═══════════════════════════════════════
  // PRO TIER — Pedagogical quality matters
  // Prepend LYRA_BRAIN to these calls
  // ═══════════════════════════════════════

  // X-Ray analysis of reference text (the core learning moment)
  style_analysis: {
    model: MODELS.pro,
    thinkingBudget: 2048,
    brain: true, // flag: prepend LYRA_BRAIN
  },

  // Socratic coaching chat (the main teaching interaction)
  chat_coaching: {
    model: MODELS.pro,
    thinkingBudget: 4096,
    brain: true,
  },

  // Scaffolding for stuck students (needs full pedagogical awareness)
  scaffolding: {
    model: MODELS.pro,
    thinkingBudget: 4096,
    brain: true,
  },

  // Training evaluation (Reporter→Columnist voice shift assessment)
  training_eval: {
    model: MODELS.pro,
    thinkingBudget: 1024,
    brain: true,
  },

  // Training hints (Socratic questions about effect/purpose)
  // Same thinking budget as chat_coaching — the hint IS coaching, so it
  // deserves the same depth of reasoning as the main coaching chat.
  training_hint: {
    model: MODELS.pro,
    thinkingBudget: 4096,
    brain: true,
  },

  // Voice/genre detection from reference text
  voice_synthesis: {
    model: MODELS.pro,
    thinkingBudget: 2048,
    brain: true,
  },

  // Writing DNA extraction (deep technique analysis)
  writing_dna: {
    model: MODELS.pro,
    thinkingBudget: 2048,
    brain: true,
  },

  // ═══════════════════════════════════════
  // FLASH TIER — Decent reasoning, no brain needed
  // ═══════════════════════════════════════

  // Skill enrichment (web search for complementary techniques)
  skill_enrich: {
    model: MODELS.flash,
    thinkingBudget: 1024,
    brain: false,
  },

  // PEEL classification of techniques
  peel_classify: {
    model: MODELS.flash,
    thinkingBudget: 512,
    brain: false,
  },

  // Writer/article search with grounding
  writer_search: {
    model: MODELS.flash,
    thinkingBudget: 512,
    brain: false,
  },

  // Skill matching (which saved skills fit the current task)
  skill_match: {
    model: MODELS.flash,
    thinkingBudget: 512,
    brain: false,
  },

  // Practice rewrite evaluation (Style Lab practice tab)
  practice_rewrite: {
    model: MODELS.flash,
    thinkingBudget: 512,
    brain: false,
  },

  // ═══════════════════════════════════════
  // LITE TIER — Mechanical JSON, cheapest
  // ═══════════════════════════════════════

  // Proofread (grammar/style/vocab JSON)
  proofread: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },

  // Structural suggestions (vocabulary chips + templates)
  structural_suggest: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },

  // Training exercise generation (plain sentences to rewrite)
  training_exercise: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },

  // Grammar mini-lesson generation
  grammar_lesson: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },

  // Source text translation (English → Traditional Chinese)
  translate: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },
};

/**
 * Get route config for a task type.
 * @param {string} task - one of the keys in ROUTE_CONFIG
 * @returns {{ model: string, thinkingBudget: number, brain: boolean }}
 */
export function getRouteConfig(task) {
  const config = ROUTE_CONFIG[task];
  if (!config) {
    console.warn(`Unknown AI route: ${task}, defaulting to flash`);
    return { model: MODELS.flash, thinkingBudget: 512, brain: false };
  }
  return config;
}

/**
 * Check if a task requires the LYRA_BRAIN system prompt.
 * Use this to decide whether to prepend LYRA_BRAIN in callAI.
 * @param {string} task
 * @returns {boolean}
 */
export function needsBrain(task) {
  return ROUTE_CONFIG[task]?.brain ?? false;
}

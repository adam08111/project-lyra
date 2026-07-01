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
 *
 * Search grounding (useSearch=true) bills PER REQUEST on top of tokens:
 *   Gemini 3.x models: 5,000 grounded prompts/month free, then $14 / 1,000
 *   queries — and one prompt can execute (and bill) MULTIPLE search queries.
 *   (2.5-era models: $35 / 1,000.) Verified on the AI Studio pricing page,
 *   June 2026. Grounded requests also run WITHOUT thinking (proxy drops
 *   thinkingBudget when useSearch is on — thinking makes the model skip
 *   Google Search).
 */

const MODELS = {
  pro: "gemini-3-flash-preview",
  flash: "gemini-flash-latest",
  // Google promoted the lite model from preview to GA: the old
  // gemini-3.1-flash-lite-preview now 404s; the new name drops -preview.
  lite: "gemini-3.1-flash-lite",
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

  // Photo OCR — read text off a photographed source / exam question (Gemini
  // vision). Pro: a live test OCR'd full English + Traditional Chinese + digits
  // accurately where Flash dropped characters; accuracy matters for a student's
  // pasted source/exam text. No thinking needed; brain:false (plain extraction).
  ocr: {
    model: MODELS.pro,
    thinkingBudget: 0,
    brain: false,
  },

  // Socratic coaching chat (the main teaching interaction)
  chat_coaching: {
    model: MODELS.pro,
    thinkingBudget: 4096,
    // §67: thinking tokens count toward maxOutputTokens, so the old shared 4096 cap
    // left almost no room for visible text once thinking ran — a full 15-sentence
    // diagnostic critique + logic pass truncated to a ~6-sentence sample. Budget
    // generously: thinking (4096) + a long numbered sweep + logic pass + hand-back
    // task. A ceiling only bills when actually used, and streaming covers the UX of
    // a long reply, so a normal short chat turn pays nothing extra for the headroom.
    maxTokens: 16384,
    brain: true,
  },

  // Scaffolding for stuck students (needs full pedagogical awareness)
  scaffolding: {
    model: MODELS.pro,
    thinkingBudget: 4096,
    // Replies are short by design (one step/message), but keep a comfortable margin
    // over the thinking budget so a thinking-heavy step never truncates mid-answer.
    maxTokens: 8192,
    brain: true,
  },

  // Opening greeting (§43). Deliberately FLASH, not pro: a warm in-voice hello
  // doesn't need the full pedagogical engine, and it fires on EVERY session
  // open (a class of 40 all opening at once = 40 calls) — keep it cheap and
  // streamed. brain:true so it's unmistakably Lyra's voice, not a template.
  welcome: {
    model: MODELS.flash,
    thinkingBudget: 512,
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

  // Continuous Growth Report — Lyra's running, honest assessment of the student.
  // Carries its own system prompt (REPORT_CARD_BRAIN), so brain:false.
  growth_report: {
    model: MODELS.pro,
    thinkingBudget: 2048,
    brain: false,
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

  // Annotation label explanation (tap a highlighted phrase in a quote card)
  annotation_explain: {
    model: MODELS.lite,
    thinkingBudget: 0,
    brain: false,
  },

  // Word dictionary lookup (select an unknown word anywhere in the app)
  word_lookup: {
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

  // ═══════════════════════════════════════
  // TTS — native Gemini speech (audio out)
  // ═══════════════════════════════════════

  // Word-lookup pronunciation. PRIMARY 🔊 source: server-side synthesis on the SAME
  // key kills the device-voice problem (a phone with one installed English voice
  // made US/UK identical). Accent is prompt-directed (the prebuilt voices are NOT
  // accent-locked) — same voice for both accents, the instruction differentiates.
  // Model id VERIFIED live (it churns): "gemini-2.5-flash-tts" 404s; the working id
  // is "gemini-2.5-flash-preview-tts" ("gemini-3.1-flash-tts-preview" is higher
  // quality at ~2× price). brain:false — audio-only, no pedagogy.
  tts: {
    model: "gemini-2.5-flash-preview-tts",
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

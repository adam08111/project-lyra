// AI provider abstraction + cost routing
// Routes tasks to appropriate models based on complexity

const MODELS = {
  lite: "gemini-3.1-flash-lite-preview",
  standard: "gemini-flash-latest",
  advanced: "gemini-3-flash-preview",
};

// Task → model mapping
const ROUTE = {
  // Lite model — structured, low-reasoning tasks
  proofread: "lite",
  peel_classify: "lite",
  skill_match: "lite",
  grammar_lesson: "lite",
  structural_suggest: "lite",
  writer_search: "lite",
  practice_rewrite: "lite",
  training_exercise: "lite",
  training_eval: "lite",
  training_hint: "lite",

  // Standard model — reasoning-heavy tasks
  source_xray: "advanced",
  style_analysis: "advanced",
  chat_coaching: "standard",
  scaffolding: "standard",
  skill_recommend: "standard",
  skill_enrich: "standard",
  voice_synthesis: "standard",
  writing_dna: "standard",
};

// Thinking budget per task (Gemini thinking tokens count toward output)
const THINKING = {
  // No/low thinking for structured tasks
  proofread: 0,
  peel_classify: 0,
  skill_match: 0,
  grammar_lesson: 0,
  structural_suggest: 0,
  writer_search: 0,
  practice_rewrite: 1024,
  training_exercise: 0,
  training_eval: 1024,
  training_hint: 512,

  // Higher thinking for complex tasks
  source_xray: 4096,
  style_analysis: 4096,
  chat_coaching: 2048,
  scaffolding: 2048,
  skill_recommend: 2048,
  skill_enrich: 2048,
  voice_synthesis: 4096,
  writing_dna: 4096,
};

/**
 * Get the model name for a given task
 * @param {string} task - Task identifier from ROUTE keys
 * @returns {string} Model name string
 */
export function getModel(task) {
  return MODELS[ROUTE[task] || "standard"];
}

/**
 * Get the thinking budget for a given task
 * @param {string} task - Task identifier from THINKING keys
 * @returns {number|undefined} Thinking budget (0 means no thinking)
 */
export function getThinkingBudget(task) {
  const budget = THINKING[task];
  return budget !== undefined ? budget : undefined;
}

/**
 * Get full routing config for a task
 * @param {string} task - Task identifier
 * @returns {{ model: string, thinkingBudget: number|undefined }}
 */
export function getRouteConfig(task) {
  return {
    model: getModel(task),
    thinkingBudget: getThinkingBudget(task),
  };
}

// Export for visibility/debugging
export { MODELS, ROUTE, THINKING };

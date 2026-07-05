// §103 red-team — the route layer. THE WHOLE VALUE OF THE HARNESS: it builds each
// attack prompt via the REAL, SHIPPED prompt builders (src/prompts.js) + the real system
// prompts (LYRA_BRAIN inside those builders; REPORT_CARD_BRAIN for growth), so it tests
// the prompts production actually sends — not reconstructions. Zero product code is
// imported for its behaviour; these are the same pure builder functions the app calls.

import {
  buildCoachPrompt,
  buildScaffoldingPrompt,
  buildStyleProfilerPrompt,
  buildWelcomePrompt,
  buildTrainingEvalPrompt,
  buildTrainingHintPrompt,
  buildTrainingChatPrompt,
} from "../../src/prompts.js";
import { REPORT_CARD_BRAIN } from "../../src/report-card-brain.js";
import { getRouteConfig } from "../../src/ai-router.js";

// Benign scaffolding fixtures. A case overrides only the field that carries its attack;
// everything else stays a realistic, harmless session so we test the attack in isolation.
export const DEFAULTS = {
  topic: "Should secondary schools ban smartphones during lessons?",
  type: "Argumentative Essay",
  wordCount: "400-500",
  name: "Ming",
  sections: ["SENTENCE PATTERNS", "WORD CHOICES"],
  plainSentence: "The school introduced a new rule about phones last week.",
  technique: {
    technique: "The Sharp Pivot",
    description: "Set up an ordinary expectation, then flip it in the same sentence for surprise.",
    structure: "Ordinary setup, then a sudden turn.",
    example: "The exam looked easy — until page two turned the room to stone.",
  },
  // A realistic-but-synthetic growth-report input (NO real student data).
  profile: { studentName: "Student", level: "Developing Writer", weaknesses: [], strengths: [] },
  delta: { grammar: [{ rule: "Subject-Verb Agreement", instances: 3 }], newStructures: [], newVocab: [] },
  ocrPrompt: "Extract ALL the text from this image. Return ONLY the extracted text — no commentary, no explanation. Preserve paragraphs and line breaks.",
};

const styleBuild = (input) => ({
  system: buildStyleProfilerPrompt(input.sections ?? DEFAULTS.sections),
  message: input.referenceText ?? "",
});

// route -> { build(input) -> {system, message, image?}, plus meta from ai-router }
const BUILDERS = {
  chat_coaching: (input) => ({
    system: buildCoachPrompt(input.topic ?? DEFAULTS.topic, input.type ?? DEFAULTS.type, input.wordCount ?? DEFAULTS.wordCount, input.examRules ?? null, input.sourceContext ?? null, false, input.studentContext ?? null),
    message: input.message ?? "",
  }),
  scaffolding: (input) => ({
    system: buildScaffoldingPrompt(input.topic ?? DEFAULTS.topic, input.type ?? DEFAULTS.type, input.wordCount ?? DEFAULTS.wordCount, input.examRules ?? null, input.sourceContext ?? null),
    message: input.message ?? "",
  }),
  style_analysis: styleBuild,
  voice_synthesis: styleBuild, // same builder, attacker-controlled reference text
  writing_dna: styleBuild,      // same builder, attacker-controlled reference text
  welcome: (input) => ({
    system: buildWelcomePrompt({ name: input.name ?? DEFAULTS.name, type: input.type ?? DEFAULTS.type, purpose: input.purpose ?? "school", wordCount: input.wordCount ?? DEFAULTS.wordCount, topic: input.topic ?? DEFAULTS.topic, cue: input.cue ?? null }),
    message: input.message ?? "(The student just opened the session — write your opening greeting now.)",
  }),
  training_eval: (input) => ({
    system: buildTrainingEvalPrompt(input.technique ?? DEFAULTS.technique, input.plainSentence ?? DEFAULTS.plainSentence, input.studentAttempt ?? "", input.studentExplanation ?? ""),
    message: input.message ?? "Evaluate the student's attempt now.",
  }),
  training_hint: (input) => ({
    system: buildTrainingHintPrompt(input.technique ?? DEFAULTS.technique, input.plainSentence ?? DEFAULTS.plainSentence, input.hintLevel ?? 1),
    message: input.message ?? "Give the hint now.",
  }),
  training_chat: (input) => ({
    system: buildTrainingChatPrompt(input.technique ?? DEFAULTS.technique, input.plainSentence ?? DEFAULTS.plainSentence, input.conversation ?? []),
    message: input.message ?? "Write your next coaching turn now.",
  }),
  growth_report: (input) => ({
    system: REPORT_CARD_BRAIN,
    message: input.historyJSON ?? JSON.stringify({ CURRENT_PROFILE: input.profile ?? DEFAULTS.profile, DELTA: input.delta ?? DEFAULTS.delta }),
  }),
  ocr: (input) => ({
    system: "",
    message: input.ocrPrompt ?? DEFAULTS.ocrPrompt,
    image: input.image ?? null, // {data, mediaType} — a base64 fixture; null => dry-run only
  }),
};

// ai-router uses these keys directly; growth_report/ocr have real entries too.
const ROUTE_KEYS = Object.keys(BUILDERS);

// A few harness route names differ from the ai-router config key they actually run on.
// The training-practice chat is fetched via the training_hint config (TrainingSession.jsx
// uses getRouteConfig("training_hint") with buildTrainingChatPrompt) — map it so the
// harness uses the REAL model/thinkingBudget, not the flash default.
const ROUTER_KEY = { training_chat: "training_hint" };

export function routeMeta(route) {
  const cfg = getRouteConfig(ROUTER_KEY[route] || route); // {model, thinkingBudget, brain}
  // maxTokens must clear the thinking budget or a pro reply has no visible text (§67).
  const maxTokens = (cfg.thinkingBudget || 0) + 1500;
  return { model: cfg.model, thinkingBudget: cfg.thinkingBudget, brain: cfg.brain, maxTokens };
}

// Build the full proxy call for a case: {system, message, model, thinkingBudget, maxTokens, image}.
export function buildCall(route, input = {}) {
  const builder = BUILDERS[route];
  if (!builder) throw new Error(`redteam: unknown route "${route}" (known: ${ROUTE_KEYS.join(", ")})`);
  const { system, message, image } = builder(input);
  const meta = routeMeta(route);
  return { route, system, message, image: image || null, ...meta };
}

export { ROUTE_KEYS };

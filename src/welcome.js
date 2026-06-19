/**
 * WELCOME (§43) — fallback template + the two pure decisions around the
 * generated opening greeting. The greeting itself is model-generated and
 * streamed (see lyra.jsx); these are the deterministic safety floors.
 */
import { topicBrief } from "./titleGenerator.js";

/**
 * The pre-§43 templated welcome, kept ONLY as the failure fallback so the
 * session ALWAYS opens with a warm-enough message — never a blank chat, never
 * the raw error string. Genre-blind by design (the banner stays as backup when
 * this fires).
 */
export function FALLBACK_WELCOME({ name, type, topic, wordCount } = {}) {
  const greeting = name ? `Hey ${name}! ` : "Hello! ";
  const brief = topicBrief(topic, 120) || topic || "your piece";
  const t = (type || "piece").toLowerCase();
  return `${greeting}I'm Lyra, your writing coach. You're working on a ${t}: ${brief} — aiming for ${wordCount || "your target"} words. I'll guide you through every step, but remember: every word will be yours.\n\nLet's start! Would you like me to outline the structure, or do you want to brainstorm ideas first?`;
}

/**
 * Fallback floor: use the generated greeting when it's present and the call
 * didn't error; otherwise fall back to the template. An empty / whitespace-only
 * generation counts as a failure.
 * @param {string} generatedText
 * @param {*} error - truthy if the welcome call threw
 * @param {object} fallbackArgs - { name, type, topic, wordCount }
 */
export function chooseWelcome(generatedText, error, fallbackArgs) {
  if (!error && generatedText && generatedText.trim()) return generatedText;
  return FALLBACK_WELCOME(fallbackArgs || {});
}

/**
 * Banner deferral (Unit 3): suppress the separate §28 genre-mismatch banner
 * ONLY when a cue was present AND the generated greeting actually succeeded —
 * the warm in-greeting version wins. A template fallback is genre-blind, so the
 * banner must stay as the safety path.
 */
export function shouldSuppressWelcomeBanner(cuePresent, welcomeSucceeded) {
  return !!cuePresent && !!welcomeSucceeded;
}

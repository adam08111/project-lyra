// §53 — pure helpers for the chat message action row (Copy · Translate · Reload).
// Kept out of the component so they're unit-testable. No React, no DOM.
import { stripMd } from "./utils.js";
import { stripLearningData } from "./learning-sync.js";

/**
 * Clean text for COPY / TRANSLATE input: drop the hidden LYRA_LEARNING_DATA
 * block (and any stray HTML comments) then strip markdown (** _ * bullets) so
 * the student gets readable plain text — never the raw payload or ** markers.
 * Defensive: chat AI messages are already displayText (LEARNING_DATA stripped at
 * send time), but the welcome/legacy/edited paths may not be.
 * @param {string} text
 * @returns {string}
 */
export function cleanMessageText(text) {
  return stripMd(stripLearningData(text || ""));
}

/**
 * Can this message's turn be RELOADED (re-called)? Only AI messages that retain
 * the originating request text are reconstructable — the welcome greeting (§43)
 * and any legacy/edited message lack reqText, so reload must be disabled for
 * them rather than firing a wrong call.
 * @param {{role?: string, reqText?: string}} m
 * @returns {boolean}
 */
export function canReloadMessage(m) {
  return !!(m && m.role === "ai" && typeof m.reqText === "string" && m.reqText.trim().length > 0);
}

/**
 * Resolve a message's Chinese translation, using the on-message cache first so a
 * re-tap toggles instantly with NO second API call. Only calls fetchTranslation
 * (the lite-tier translator) on a cache miss. The caller stores the result on
 * the message (message.translation_zh) so the next call hits the cache.
 * @param {{translation_zh?: string}} message
 * @param {() => Promise<string>} fetchTranslation
 * @returns {Promise<string>}
 */
export async function getMessageTranslation(message, fetchTranslation) {
  if (message && typeof message.translation_zh === "string" && message.translation_zh) {
    return message.translation_zh;
  }
  return await fetchTranslation();
}

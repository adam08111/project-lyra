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
 * Copy text to the clipboard, robust across contexts. navigator.clipboard only
 * exists in a SECURE context (https / localhost); on a phone hitting the dev
 * server over the LAN IP (http://192.168.x.x:3000) it is undefined, so we fall
 * back to the legacy execCommand("copy") path. Returns true on success.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  const value = text || "";
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (e) { /* secure-context write blocked (no focus / no permission) — fall through */ }
  // Fallback for insecure contexts (phone on http://<LAN-IP>) and older browsers.
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();                          // execCommand("copy") needs a focused element with a live selection
    ta.select();
    ta.setSelectionRange(0, value.length); // iOS Safari needs the explicit range
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
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

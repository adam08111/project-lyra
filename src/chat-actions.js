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

// §70 — strip the wrapping **bold** and "quotes" off a parsed original/correction,
// keeping the sentence's own internal/trailing punctuation.
function unwrapFix(s) {
  let t = (s || "").trim();
  t = t.replace(/^\*+/, "").replace(/\*+$/, "").trim();          // bold markers
  t = t.replace(/^["“'']+/, "").replace(/["”'']+$/, "").trim();  // wrapping quotes (straight + curly)
  return t;
}

// §70 — name a rule for the Grammar-Log card title from the explanation text
// (EN or 繁中). Conservative: defaults to "Grammar fix" rather than mislabel.
function deriveRule(explanation) {
  const e = (explanation || "").toLowerCase();
  const map = [
    [/agreement|主謂|單複數|一致/, "Subject-Verb Agreement"],
    [/tense|時態|past tense|present tense|continuous/, "Tense"],
    [/plural|singular|眾數|複數|單數/, "Plural / Singular"],
    [/article|冠詞/, "Articles"],
    [/possessive|所有格/, "Possessive"],
    [/preposition|介詞/, "Prepositions"],
    [/spelling|拼寫|串字/, "Spelling"],
    [/word order|語序/, "Word Order"],
  ];
  for (const [re, name] of map) if (re.test(e)) return name;
  return "Grammar fix";
}

/**
 * §70 — parse the grammar corrections out of a Lyra chat critique so the student
 * can save them to the Grammar Log with one tap (the hidden LYRA_LEARNING_DATA
 * auto-sync is unreliable on a long sweep — the model often omits it).
 *
 * Matches the §67 sweep format — a numbered line whose original and correction are
 * separated by a plain → (or the word "becomes"): `N. <original> → <correction>
 * (explanation)`. Tolerates **bold** and "quotes" (straight or curly) around either
 * side. Lines WITHOUT an arrow — a clean sentence ("7. This one's fine.") or an
 * unparseable one ("3. I can't fully decode this…") — have no original→correction
 * pair and are skipped. Deduped by phrase+correction. Returns [] when there's
 * nothing parseable (a normal coaching turn).
 *
 * @param {string} text - the visible message text (displayText, LEARNING_DATA already stripped)
 * @returns {{ phrase: string, correction: string, explanation: string, rule: string }[]}
 */
export function parseChatGrammarFixes(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const numMatch = raw.match(/^\s*\*{0,2}(\d+)[.)]\s+(.+)$/);
    if (!numMatch) continue;
    const body = numMatch[2];
    const arrow = body.match(/\s*(?:→|->|—>|\bbecomes\b)\s*/);
    if (!arrow) continue;
    const left = body.slice(0, arrow.index);
    let right = body.slice(arrow.index + arrow[0].length);
    let explanation = "";
    const explMatch = right.match(/\(([^)]*)\)\s*$/); // a trailing (reason)
    if (explMatch) { explanation = explMatch[1].trim(); right = right.slice(0, explMatch.index); }
    const phrase = unwrapFix(left);
    const correction = unwrapFix(right);
    if (!phrase || !correction || phrase === correction) continue;
    const key = phrase.toLowerCase() + "|" + correction.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ phrase, correction, explanation, rule: deriveRule(explanation) });
  }
  return out;
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

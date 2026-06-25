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

// §70 — the Grammar-Log card renders PLAIN text, so every markdown marker the model
// emits — **bold**, *italic*, `code` (wrapping AND inline, e.g. the 繁中 explanation's
// "**agreement**") — must be stripped or raw */` leak onto the card.
function stripMarks(s) {
  return (s || "").replace(/[*`]/g, "").trim();
}
// A whole-sentence field (phrase / correction) is additionally wrapped in "quotes" —
// strip those too. The explanation is free text that may legitimately quote a word,
// so it gets stripMarks ONLY (keeps its inner quotes).
function cleanField(s) {
  return stripMarks(s).replace(/^["“'']+/, "").replace(/["”'']+$/, "").trim();
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
 * The §67 sweep line comes in two shapes (lyra-brain.js:217 + the worked example):
 *   TWO-ARROW (canonical):  N. "original" → the reason(s) → "fixed"
 *   ONE-ARROW (shorter):    N. "original" → "fixed" (reason)
 * So we split on EVERY arrow: the FIRST segment is the original, the LAST is the
 * fix, anything in the middle is the reason. The original/fix are quoted or **bold**;
 * an OUTLINE line ("1. Introduction → hook the reader") is neither, so it's skipped —
 * the button must never appear on a plan/recap turn. A flagged-undecodable line
 * ("I can't fully decode this…") is skipped even if its guess contains an arrow (it
 * is not a verified correction). A clean "7. This one's fine." has no arrow and is
 * skipped. Deduped by phrase+correction. Returns [] on a normal coaching turn.
 *
 * @param {string} text - the visible message text (displayText, LEARNING_DATA already stripped)
 * @returns {{ phrase: string, correction: string, explanation: string, rule: string }[]}
 */
export function parseChatGrammarFixes(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  const isMarked = (s) => /["“”]|\*/.test(s || ""); // double-quoted or **bolded** ⇒ a real critique line (not an outline; a bare contraction apostrophe doesn't count)
  for (const raw of text.split(/\r?\n/)) {
    const numMatch = raw.match(/^\s*\*{0,2}(\d+)[.)]\s+(.+)$/);
    if (!numMatch) continue;
    const body = numMatch[2];
    // A flagged-undecodable line is a best-GUESS, not a verified fix — never save it.
    if (/can'?t (fully )?decode|best guess|tell me if|not sure|might mean/i.test(body)) continue;
    const parts = body.split(/\s*(?:→|->|—>)\s*/);
    if (parts.length < 2) continue;                                   // no arrow → clean / unparseable line
    if (!isMarked(parts[0]) && !isMarked(parts[parts.length - 1])) continue; // outline, not a correction
    let right = parts[parts.length - 1];
    let explanation = parts.slice(1, -1).join("; ");                  // two-arrow: the middle reason(s)
    // Peel a trailing "(reason)" off the fix — greedy (absorbs nested parens) and
    // tolerant of a sentence-final period/punctuation after the closing ")".
    const explMatch = right.match(/\(([\s\S]*)\)\s*[.。!?！？,，;；]?\s*$/);
    if (explMatch) {
      explanation = explanation ? `${explanation}; ${explMatch[1]}` : explMatch[1];
      right = right.slice(0, explMatch.index);
    }
    const phrase = cleanField(parts[0]);
    const correction = cleanField(right);
    explanation = stripMarks(explanation);
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

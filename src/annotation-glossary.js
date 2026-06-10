/**
 * ANNOTATION GLOSSARY — cache + fetch for tappable annotation explanations.
 *
 * Tapping a {phrase}[label] annotation in an X-Ray quote card opens a small
 * bilingual explanation. The AI is called ONCE per (label, phrase) — results
 * are cached forever in localStorage (capped, oldest-evicted). Deliberately
 * NOT in backup.js CRITICAL_KEYS: the glossary is regenerable, and the backup
 * snapshot stays lean.
 */

import { callAI } from "./api.js";
import { getRouteConfig } from "./ai-router.js";
import { buildAnnotationExplainPrompt } from "./prompts.js";

export const GLOSSARY_KEY = "lyra-annotation-glossary";
export const GLOSSARY_MAX_ENTRIES = 150;
// Bump when the explanation prompt changes in a way that invalidates cached
// entries (v2: register fix — 書面語 instead of Cantonese colloquial;
// v3: try_example fields — worked example under the Give-it-a-go pattern).
// Entries with an older/missing version are treated as cache misses and
// regenerated on next tap, overwriting the stale copy.
export const GLOSSARY_VERSION = 3;

// Cache key: case/whitespace/punctuation-insensitive on both label and phrase.
// \p{L}\p{N} keeps CJK characters (Chinese labels/phrases are first-class).
export function normKey(label, phrase) {
  const norm = (s) => (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return norm(label) + "|" + norm(phrase);
}

function readGlossary() {
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function writeGlossary(glossary) {
  try {
    localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
  } catch (e) { /* silent */ }
}

export function getCachedExplanation(label, phrase) {
  const entry = readGlossary()[normKey(label, phrase)] || null;
  // Stale-version entries (pre-register-fix) read as misses → refetched.
  return entry && entry.v === GLOSSARY_VERSION ? entry : null;
}

/** Write an entry; on overflow evict the oldest by savedAt. */
export function cacheExplanation(label, phrase, parsed) {
  const glossary = readGlossary();
  glossary[normKey(label, phrase)] = { ...parsed, label, phrase, savedAt: Date.now(), v: GLOSSARY_VERSION };
  const keys = Object.keys(glossary);
  if (keys.length > GLOSSARY_MAX_ENTRIES) {
    keys
      .sort((a, b) => (glossary[a].savedAt || 0) - (glossary[b].savedAt || 0))
      .slice(0, keys.length - GLOSSARY_MAX_ENTRIES)
      .forEach(k => { delete glossary[k]; });
  }
  writeGlossary(glossary);
  return glossary[normKey(label, phrase)];
}

// Defensive parse: the model is told "no fences", but tolerate ```json fences
// or a stray preamble by extracting the outermost { ... } object (same pattern
// as parseProfileJSON in growth-report.js). Throws on garbage.
export function parseExplainJSON(s) {
  let t = (s || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  const obj = JSON.parse(t);
  if (!obj || typeof obj !== "object" || (!obj.term_en && !obj.what_en)) {
    throw new Error("explanation JSON missing required fields");
  }
  return obj;
}

// In-flight guard: concurrent taps for the same key share one promise, so a
// double-tap (or both cards racing) never spends two AI calls.
const pending = new Map();

/**
 * Get the explanation for a tapped annotation — cache first, ONE Lite-tier AI
 * call on miss. Parse failures throw and are NOT cached (retap retries).
 *
 * @param {{label, phrase, sentence, sourceLang}} input
 * @param {{trackCall?: Function, call?: Function}} deps - `call` is injectable for tests
 * @returns {Promise<object>} the glossary entry
 */
export async function explainAnnotation({ label, phrase, sentence = "", sourceLang = "en" }, { trackCall, call = callAI } = {}) {
  const cached = getCachedExplanation(label, phrase);
  if (cached) return cached;

  const key = normKey(label, phrase);
  if (pending.has(key)) return pending.get(key);

  const p = (async () => {
    const route = getRouteConfig("annotation_explain");
    if (trackCall) trackCall();
    let raw = await call(
      buildAnnotationExplainPrompt(label, phrase, sentence, sourceLang),
      JSON.stringify({ label, phrase, sentence }),
      false, 1000, route.thinkingBudget, undefined, undefined, route.model
    );
    if (raw && typeof raw === "object" && typeof raw.text === "string") raw = raw.text;
    const parsed = parseExplainJSON(raw);
    return cacheExplanation(label, phrase, parsed);
  })();
  pending.set(key, p);
  try {
    return await p;
  } finally {
    pending.delete(key);
  }
}

/**
 * Map a glossary entry onto the EXISTING lyra-saved-concepts record shape
 * ({ name, grammar, function, useIt, example, section, savedAt } — see the
 * Sentence-breakdown Save in XRayView + SavedConceptCard in StyleLab). Each
 * field carries EN then ZH so the saved card reads bilingually as-is.
 */
export function buildConceptFromExplanation(entry, { phrase, sentence = "", sectionTitle = "" } = {}) {
  const join = (en, zh) => [en, zh].filter(Boolean).join(" — ");
  // useIt carries "pattern → example": SavedConceptCard splits on the arrow and
  // renders the example in its own "For example" box.
  const tryExample = join(entry.try_example_en, entry.try_example_zh);
  return {
    name: join(entry.term_en, entry.term_zh),
    grammar: join(entry.what_en, entry.what_zh),
    function: join(entry.here_en, entry.here_zh),
    useIt: tryExample ? `${join(entry.try_en, entry.try_zh)} → ${tryExample}` : join(entry.try_en, entry.try_zh),
    example: sentence ? `"${phrase}" — ${sentence}` : `"${phrase}"`,
    section: sectionTitle || "X-Ray annotation",
    savedAt: Date.now(),
    annoKey: normKey(entry.label || "", phrase),
  };
}

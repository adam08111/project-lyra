/**
 * WORD DICTIONARY — cache + fetch for the tap-to-define dictionary.
 *
 * Selecting an unknown English word anywhere in the app shows a 📖 bubble;
 * tapping it opens a small bilingual definition card. The AI is called ONCE
 * per word — results are cached forever in localStorage (capped, oldest
 * evicted). Same architecture as annotation-glossary.js. Deliberately NOT in
 * backup CRITICAL_KEYS (regenerable).
 */

import { callAI } from "./api.js";
import { getRouteConfig } from "./ai-router.js";
import { buildWordLookupPrompt } from "./prompts.js";

export const DICTIONARY_KEY = "lyra-word-dictionary";
export const DICTIONARY_MAX_ENTRIES = 300;
// Bump when the lookup prompt changes in a way that invalidates cached entries.
// v2: added ipa_us / ipa_uk pronunciation — older entries lack them, so re-fetch.
export const DICTIONARY_VERSION = 2;

// Cache key: the word alone (lowercase, stripped) — the same word looked up
// anywhere is instant. The first lookup's sentence picks the sense; acceptable
// for this audience's vocabulary level. Curly apostrophes normalize to straight
// (Guardian text uses ’, editor text uses ') and possessive/edge apostrophes
// are stripped, so "don't"/"don’t" and "students"/"students’" share one entry.
export const normWord = (w) => (w || "")
  .toLowerCase()
  .replace(/’/g, "'")
  .replace(/[^a-z'-]/g, "")
  .replace(/^['-]+|['-]+$/g, "");

// A lookable word: a single English word, 2-30 letters (apostrophe/hyphen ok).
export const isLookableWord = (s) => /^[A-Za-z][A-Za-z'’-]{1,29}$/.test((s || "").trim());

function readDictionary() {
  try {
    const raw = localStorage.getItem(DICTIONARY_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function writeDictionary(dict) {
  try {
    localStorage.setItem(DICTIONARY_KEY, JSON.stringify(dict));
  } catch (e) { /* silent */ }
}

export function getCachedWord(word) {
  const entry = readDictionary()[normWord(word)] || null;
  return entry && entry.v === DICTIONARY_VERSION ? entry : null;
}

export function cacheWord(word, parsed) {
  const dict = readDictionary();
  dict[normWord(word)] = { ...parsed, lookedUpWord: word, savedAt: Date.now(), v: DICTIONARY_VERSION };
  const keys = Object.keys(dict);
  if (keys.length > DICTIONARY_MAX_ENTRIES) {
    keys
      .sort((a, b) => (dict[a].savedAt || 0) - (dict[b].savedAt || 0))
      .slice(0, keys.length - DICTIONARY_MAX_ENTRIES)
      .forEach(k => { delete dict[k]; });
  }
  writeDictionary(dict);
  return dict[normWord(word)];
}

// Defensive parse — same pattern as the annotation glossary. Throws on garbage.
export function parseWordJSON(s) {
  let t = (s || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  const obj = JSON.parse(t);
  if (!obj || typeof obj !== "object" || (!obj.meaning_en && !obj.zh)) {
    throw new Error("word JSON missing required fields");
  }
  return obj;
}

/**
 * Map a dictionary entry onto a lyra-saved-concepts record (kind:"word").
 * Carries the word's own fields for the dedicated word-card renderer, plus the
 * legacy concept fields so older renderers degrade gracefully. Dedupe by wordKey.
 */
export function buildConceptFromWord(entry, { sentence = "" } = {}) {
  const word = (entry.word || entry.lookedUpWord || "").toLowerCase();
  const pos = [entry.pos_en, entry.pos_zh].filter(Boolean).join(" · ");
  return {
    kind: "word",
    name: [word, entry.zh].filter(Boolean).join(" · "),
    pos,
    meaning_en: entry.meaning_en || "",
    meaning_zh: entry.meaning_zh || "",
    example_en: entry.example_en || "",
    example_zh: entry.example_zh || "",
    // legacy concept fields (older renderers)
    grammar: pos,
    function: [entry.meaning_en, entry.meaning_zh].filter(Boolean).join(" — "),
    useIt: "",
    example: sentence ? `"${word}" — ${sentence.slice(0, 120)}` : "",
    section: "Dictionary · 字典",
    savedAt: Date.now(),
    wordKey: normWord(word),
  };
}

// In-flight guard: concurrent lookups for the same word share one promise.
const pending = new Map();

/**
 * Look up a word — cache first, ONE Lite-tier call on miss. Parse failures
 * throw and are NOT cached (retry re-fetches).
 * @param {{word, sentence}} input
 * @param {{trackCall?: Function, call?: Function}} deps - `call` injectable for tests
 */
export async function lookupWord({ word, sentence = "" }, { trackCall, call = callAI } = {}) {
  const cached = getCachedWord(word);
  if (cached) return cached;

  const key = normWord(word);
  if (pending.has(key)) return pending.get(key);

  const p = (async () => {
    const route = getRouteConfig("word_lookup");
    if (trackCall) trackCall();
    let raw = await call(
      buildWordLookupPrompt(word, sentence),
      JSON.stringify({ word, sentence }),
      false, 600, route.thinkingBudget, undefined, undefined, route.model
    );
    if (raw && typeof raw === "object" && typeof raw.text === "string") raw = raw.text;
    const parsed = parseWordJSON(raw);
    return cacheWord(word, parsed);
  })();
  pending.set(key, p);
  try {
    return await p;
  } finally {
    pending.delete(key);
  }
}

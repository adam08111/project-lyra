/**
 * TRAINING THREADS — read helpers for lyra-training-chats.
 *
 * Threads are created/owned by TrainingSession, keyed
 * { [skill.id]: { [String(techIdx)]: [{role, text}, …] } }.
 * These helpers let technique cards show "Continue · N turns" when a thread
 * already exists for that skill+technique (resume reopens the SAME thread —
 * TrainingSession loads by the same key; nothing forks).
 */

export const TRAINING_CHATS_KEY = "lyra-training-chats";

/** Pure: turn count of one thread in a parsed store (0 when absent/malformed). */
export function countThreadTurns(allChats, skillId, techIdx) {
  if (!allChats || typeof allChats !== "object") return 0;
  const thread = allChats[skillId] && allChats[skillId][String(techIdx)];
  return Array.isArray(thread) ? thread.length : 0;
}

/** Parse the store from localStorage ({} on absence/corruption). */
export function loadTrainingChats() {
  try {
    const raw = localStorage.getItem(TRAINING_CHATS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

// Practice-exercise sentences are persisted per skill so the same sentence is
// shown every time the student returns — without this they regenerated on
// every remount and the student lost the sentence they were mid-practice on.
// Each technique slot holds a LIST of sentences: the original plus any the
// student ADDED after Lyra approved their rewrite (keep the old, add a new one
// to keep practising the same skill). Legacy data stored a bare string per
// slot; normalizeExercises migrates it to a one-element list.
export const TRAINING_EXERCISES_KEY = "lyra-training-exercises";

// Coerce one persisted slot to a sentence LIST: a bare string → [string]
// (legacy), an array → cleaned array, anything else → null (not generated yet).
const normalizeSlot = (slot) => {
  if (Array.isArray(slot)) {
    const clean = slot.filter((s) => typeof s === "string" && s);
    return clean.length ? clean : null;
  }
  if (typeof slot === "string" && slot) return [slot];
  return null;
};

/**
 * Pure: normalise a persisted exercises array so every slot is a sentence LIST
 * or null. Migrates the legacy string-per-slot shape in place (read side).
 */
export function normalizeExercises(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeSlot);
}

/**
 * Pure: fold freshly generated sentences into the existing exercise array
 * WITHOUT overwriting a slot that already has sentences. A slot is only filled
 * when it is currently empty/null — so persisted sentences (and any the student
 * added) survive, and re-generation (e.g. after "Analyse more" adds techniques)
 * fills only the new empty slots. Each filled slot becomes a one-element list.
 * Result is always exactly `length` long.
 *
 * @param prev    existing exercises (array of lists/strings/null) — preserved
 * @param parsed  AI output: [{ index, sentence }, …]
 * @param length  number of techniques (final array length)
 */
export function mergeExercises(prev, parsed, length) {
  const n = Number.isInteger(length) && length > 0 ? length : 0;
  const base = Array.isArray(prev) ? prev : [];
  const merged = Array.from({ length: n }, (_, i) => normalizeSlot(base[i]));
  const items = Array.isArray(parsed) ? parsed : [];
  for (const item of items) {
    if (item && Number.isInteger(item.index) && item.index >= 0 && item.index < n
        && (!merged[item.index] || merged[item.index].length === 0) && item.sentence) {
      merged[item.index] = [item.sentence];
    }
  }
  return merged;
}

/**
 * Pure: append a new practice sentence to a technique's slot, keeping the old
 * ones (de-duped, ignores blanks). Returns a new array (immutable).
 */
export function appendSentence(prev, techIdx, sentence) {
  if (!Array.isArray(prev) || !Number.isInteger(techIdx) || techIdx < 0 || !sentence) return prev;
  const cur = normalizeSlot(prev[techIdx]) || [];
  if (cur.includes(sentence)) return prev; // never duplicate
  const next = prev.slice();
  next[techIdx] = [...cur, sentence];
  return next;
}

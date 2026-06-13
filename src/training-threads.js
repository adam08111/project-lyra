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
export const TRAINING_EXERCISES_KEY = "lyra-training-exercises";

/**
 * Pure: fold freshly generated sentences into the existing exercise array
 * WITHOUT overwriting sentences that are already set. A slot is only filled
 * when it is currently null/undefined — so persisted sentences survive, and
 * re-generation (e.g. after "Analyse more" adds techniques) fills only the
 * new empty slots. Result is always exactly `length` long.
 *
 * @param prev    existing exercises (array or null) — preserved where present
 * @param parsed  AI output: [{ index, sentence }, …]
 * @param length  number of techniques (final array length)
 */
export function mergeExercises(prev, parsed, length) {
  const n = Number.isInteger(length) && length > 0 ? length : 0;
  const base = Array.isArray(prev) ? prev : [];
  const merged = Array.from({ length: n }, (_, i) => (base[i] != null ? base[i] : null));
  const items = Array.isArray(parsed) ? parsed : [];
  for (const item of items) {
    if (item && Number.isInteger(item.index) && item.index >= 0 && item.index < n && merged[item.index] == null) {
      merged[item.index] = item.sentence;
    }
  }
  return merged;
}

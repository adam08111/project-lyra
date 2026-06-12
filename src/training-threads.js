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

/**
 * GENRE CUES — deterministic detection of explicit format instructions in a
 * topic ("write a letter to the editor…"), so a type mismatch is caught for
 * free (no AI call) before/while the session runs under the wrong exam
 * convention block.
 *
 * TAXONOMY PATCH (deliberate nearest-fit): letter-to-editor and speech map to
 * `persuasive` because the app's writingTypes has no dedicated genre for them
 * yet — the real fix is expanding the genre taxonomy (out of scope for now).
 */

import { writingTypes } from "./constants.js";

const CUES = [
  { re: /letter to (the )?editor/i, typeId: "persuasive", cueLabel: "Letter to the Editor" },
  { re: /(write|writing) a (short )?story|story (which|that) begins/i, typeId: "story", cueLabel: "Story" },
  { re: /(write|writing) a speech|speech for/i, typeId: "persuasive", cueLabel: "Speech" },
  { re: /letter of complaint|complaint letter/i, typeId: "complaint", cueLabel: "Complaint Letter" },
  { re: /(write|writing) a report/i, typeId: "report", cueLabel: "Report" },
  { re: /(write|writing) an? (formal )?email/i, typeId: "email", cueLabel: "Email" },
  { re: /(write|writing) an article/i, typeId: "essay", cueLabel: "Article" },
  { re: /(write|writing) an essay|do you agree|to what extent/i, typeId: "essay", cueLabel: "Essay" },
];

/**
 * Detect an EXPLICIT format instruction in the topic.
 * @returns {{ cueLabel: string, typeId: string } | null}
 *  null when no cue matches OR when ≥2 cues mapping to DIFFERENT typeIds
 *  match (ambiguous → stay silent rather than nag wrongly).
 */
export function detectFormatCue(topic) {
  if (!topic || typeof topic !== "string") return null;
  const hits = CUES.filter(c => c.re.test(topic));
  if (hits.length === 0) return null;
  if (new Set(hits.map(h => h.typeId)).size > 1) return null;
  return { cueLabel: hits[0].cueLabel, typeId: hits[0].typeId };
}

/** Display label for a writingTypes id (falls back to the id). */
export const typeLabelOf = (typeId) => writingTypes.find(w => w.id === typeId)?.label || typeId || "";

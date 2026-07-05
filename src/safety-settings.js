// src/safety-settings.js — §102 F4. Explicit Gemini safetySettings for a minors'
// English coach. ONE shared source imported by BOTH proxies (server/proxy.js dev +
// api/gemini.js prod) so dev and prod can't drift on what a 14-year-old is protected
// from (§3 single source of truth). Lives in src/ (NOT server/) so Vercel bundles it
// for api/gemini.js — server/ is .vercelignore'd (same reasoning as token-metrics.js).
//
// THRESHOLD DECISION (§102, three-lens judge-panel synthesis): all four settable
// categories at BLOCK_MEDIUM_AND_ABOVE — deliberately EXPLICIT, never left to the
// Gemini 2.x/3.x permissive defaults (leaving it implicit means the vendor's
// undocumented default governs what a minor sees). One notch BELOW the maximum
// (BLOCK_LOW_AND_ABOVE) on purpose: LOW fires on the mere PRESENCE of a sensitive
// topic, and every GCSE/HKDSE set text — Owen's war poetry, Of Mice and Men, Romeo &
// Juliet, To Kill a Mockingbird, knife-crime / anti-racism persuasive essays — IS a
// sensitive topic, so LOW would routinely refuse the syllabus (a product failure).
// MEDIUM clears literary DEPICTION/analysis (Gemini rates it LOW–MEDIUM) while still
// blocking genuinely harmful, actionable, or explicit generation aimed at a minor
// (rated HIGH). Never BLOCK_NONE — that cedes the child-safety floor to the vendor.
// The settings gate BOTH the student's pasted text AND the coach's reply, on the text
// AND photo-OCR paths (they share this request body). NOT the TTS path — that is a
// single app-clamped dictionary word (near-zero risk, a separate request shape).
// MONITORED FALLBACK: if real set-text sessions get blocked, loosen DANGEROUS_CONTENT
// ALONE to BLOCK_ONLY_HIGH (still explicit, still a floor) — never all four. Do NOT
// "consolidate" this away: the explicitness IS the fix.
export const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

// Companion to the thresholds (NON-NEGOTIABLE #7 — never-stuck / honest empty state):
// once blocking is active, Gemini can return a candidate with finishReason "SAFETY" and
// NO text parts, or a prompt-side promptFeedback.blockReason with no candidate at all.
// Without this guard that surfaces to the student as a silent blank reply / eternal
// spinner. The proxies detect the block and emit this honest, retryable message instead
// of an empty payload — a visible, recoverable outcome, not a stuck one.
export const SAFETY_BLOCK_MESSAGE =
  "I can't help with that particular text — let's keep it to your own writing. Try a different passage.";

// Content-driven terminations that leave NO usable text — ALL must surface as the honest
// message above, never a silent blank (#7). SAFETY = the safetySettings block; RECITATION
// fires when the model would reproduce copyrighted text (this app analyses published
// articles, so it is a real case here, not just theoretical); BLOCKLIST /
// PROHIBITED_CONTENT / SPII / OTHER are the remaining content stops. STOP and MAX_TOKENS
// are deliberately NOT here — those carry real (or partial-real) output to show.
export const BLOCKING_FINISH_REASONS = new Set([
  "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER",
]);

// True when Gemini blocked/emptied the request or response for a content reason (a
// prompt-side block, or a candidate that finished for one of the reasons above). Always
// paired with a `!text` check so a partial/real answer is never overridden. Never throws.
export function isSafetyBlocked(geminiData) {
  if (geminiData?.promptFeedback?.blockReason) return true;
  const finish = geminiData?.candidates?.[0]?.finishReason;
  return Boolean(finish) && BLOCKING_FINISH_REASONS.has(finish);
}

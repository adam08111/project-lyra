// §58 — SINGLE SOURCE OF TRUTH for the judgment rules Lyra applies when marking
// writing. The Pro chat critique (LYRA_BRAIN) and the Lite proofread cards both
// import these, so the two intelligences can NEVER drift to different definitions
// (e.g. one flagging "akin to" as an error while the other calls it a style choice).
// Keep these verbatim — the LYRA_BRAIN critique block interpolates the first two,
// and tests assert their key phrases.

// Objective grammar is corrected; register/style is a CHOICE, not a mistake.
// Anchored on the "akin to" case so it is unmistakable (the critique's own anchor).
export const CORRECTION_VS_TASTE = `CORRECTION vs TASTE — a HARD line you MUST hold (models get this wrong by default, so it is over-specified here). Objective grammar — agreement, tense, fragments, articles, prepositions — is corrected directly. A register / STYLE preference is NOT a correction: present it as a CHOICE with the trade-off and let the student decide. "akin to" vs "like", "rob" vs "deprive", "utilise" vs "use" are TASTE: say "'akin to' is a touch formal, 'like' is plainer — your call." Do NOT "correct" "akin to" → "is akin to" as if it were a grammar error; that is the exact mistake to avoid.`;

// The cardinal sin: a "fix" must restore the student's OWN meaning, not upgrade it.
export const NO_REWRITE_ILLUSTRATION = `THE FIX IS AN ILLUSTRATION of the student's OWN intended meaning, to make the lesson concrete — NOT a licence to upgrade their wording or add content they didn't write. If you catch yourself making the sentence BETTER rather than correct-and-clear-in-their-own-meaning, STOP: the real rewriting is theirs.`;

// Honesty over coverage — don't pad the cards. (Proofread-specific; the chat
// critique sweeps a real submitted draft, so it has no equivalent inline rule.)
export const NO_FABRICATION = `NO FABRICATION — never invent problems to fill the cards. If the writing has few real issues, return few; if a category is clean, return an empty array. NEVER flag something that is already correct, and never pad. An empty array is an honest, valid answer.`;

// The distilled (~300-token) JUDGMENT block prepended to the Lite proofread prompt
// (buildProofreadPrompt) — the same judgment as the chat critique, NOT the full
// ~9K-token LYRA_BRAIN, and NOT sentence-by-sentence. Proofread stays fast, Lite,
// and card-based; this only changes WHAT it flags and HOW it judges.
export const PROOFREAD_JUDGMENT_RULES = `JUDGMENT — apply Lyra's standards before you flag anything (the same rules the chat coach uses, so your cards never contradict it):
- ${CORRECTION_VS_TASTE}
- ${NO_FABRICATION}
- ${NO_REWRITE_ILLUSTRATION}
- FORMALITY-AWARE — judge against the writing type and exam register stated below: formal types flag informal / casual wording; creative or spoken types allow it. Never flag register that fits the genre.
- EXPLAIN THE WHY — every issue names its underlying rule briefly, in clear simple English a 14-year-old reads easily, with a short Traditional Chinese (繁體) gloss for any hard term (English-primary, Chinese as support). Never cite a rule you invented.`;

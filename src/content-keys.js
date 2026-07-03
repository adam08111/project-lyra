/**
 * CONTENT KEYS — the single source of truth for learning-data dedup identities.
 *
 * Each function computes the exact string learning-sync.js uses to dedup one
 * learning-data type in localStorage. They were extracted here from the inline
 * versions that lived in learning-sync.js because in P0 Phase 1 they ALSO become
 * the server-side dedup identity — `unique(student_id, type, content_key)` in the
 * Supabase schema. Local and remote dedup MUST agree, so there can be exactly ONE
 * definition of each: any drift silently forks local vs remote dedup. Keep these
 * BYTE-IDENTICAL to the strings learning-sync.js used to compute inline — the
 * existing learning-sync / learning-sync-dedup / authentic-growth tests are the
 * proof of that identity and must pass unmodified.
 */

// Normalize a growth before/after sentence: lowercase, collapse whitespace, trim.
// Part of the growth key definition AND feeds isAuthenticGrowth in learning-sync.js.
export const normGrowthText = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Grammar Log entry → dedup by phrase + correction (case-folded).
export const grammarKey = (e) => `${(e.phrase || "").toLowerCase()}|${(e.correction || "").toLowerCase()}`;

// Skill deployment → dedup by skill name + the student's application (case-folded).
export const skillKey = (s) => `${(s.skillName || "").toLowerCase()}|${(s.studentApplication || "").toLowerCase()}`;

// Growth before/after pair → dedup by normalized before + after.
export const growthKey = (e) => `${normGrowthText(e.before)}|${normGrowthText(e.after)}`;

// Structure → dedup by name.
export const structureKey = (s) => s.name;

// Vocabulary → dedup by the strong word.
export const vocabKey = (v) => v.strong;

// Masterclass report → dedup by the upgraded ("after") sentence, trimmed.
export const reportKey = (r) => (r.after || "").trim();

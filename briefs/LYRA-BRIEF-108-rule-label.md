# BRIEF §108 — Rule labels: name the rule, kill the "Grammar fix" fallback dominance

> Self-contained executor brief. Independent of §106/§107 (can run in parallel or first —
> Step 0 renumbers to tip+1 if landing order differs). One small session.

## Context

`student_rule_frequency` — the CIP query and the dashboard's core cell — currently
degrades to "Grammar fix ×8" because the §70 fallback label dominates: the model often
omits a specific rule name, and the parser substitutes the generic. A prompt-side nudge
turning "Grammar fix" into "Subject–verb agreement" converts the view from
plumbing-proof into a pedagogy instrument. High CIP value, minimal risk.

## Decisions — do NOT relitigate

Pedagogy is law (`lyra-brain.js`): patterns over instances; correction-vs-taste; no
scaffolding leaks — the rule name is student-facing language. Single source of truth:
if the instruction is shared across proofread and chat-critique surfaces, it lives in
ONE shared constant (`judgment-rules.js` pattern), imported by both. The §70 fallback
parser guard STAYS (a missing label must still never break parsing).

## New decisions this brief sets — RATIFY before executing

- **D-C1 Instruction shape:** every grammar correction must carry a specific named rule
  in plain student-facing English (e.g. subject–verb agreement, tense consistency,
  articles, prepositions, run-on sentence, sentence fragment, plural forms, word form,
  comparatives, conditionals) — "name the one rule a teacher would name; never write
  'grammar fix' or any generic label." Guidance list, not a closed enum: the model may
  name a rule outside the list if it is specific.
- **D-C2 Content-key consequence, accepted:** rule text feeds the grammar dedup
  content key, so newly-named rules create new keys. Server is append-only; historical
  "Grammar fix" rows stay as-is; no migration, no relabeling of history. Note it in
  the § entry so the census reader isn't surprised.

## Steps

**Step 0 — verify reality.** Read `CLAUDE.md`, § tip. Locate where rule strings
originate and where the §70 fallback applies: expected `src/prompts.js` (proofread +
critique builders), `judgment-rules.js`, `learning-sync.js` / parser. Confirm which
surfaces emit grammar-log entries (the §104 matrix says three producers). STOP if the
label pipeline differs materially from this picture.

**Step 1 — the nudge.** Add the D-C1 instruction at the point(s) where corrections are
requested. If two builders need it, extract ONE constant and import twice. Smallest
diff; no other prompt text touched; no scaffolding language a student could see leak.

**Step 2 — tests.** Prompt-contains assertions for the instruction (both surfaces if
shared); existing `prompts.test.js` / brain byte-assertions must still pass UNMODIFIED
unless they assert on the exact region changed — if so, report before editing them.
Parser fallback test still green.

**Step 3 — docs + landing.** § entry with D-C2 noted, tip sha, commits, FF-land, sha
recorded.

## Manual verification (Adam)

Run proofread on a draft seeded with 3 distinct known errors (one agreement, one tense,
one article) → the Grammar Log entries carry three *different, specific* rule names →
`select * from student_rule_frequency` shows named rules accumulating, generic label
absent from new rows.

## Out of scope

Relabeling historical events. Any parser/schema change. Any dashboard change. Any
taxonomy enforcement server-side.

## Karpathy close

This is a one-constant diff plus tests. If it grows beyond that, something is wrong —
stop and report. Land FF, record the sha.

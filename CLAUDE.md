# CLAUDE.md — Lyra working discipline

Lyra is a mobile-first **React 18 + Vite** AI writing coach for **14-year-old Hong Kong English learners**. AI calls go `callAI()` → `/api/gemini` → `server/proxy.js` (hides the key) → **Google Gemini**, three-tier (see `ai-router.js`). Persistence is `localStorage`. Tests: `npx vitest run`.

This file is auto-loaded every session — **read it before every task.** It is terse on purpose; deeper detail lives in the pointed-to docs. The recurring failures across §22–§63 were not blind-start — they were **drift** over long sessions (work left local-only, rules duplicated until they diverged, prompt scaffolding leaked to students, AI calls froze). The non-negotiables and checklist below target exactly those.

## NON-NEGOTIABLES (read before every task)

1. **KARPATHY DISCIPLINE** — Read the relevant files FIRST, then plan, then make the *smallest* diff that works. Commit per logical unit with a clear message. No broad rewrites, drive-by refactors, or speculative abstraction.
2. **PUSH DISCIPLINE** *(the #1 recurring failure — work has sat local-only for ~2 weeks, flagged 4×)* — At session end, push the branch AND land it on `origin/main`. Never leave work local-only. Worktree caution: `git merge-base --is-ancestor origin/main HEAD` → if fast-forward, `git push origin <branch>:main`; if NOT fast-forward, STOP, report the divergence, never force. Report the commit list pushed + the new `origin/main` sha. (Never delete branches — branch hygiene is report-only.) **Landing on `origin/main` requires the maintainer's same-session approval; if not granted, push the branch and report the pending land — never leave work unpushed.**
3. **SINGLE SOURCE OF TRUTH** — Before adding any rule / definition / constant, CHECK it doesn't already exist (correction-vs-taste, no-fabrication, cluster-by-rule have each been duplicated and drifted). If a rule is shared across surfaces, EXTRACT it to one shared constant both import (e.g. `judgment-rules.js`). Never write a second, divergent copy.
4. **NEVER EXPOSE PROMPT SCAFFOLDING** — Everything a model emits is read directly by a 14-year-old. No internal labels ("Pass A/B"), phase names, index shorthand ("S7→S9"), raw markdown headers, or LaTeX in student-facing output. The structure is for you; the words are for the student.
5. **VERIFY BEFORE FIX (review work)** — List findings first, try to DISPROVE each against the code, classify CONFIRMED / REJECTED / N-A with `file:line`. On a review request, do not auto-fix — surface the verdicts and wait for approval.
6. **CHECK — DON'T ASSUME** — Asked "is X done / was Y fixed?": VERIFY against the actual code before re-implementing. (§47's storage cap was already done; re-running would have wasted effort or broken working code.)
7. **ERROR STATES / NEVER-STUCK** — Every AI call needs a try/catch that resolves to content, an honest empty state, or a visible error + retry. Never an eternal spinner (proofread froze twice). Surface the proxy's ~180s timeout as a client error, not an infinite load.
8. **LEARNING-SYNC DEDUP** — Any path that can write learning data twice (reload, multi-trigger) must content-key dedup before grammar/growth/skills writes, AND gate the `lyra-growth-pending` increment on *surviving* entries (else phantom practice triggers premature Growth-Report regen).
9. **MOBILE-FIRST + PRESERVE OVERLAYS** — 430px column. UI changes must not break ghost-text alignment, proofread/structural highlights, keyboard scroll/caret visibility, or the §61 writing-frame. Test on the actual narrow viewport.
10. **PEDAGOGY IS LAW** *(not style preference — see `lyra-brain.js`)* — Never write the student's content (a fix ILLUSTRATES their own meaning, never upgrades it). Patterns over instances (group errors by rule). Correction-vs-taste (register is a choice, not an error). English-primary, 繁中 (Traditional, 書面語) as support. Memory discipline: anticipate, don't recite; cite memory explicitly only to mark WINS.

## SESSION CHECKLIST

**BEFORE WORK**
- [ ] Read this file + the `lyra-brain.js` constraints for the surface I'm touching + `LYRA-PROJECT-BRIEF.md` for the area.
- [ ] Confirm the change isn't ALREADY implemented (check-don't-assume).
- [ ] Confirm any rule I'm about to add doesn't already exist elsewhere (single source of truth).

**DURING**
- [ ] Surgical diffs; commit per logical unit.
- [ ] No duplicate rule definitions — extract shared constants.
- [ ] No prompt-scaffolding leaks in any model-facing string.
- [ ] Error + retry state on every new AI call; no path leaves a spinner stuck.
- [ ] Mobile overlays / keyboard / writing-frame still work if I touched the editor.
- [ ] Add a new linear `§` section to `PROGRESS-REPORT.md`.

**BEFORE SESSION END** *(the most-skipped step)*
- [ ] Run the full test suite — all green, note the count (`npx vitest run`).
- [ ] `git status` clean; push the branch to origin.
- [ ] Land on `origin/main` (fast-forward; worktree caution in #2; never force).
- [ ] **RECORD THE LANDED `origin/main` SHA** — in BOTH the session report AND the new `§` entry (§99–§102 kept omitting it; state it every time).
- [ ] Report: the commit list that went up, the `origin/main` sha after, and any stale-branch list (report only).

## DEEPER DOCS (read for the relevant area)
- **`lyra-brain.js`** — the pedagogy/constraint comments: never-write-it, patterns-over-instances, correction-vs-taste, no-rewrite, English-primary, the §48 diagnostic-critique gate, the §63 memory discipline.
- **`judgment-rules.js`** — the shared judgment constants (correction-vs-taste, no-fabrication, no-rewrite) imported by BOTH the chat critique and the Lite proofread — the single source of truth from #3.
- **`report-card-brain.js`** — the Continuous Growth Report schema + tonal discipline (self-contained, `brain:false`).
- **`ai-router.js`** — the three-tier model strategy (PRO / FLASH / LITE) + brain-flag rationale. **Authoritative for the AI/proxy layer.**
- **`LYRA-PROJECT-BRIEF.md`** — architecture, prompt rationale, design decisions. *(Its API/stack section predates the Gemini migration — defer to `ai-router.js` + the code there.)*
- **`PROGRESS-REPORT.md`** — the linear `§` development log; append one section per unit of work.
- **`.cursorrules`** — Cursor's auto-loaded rules; overlaps this file but some architecture lines are stale (single-file / `api.anthropic.com`) — defer to the code.

*Future (not built here): a pre-push git hook enforcing the session-end push would harden the #1 failure — add it later, don't build it now.*

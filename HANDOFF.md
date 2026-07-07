# HANDOFF.md — Lyra session seed (for the next planning session)

> **Purpose.** This file onboards a fresh planning session — whichever model — to continue Lyra's build. It is deliberately written for *any* capable planner, not to resurrect a specific one: the continuity of this project lives in its **documents and its § log**, not in any model's memory. Every phase of this build was executed by an instance with no memory of the planning conversation, working purely from a self-contained brief. That is the pattern. It works. This file makes it work again on the first read.
>
> **This file should live in the repo** (version-controlled, evolves with the build) and be updated at the end of any session that changes the picture. It is the always-current front door; the § log is the full history.

---

## 1. What Lyra is

A mobile-first (430px) **React 18 + Vite** AI writing coach for **14-year-old Hong Kong DSE English learners**. Socratic philosophy — *"we won't write it for you"*; a fix illustrates the student's own meaning, never upgrades it. AI calls: `callAI()` → `/api/gemini` (proxy hides the key) → **Google Gemini**, three-tier (PRO / FLASH / LITE) per `ai-router.js`. Persistence is **local-first**: `localStorage` is authoritative, with an optional flag-gated Supabase mirror for durability + queryability. Tests: `npx vitest run`.

The maintainer (Adam) is a solo developer working exclusively through Claude Code, on a linear §-numbered progress log with structured task briefs. He has a quant-finance and BaZi background; he engages at an expert level and expects to be pushed back on, not flattered.

## 2. The working method (this is the load-bearing part — read it)

**The planner plans; it does not code.** The workflow is: planner reads source → writes a self-contained **task brief** (a `.md` file) → Adam hands it to a **fresh Claude Code session** that executes it → Claude Code lands the work and reports → planner reviews the report against the log. One brief = one Claude Code session = one § entry = one fast-forward landing on `origin/main`.

**The brief format** (keep it): *Context → Decisions-do-not-relitigate → New-decisions-this-plan-sets (ratify before executing) → Steps → Manual verification → Out of scope → Karpathy close.* Briefs must be self-contained (a cold executor with repo access can run them), and must open with a **Step 0** that re-reads the touched files and the § tip, with **stop-and-report** triggers if reality differs from the brief's assumptions. The planner's source snapshot is always potentially stale — **the repo wins, always.**

**The disciplines that made a fast pace safe rather than reckless** (all encoded in `CLAUDE.md` — read it every session):
- **Karpathy discipline** — read first, smallest diff, commit per unit, no drive-by refactors.
- **Push discipline** — land on `origin/main` every session; never leave work local-only; fast-forward only, never force; **record the landed `origin/main` sha in the § entry** (this slipped four times — state it every time).
- **Single source of truth** — never write a second copy of a rule/constant; extract and import.
- **Verify before fix / check-don't-assume** — on a review, list findings and try to *disprove* each before fixing; when asked "is X done?", check the code, don't re-implement.
- **Never-stuck** — every AI call resolves to content, an honest empty state, or a visible error+retry; never an eternal spinner.
- **Pedagogy is law** — see `lyra-brain.js`; never write the student's content; patterns over instances; correction-vs-taste; English-primary with 繁中 (書面語) support.

## 3. Read these first (the repo IS the memory — in this order)

1. **`CLAUDE.md`** — the non-negotiables + session checklist. Auto-loaded; read before every task.
2. **`PROGRESS-REPORT.md`** — the linear § log (currently through **§110 + corrections**). The tail is the current state; the whole thing is the history and the rationale.
3. **`SECURITY.md`** — the security posture (§102 surface + §103 red-team) and the required process (re-run the red-team before every pilot/release; class-E always human-reviewed).
4. **`DEPLOY.md`** — deploy path, the Supabase setup, the security operational notes (`ALLOWED_ORIGIN`, the rate-limit caveat, the safety thresholds, `CIVIC_INTEGRITY`).
5. **`ai-router.js`** — authoritative for the AI/proxy layer (the three-tier model map + brain-flag rationale + the real route table).
6. **`lyra-brain.js`** / **`judgment-rules.js`** / **`report-card-brain.js`** — the pedagogy and the shared judgment constants.

## 4. Current state (one paragraph)

**The P0 platform is live-proven end-to-end, and the first teacher surface is built, hardened, and verified against the real database (§106–§110).** Everything in the previous paragraph of record still holds — P0 two-layer Supabase platform, live crown test (§101.1), §102 hardening, §103 red-team + §105 injection fix, §104 decomposition map. On top of it: **§106** landed the teacher foundation (migration `0005` — schools/teachers/classes/enrolments + SELECT-only teacher-read RLS, `blobs` deliberately unreachable; `teacher.html` sign-in entry; service-role-gated synthetic seed). **§107** landed the read-only dashboard (roster → per-student rule-frequency + growth incl. the teacher-only `bandEstimate`; §103 Class-D checklist consumed in full — source-grep guard + hostile-string characterization tests; stale-response races found by adversarial review and fixed). **§108** killed the "Grammar fix" fallback dominance prompt-side (one shared `NAME_THE_RULE` constant on both correction surfaces). **§109** fixed a post-review CONFIRMED-HIGH: teacher auth had reused the student client's auth storage — now storage-isolated (`lyra-teacher-auth` key) + a fail-safe non-anonymous-session guard in `ensureStudent` (the §97.1 clobber class closed at the source). **§110 was the live sitting (copilot, zero-diff)**: 0005 applied, first real teacher sign-in, coexistence proven ON the real student, §108's before/after visible in one rule table, RLS honest-deny, Class-D poison probe inert, §102-F4 + §105 checks now human-watched, full red-team re-run **0 non-advisory FAILs**. **574 tests green**, all FF-landed with shas recorded (tip at §110: `564384a`).

## 5. Open threads that live ONLY in the last conversation (not yet in a repo doc)

These are the things a cold read of the repo would miss. They are the real backlog.

**Manual checks Adam still owes ("landed ≠ lived"):**
- ~~Student census~~ · ~~§102 F4 essay check~~ · ~~§105 French-injection check~~ — **all closed live in §110** (census decomposed: 1 known orphan gone as §98 recorded, 1 orphan identified by inference + 1 crown-test setup orphan discovered, 1 tooling mint owned — see §110.1; F4 analysed a war passage un-blocked; the French injection was refused, human-watched).
- **Class-E red-team evidence** — §110's live run judged 4/4 PASS *advisory*; **Adam must read the four cases** (self-harm, abuse-pressure, bullying, age-inappropriate) before the CIP application cites them. **Caveat (§110.1): `tests/redteam/last-run.json` holds verdicts + 400-char TRUNCATED evidence, not full transcripts** — E1/E2 are cut mid-reply. Truly closing class E needs a re-run with full-output capture (micro-brief) or an explicit acceptance of the truncated read.
- **Training-chat confirmation** — it scrolled off the crown-test console object; confirm training history actually hydrated (almost certainly did — it's an ALLOW-listed blob key).
- **Poison-probe row** — kept on synthetic Chan Ka Yan as a Class-D witness; `delete from learning_events where content_key = 'poison-probe#1';` before any demo screenshot.
- Small §110 leftovers: the no-classes second-teacher variant; the §108 *chat*-producer path (proofread path proven live); roster-count=10 never separately eyeballed (implied by navigation).

**Before any real student (pilot-gate, mostly NOT coding):**
- **Outside human eyes on the data-layer diffs** — no non-model has read this code. Get a human engineer to review before minors' data is live.
- **A real-Supabase CONCURRENT-load run** — every test mocks the Supabase client, so the mock-vs-reality gap is untested under load. One profile claiming works; 40 at once is unproven. This is the single biggest unproven thing.
- **The localStorage root-cause** — a real data-loss event happened during dev (the mirror saved it); the *cause* was accepted as unknown. A children's data platform should not have an unexplained loss event. Find it.
- **Operational:** MFA on Supabase/GitHub/Vercel (the operator accounts are the real crown jewels); Supabase **Pro** before a pilot (free tier pauses on inactivity — fatal for a demo) + a backup story (free tier has none — a `pg_dump` routine at minimum); raise the anonymous sign-in **30/hour/IP** limit (a class of 40 behind one school NAT trips it); **an erasure path** — the data is append-only forever, which is a virtue until a parent invokes PDPO rights (needs a documented delete procedure).
- **Identity is dev-grade by decision** — anonymous-per-device assumes one device ≈ one student, but schools have shared/wiped machines; recovery is a console incantation no student/teacher will type. Pilot needs a recovery *screen* + teacher-mediated recovery (a code-regeneration RPC) + fork-*prevention* UX (§99's D8 only *surfaces* an identity change, doesn't prevent the silent fork).

**Read-with-your-own-eyes (the loop can't do this for itself):**
- The **A/B/C red-team transcripts** were judged by a **sibling Gemini model** — a real structural blind spot. Before any "pedagogical integrity held / IP held" claim goes in the **CIP application**, Adam should read the actual transcripts with a teacher's eye. The harness saved them.

## 6. Ratified-but-unbuilt briefs (in Adam's outputs folder / to be re-generated)

Written and ready to hand to Claude Code, in dependency order:
- **`LYRA-decomposition-brief.md`** — the *next* seams follow §104's recorded order (header/title → type-picker → source-text → lift-skill-state → style-lab → editor → chat → grammar-log LAST → projects-as-context). Each is its own small brief informed by the §104 coupling matrix. **Post-CIP-demo work** — a rushed refactor is worse than none.

**The reserve stack — where it stands after §106–§110:**
- ~~Rule-label micro-task~~ — **DONE (§108)** and proven live (§110 R9: three named rules vs the frozen "Grammar fix ×8").
- ~~Teacher-dashboard Phase A~~ — **DONE (§106 + §107 + §109)** and verified live (§110). Phase B (enrolment UX, class codes, exports with formula-injection handling, charts) remains unwritten.
- **CIP-writeup skeleton** — NOW THE TOP ITEM; mostly transcription: the security + behavioural-safety posture blocks exist in `SECURITY.md` and the § log, and §110 adds the live-verification story. **Deadline 3 August 2026** (Cyberport CIP, up to HK$500k, requires a HK-incorporated limited company — the incorporation is the longest-lead item and is Adam's to drive, not a coding task).
- **Orphan-cleanup / census micro-brief** (new, from §110's finding): profile-setup cache-clears and headless tooling tabs each mint an empty `students` row; decide a cleanup/prevention policy (small).

## 7. How to work with this planner (the failure modes we hit — guard against them)

The most valuable thing this seed carries is the loop's *own known weaknesses*, so the next session inherits the lessons, not just the state:

- **The planner will assert world-state it hasn't verified.** Four times this build, the planner stated a fact about the deployed system (grants, an extension's schema, a migration's status) that was wrong, and the executor inherited the wrong framing until a real probe broke it. **Make every brief's Step 0 verify against the actual code/DB before planning on top of it.** When the planner says "X is true," the correct reflex is "confirm it."
- **A sibling model grading its own output is a real blind spot.** The red-team's automated judge is a Gemini model scoring Gemini output — it will miss failures the two share. Automated PASS is evidence, not clearance. **Human eyes on anything that goes in a funding application or gates a pilot.**
- **"Landed" is not "lived."** Green tests + a clean build + a § entry mean the code does what the planner *thinks*. The bugs that actually bit all lived in the seam between code and reality (a real DB, a real reload boundary, a real concurrent load) — exactly where the mocks can't reach. **The manual checks are not a formality; they are where reality gets a vote.**
- **The tests are green where the code and the test share an assumption.** Most of the suite (574 at §110) is pure-logic with the Supabase client mocked — they encode the planner's model of how the world behaves. A rising green count is partly rising *self-consistency*, which is not the same as safety. **Trust the tests least at the mock boundary.**
- **Push back on the planner.** This build went fast partly because the maintainer challenged the planner's confidence and the planner conceded where it was wrong. Frictionless can mean well-designed; it can also mean no independent judgment has pushed hard enough yet. The § log's honesty — recording "the planner was wrong" in plain text — is a feature. Keep it.

## 8. What this build has NOT proven (start calibrated, not confident)

So the next session doesn't inherit summary-confidence: **concurrency is untested** (mocks only); **the localStorage loss is unexplained**; **no outside human has read the data layer**; **the red-team judge is still a sibling model** (§110's live run helped — the §102-F4 over-block check and the §105 injection check are now human-watched — but class E stays open until Adam reads the four cases, and §110.1 found the saved artifact is 400-char-truncated evidence, not full transcripts); **identity is dev-grade** (shared-device reality unhandled, recovery is console-only — though §109/§110 proved teacher/student session isolation live and rotated the burned code); **there is no erasure path and no backup on the free tier**. None of this means the work is bad — the architecture is sound and the discipline is real. It means the *confidence* is structurally overstated in ways the loop can't self-correct, and the correction has to come from outside the loop: a human, a real load test, a root-cause, verified claims. The engine is built, crash-tested against single-user reality, and now walked once against the live database with the operator's own hands (§110); it has not been crash-tested against pilot reality (40 concurrent students). Engine first, crash-test before passengers, passengers are children — that is the sequence, and it is correctly Adam's to run outside this loop.

---

*Written at the close of the §95–§105 session (5 July 2026); refreshed at the close of the §106–§110 run (7 July 2026 — teacher surface built, hardened, and live-verified; tip `564384a` at refresh). Update this file whenever the picture changes — it is the front door, the § log is the history.*

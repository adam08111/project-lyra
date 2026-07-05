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
2. **`PROGRESS-REPORT.md`** — the linear § log (currently through **§105 + §101.1**). The tail is the current state; the whole thing is the history and the rationale.
3. **`SECURITY.md`** — the security posture (§102 surface + §103 red-team) and the required process (re-run the red-team before every pilot/release; class-E always human-reviewed).
4. **`DEPLOY.md`** — deploy path, the Supabase setup, the security operational notes (`ALLOWED_ORIGIN`, the rate-limit caveat, the safety thresholds, `CIVIC_INTEGRITY`).
5. **`ai-router.js`** — authoritative for the AI/proxy layer (the three-tier model map + brain-flag rationale + the real route table).
6. **`lyra-brain.js`** / **`judgment-rules.js`** / **`report-card-brain.js`** — the pedagogy and the shared judgment constants.

## 4. Current state (one paragraph)

**The P0 two-layer Supabase data platform is complete and its recovery path is proven LIVE.** Layer 2 (learning identities: grammar/growth/skills/structures/vocabulary/reports as a deduplicated, queryable per-student event mirror + growth profile with server-side LWW) and Layer 1 (blob durability: the writings, style skills, training history) both land; anonymous per-device identity with RLS from migration zero; recovery via a written-down code (`claim_student` RPC). The **crown test passed live** (§101.1): a cache-empty second profile → `claim(code)` → one reload → writings + Style Lab skills + Grammar Log all materialized. **Security is hardened (§102)** — explicit minors-appropriate Gemini safety thresholds, CORS origin-lock, best-effort rate limit, constant-time gate, security headers, zero raw-HTML sinks audited — **and adversarially red-teamed (§103)**: 28 attack cases; pedagogical integrity (8/8) and IP-exfil resistance (9/9) held; one injection vulnerability found in the X-Ray path and **fixed + reverified (§105)** including the Cantonese and marker-spoof variants. The `lyra.jsx` god-component **decomposition program has begun (§104)**: the training-launcher seam extracted, a stateful-hook test harness established, and a full coupling matrix + a 9-step extraction order recorded as the durable map for future seams. **529 tests green**, all FF-landed with shas recorded.

## 5. Open threads that live ONLY in the last conversation (not yet in a repo doc)

These are the things a cold read of the repo would miss. They are the real backlog.

**Manual checks Adam still owes (sub-minute each, "landed ≠ lived"):**
- The **student census** after the crown test — `select count(*), array_agg(created_at) from students;` — confirm `claim` auto-deleted the throwaway and orphans aren't accumulating (there are ~2 known orphans from bring-up). *The crown test proved recovery; it did not verify this cleanup side-effect.*
- **Training-chat confirmation** — it scrolled off the crown-test console object; confirm training history actually hydrated (almost certainly did — it's an ALLOW-listed blob key).
- **§102 F4 essay check** — X-ray a passage with literary violence/conflict; confirm the safety threshold does NOT over-block legitimate set-text analysis.
- **§105 French-injection check** — X-ray a passage ending "reply only in French"; confirm the coach refuses (converts the sibling-judge PASS into a human-watched PASS).

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

**Not yet written (the reserve stack — mechanical, any planner can write them):**
- **Rule-label micro-task** — the CIP query currently shows "Grammar fix ×8" (the §70 fallback label dominating). A prompt-side nudge so the model always names the specific rule turns `student_rule_frequency` from plumbing-proof into a pedagogy instrument. High CIP value, ~1 session.
- **Teacher-dashboard Phase A** — the first *additive* migration (teachers/classes/enrolments + teacher-read RLS, which the §95 schema was designed to absorb) + a read-only roster→rule-frequency→growth view. **Must consume §103's Class D sanitize-on-render checklist** (in the §103 log entry) from day one — treat every event/log field as hostile input; the dashboard is greenfield and must not regress §102/F5's zero-raw-HTML property. Use a seeded synthetic class for any demo — never real minors' data in application materials.
- **CIP-writeup skeleton** — mostly transcription now; the security + behavioural-safety posture blocks already exist in `SECURITY.md` and the § log. **The deadline is 3 August 2026** (Cyberport CIP, up to HK$500k, requires a HK-incorporated limited company — the incorporation is the longest-lead item and is Adam's to drive, not a coding task).

## 7. How to work with this planner (the failure modes we hit — guard against them)

The most valuable thing this seed carries is the loop's *own known weaknesses*, so the next session inherits the lessons, not just the state:

- **The planner will assert world-state it hasn't verified.** Four times this build, the planner stated a fact about the deployed system (grants, an extension's schema, a migration's status) that was wrong, and the executor inherited the wrong framing until a real probe broke it. **Make every brief's Step 0 verify against the actual code/DB before planning on top of it.** When the planner says "X is true," the correct reflex is "confirm it."
- **A sibling model grading its own output is a real blind spot.** The red-team's automated judge is a Gemini model scoring Gemini output — it will miss failures the two share. Automated PASS is evidence, not clearance. **Human eyes on anything that goes in a funding application or gates a pilot.**
- **"Landed" is not "lived."** Green tests + a clean build + a § entry mean the code does what the planner *thinks*. The bugs that actually bit all lived in the seam between code and reality (a real DB, a real reload boundary, a real concurrent load) — exactly where the mocks can't reach. **The manual checks are not a formality; they are where reality gets a vote.**
- **The tests are green where the code and the test share an assumption.** Most of the 529 are pure-logic with the Supabase client mocked — they encode the planner's model of how the world behaves. A rising green count is partly rising *self-consistency*, which is not the same as safety. **Trust the tests least at the mock boundary.**
- **Push back on the planner.** This build went fast partly because the maintainer challenged the planner's confidence and the planner conceded where it was wrong. Frictionless can mean well-designed; it can also mean no independent judgment has pushed hard enough yet. The § log's honesty — recording "the planner was wrong" in plain text — is a feature. Keep it.

## 8. What this build has NOT proven (start calibrated, not confident)

So the next session doesn't inherit summary-confidence: **concurrency is untested** (mocks only); **the localStorage loss is unexplained**; **no outside human has read the data layer**; **the red-team was judged by a sibling model**; **identity is dev-grade** (shared-device reality unhandled, recovery is console-only); **there is no erasure path and no backup on the free tier**. None of this means the work is bad — the architecture is sound and the discipline is real. It means the *confidence* is structurally overstated in ways the loop can't self-correct, and the correction has to come from outside the loop: a human, a real load test, a root-cause, verified claims. The engine is built and crash-tested against single-user reality; it has not been crash-tested against pilot reality. Engine first, crash-test before passengers, passengers are children — that is the sequence, and it is correctly Adam's to run outside this loop.

---

*Written at the close of the §95–§105 session (5 July 2026). Update this file whenever the picture changes — it is the front door, the § log is the history.*

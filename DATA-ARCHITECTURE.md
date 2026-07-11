# DATA-ARCHITECTURE.md — Lyra identity, sync & permanence (canonical, status-labeled)

> **Purpose.** The single source of truth for Lyra's identity model, sync semantics,
> and data-permanence strategy. It supersedes every conversation summary. Source
> dialogue: `docs/decisions/identity-conversation-2026-07.txt`. Direction ratified by
> the maintainer **8 July 2026** (Tiers 1–4 + Identity v2 as scoped); each executor
> brief still ratifies its D-numbers at hand-off, per house convention.
>
> **Status vocabulary — every claim carries one; no status, no claim:**
> `LIVE-VERIFIED` proven against the real system, § pointer ·
> `BUILT-UNVERIFIED` landed code, reality untested ·
> `RATIFIED-UNBUILT` direction approved, brief exists or queued ·
> `PROPOSED` needs a decision ·
> `OPERATOR` settings/legal/manual work, maintainer's lane ·
> `OUT-OF-SCOPE` named non-goal.

---

## 0. The one-paragraph truth (as of 8 July 2026)

**No production deployment exists** — Vercel is unregistered (`OPERATOR`, this week;
runbook: DEPLOY.md). Every live verification in the § log ran on localhost against the
real Supabase project; the last such LIVE sitting is **§110** (§111–§113 — the current
tip — are mocked-path tests + a schema migration, not a live sitting). Identity v1 is
`LIVE-VERIFIED`. A few items are now **`BUILT-UNVERIFIED`**: the identity-semantics
tripwires (§111, 589 green, mock-only), the writing-snapshot ledger (§112), and the
auth-cascade sever (§113 draft, corrected to `ON DELETE RESTRICT` in **§115** per BRIEF-FK —
migration authored, not yet applied to the live project).
**Everything else in this document is RATIFIED-UNBUILT, PROPOSED, or OPERATOR.** Any text
describing v2, tiers, or custodians in the present tense is describing a destination.

## 1. Identity

**v1 — anonymous per-device + claim codes.** `LIVE-VERIFIED §95–§110.` Silent
anonymous mint on first open (no email, no password, no PII); recovery code minted
with the row, plaintext on-device, hash server-side; `claim_student` **relocates** an
identity to a device and evicts the previous holder — it is not a sign-in. Code
rotation exists as operator SQL (`LIVE-VERIFIED §110 R3`); a self-service regen RPC
and recovery screens are `RATIFIED-UNBUILT` (BRIEF-112); **teacher-mediated regen is
`RATIFIED-UNBUILT`, pilot-required, own brief** — it is Lyra's first teacher WRITE and
gets its own review. Pilot policy (`RATIFIED-UNBUILT`, pins): one device per student,
phone-canonical, homework-first onboarding, code shown once at enrolment
("write it inside your English notebook cover").

**v2 — anonymous-first, account-attached.** `RATIFIED-UNBUILT, pilot-term.` The mint
stays (zero-friction start is load-bearing pedagogy — micro-sessions die behind any
login). At the *protect-your-work* moment the app offers to attach a personal email;
Supabase's documented conversion upgrades the anonymous user **in place — same
`auth.uid`, all data carries over** (externally verified against Supabase docs, July
2026; adding a password requires the email verified first; attaching an email that
already owns an account errors and needs a handled path). Personal email preferred —
school emails expire at graduation, exactly when "for life" matters. The paper code
demotes to fallback.

**v2 blocking prerequisites, named so nobody builds in the wrong order:**
1. **§109 guard evolution** — the live-verified guard refuses any non-anonymous
   session; it must learn exactly this rule and no looser: *anonymous, OR the
   permanent user who owns THIS student row.* "Any authenticated user" re-opens the
   teacher-session hole §109 closed. `RATIFIED-UNBUILT.`
2. **PDPO consent framework** before any minor's email is collected — parental
   consent mechanics, purpose specification, retention. `OPERATOR-legal, lead time.`
3. **Deployed sync verified on staging first** (§2 note below). `OPERATOR.`

## 2. Multi-device & sync — the ladder

**Rung 0 — today.** `LIVE-VERIFIED.` Per-device identities are **fork-safe by
construction**: two devices = two students; annoying (split record) but nothing ever
overwrites anything, because no two devices share a student. The clobber is not a
live bug — it is what naive shared identity would *introduce*. The identity-semantics
characterization tests (`BUILT-UNVERIFIED` — landed as **§111**, 589 green, mock-only;
brief authored as §113) pin the semantics that make sharing unsafe: whole-blob upsert,
local-vs-last-sent comparison (never recency), fill-empty hydration, the re-seed push.
Adding shared identity without redesigning sync must break those tests first.

**Rung 1 — Single-Active-Device (SAD).** `RATIFIED-UNBUILT, ships with v2.` Sign-in
on a new device evicts the previous one — the relocation semantic `claim` already
implements, with an email instead of paper. Eviction lands at the evicted device's
next boot/sweep, not instantly. Covers ~95% of one student's real life.
**Shared machines remain `OUT-OF-SCOPE`:** SAD protects the mirror, not the previous
kid's essays sitting in a lab PC's localStorage; no mitigation is committed; the
pilot answer is policy (own devices only).

**Rung 2 — versioned recency sync.** `PROPOSED, post-pilot.` Per-writing version
counter, pull-before-push, reject-stale-push, a "changed on your other device — keep
which?" prompt. Converts the silent clobber into a detected conflict. This is the
actual "sync redesign" the tripwires guard.

**Rung 3 — async CRDT per essay.** `PROPOSED`, only if Rung 2's prompt annoys real
users. **Rung 4 — realtime co-editing (the "Google Docs engine"):** `OUT-OF-SCOPE` —
single-author is load-bearing pedagogy (examinees, not co-authors); full cost
inventory in the source dialogue.

## 3. Durability — the event ledger (Tier 1)

**Today.** Layer 2 learning events: append-only, deduplicated, rule-labeled since
§108 — `LIVE-VERIFIED`; the ledger part of the system. Essays: mutable whole-blobs —
deletes propagate, hydration fill-empty, last sweep wins — `LIVE-VERIFIED §101`;
**this is the glass.** The **Continuous Growth report card is ALSO on the glass** (D-I5,
§112): it is LWW-upserted to `growth_profiles` — one mutable row overwritten each
regeneration, NOT archived as-issued (only the separate Masterclass achievement cards
archive append-only as `report` events). The **current** `growth_profiles` row stays LWW
(intended — it is the live view); the append-only archive is now the parallel
`report_snapshots` table — `BUILT-UNVERIFIED — §117 (migration 0008 + emitter, 611 green;
live-unverified — the operator applies 0008 and runs the regen→snapshot manual check).`

**The change: extend the ledger to cover the glass.** `BUILT-UNVERIFIED — §112 (migration
0006 + emitter, 589 green; live-unverified — the operator applies 0006 and runs the
draft→snapshot manual check).` Append-only `writing_snapshots`: a row per meaningful moment
(proofread run, sweep-detected change, deletion-as-tombstone-event). Consequences:
in-app deletion becomes a UI event, not data destruction; vandal/clobber/
unexplained-loss classes lose their teeth; and the product gains its most valuable
object — **draft evolution across years**. Size math: ~3KB/essay, a few hundred
snapshots/student/year ≈ ~1MB/student/year; ten schools × five years ≈ single-digit
GB. There is no cost argument against keeping every draft. Teachers never read
snapshots (essay content — the SELECT-only-no-essays posture extends to this table).
(The §112 D-I5 verify CORRECTED the standing "report cards archive as-issued" claim — see
the growth-report note under **Today** above; the report card WAS on the glass — its
append-only snapshot shipped as `report_snapshots` in **§117** (BRIEF-RS, migration 0008),
mirroring the essay-draft ledger; the live `growth_profiles` row remains the current view.)

## 4. Custody (Tier 2) — the five holders, canonical list

Permanence = multiplied independent custodians, primary copy in the student's hands,
open formats that need no company alive to read. The roster is the **identity
anchor** (school maps UUID→child), *not* a custodian — it holds no writing.

1. **Student's device** — `LIVE` (localStorage authoritative; Safari-eviction risk
   for disused web apps — verify current rules; home-screen-install nudge,
   `OPERATOR`).
2. **Supabase mirror** — `BUILT + LIVE-VERIFIED in dev; nonexistent in production`
   (no deployment). Paid tier before any real user; **verify PITR inclusion on Pro
   vs add-on** (`OPERATOR`).
3. **Offsite encrypted dump** — nightly `pg_dump` to object storage the maintainer
   controls, different provider, restorable anywhere Postgres runs. Survives
   Supabase's bad day *and* the 2029 unpaid invoice. `RATIFIED-UNBUILT — BRIEF-115
   (queued, on request).`
4. **Take-home export** — per-student bundle: essays as Markdown, reports as
   human-readable documents, history as JSON + summary (deliberately not CSV —
   sidesteps formula-injection). Issued at term end as ritual. `RATIFIED-UNBUILT —
   BRIEF-116 (queued).`
5. **School term-dump under the continuity clause** — wind-down obligations in the
   school agreement: exports out and dumps delivered before anything switches off.
   `OPERATOR-legal — Pin B, unwritten.`

## 5. Graduation & alumni. `PROPOSED, post-pilot; first cohort summer 2027.`

Four-part semantic: (1) archive the enrolment — **teacher read ends**, privacy
default, non-negotiable; (2) issue the take-home export regardless of what the
student chooses next; (3) offer the v2 account upgrade-in-place — the decade-scale
identity converting exactly when the student wants to own it; (4) move access from
the school gate to individual auth + alumni tier (`OPERATOR` pricing). **Brain
caveat, standing:** LYRA_BRAIN is DSE-tuned; university register is a *sibling brain
mode* — a deliberate product decision, never a silent stretch of the existing one.

## 6. The moat — with its guardrails inseparable

Per-student: tailoring uses the student's **own** full record — years of rule-labeled
events and draft snapshots let the coach say what no stateless assistant can
("you beat article errors in Form 3 with pattern drills; same avoidance dance with
conditionals now"). Cross-student, the prize is **intervention efficacy** — which
coaching moves reduce which error classes for which learner profiles at which band,
measured by the system's own instrumentation. Guardrails stated in the same breath,
because with minors they *are* the moat: cross-student analysis **will operate under a PDPO
consent framework and be aggregate + de-identified — a v2 prerequisite, NOT yet in force**
(`RATIFIED-UNBUILT`; no consent framework or de-identification pipeline exists today);
essays never leave the tailoring context without that framework; the portability in §4 is
what earns the consent. The quotable paragraph (the bracketed status travels with it):

> **[Ratified design, 8 July 2026 — NOT all built: draft-capture landed §112 but is
> live-unverified; the live essay blob is still overwritable until versioned sync; 2 of 5
> custodians exist; the consent/de-identification guardrails are not yet in force.]**
> Lyra's learning record is event-sourced from the first day of the first pilot — every
> error rule-labeled (live), every draft version captured append-only (built), designed so
> nothing the ledger holds is overwritable, to be held by five custodians including the
> student herself in open formats. That trust architecture is what will let schools consent
> to the thing that compounds: a longitudinal dataset of which interventions actually reduce
> which errors for which learners across the DSE curriculum. Foundation labs have everyone's
> text and no one's trajectory — no school consent chain, no pedagogical labels, no identity
> that persists across a student's years. We're not competing on the model. We're building
> the memory and the outcome evidence the model gets to think with.

*(Status honesty for external use, as of 8 July 2026 — do not quote the paragraph without
the bracketed line: draft-capture landed (§112) but is live-unverified; the live essay blob
is still overwritable until versioned recency sync (Rung 2, PROPOSED); custodians 3–5 are
unbuilt; the PDPO / de-identification guardrails are not yet in force.)*

## 7. Time-critical verifications — this week. `OPERATOR.`

1. **P0 — the summer-purge data-loss chain. FK: FIXED (§115); retention posture: still an
   operator check.** The code-confirmed defect — BOTH `students.auth_user_id` (`0001:20`) and
   `teachers.auth_user_id` (`0005:31`) were `ON DELETE CASCADE`, so a single `auth.users`
   deletion (an anonymous-user auto-purge, or an operator slip) cascade-deleted the entire
   subtree (events, profile, essays, snapshots, enrolments; for a teacher, their classes +
   enrolments) — is **fixed** by migration `0007` (`CASCADE → RESTRICT` on both edges;
   `BUILT-UNVERIFIED` until the operator applies it — DEPLOY.md, §115). With 0007 applied, an
   auth-user deletion that would destroy a subtree **fails loudly** (the correct failure mode);
   legitimate deletion handles the child (`students`/`teachers`) row first, then the auth user.
   The operator retention check remains belt-and-braces: confirm the anonymous-user auto-cleanup
   posture (Hong Kong's summer exceeds 30 days; permanent accounts are exempt from anon cleanup —
   one more reason v2 is the right destination).
2. **Safari eviction rule** current behavior + the install nudge.
3. **Vercel registration** (DEPLOY.md runbook): Hobby = synthetic-data demo only;
   **Pro before any real human types a word** — per Vercel's terms (as understood June 2026,
   `OPERATOR`-verify at registration), Hobby permits model-training on submitted content and
   Pro has it off by default. MFA at signup.

## 8. Build order — the canonical queue

**Operator, parallel:** apply migrations **0006** (snapshots) + **0007** (auth-FK → RESTRICT)
+ **0008** (report snapshots) · the anon-retention posture check · Vercel registration + first flag-OFF deploy ·
successor-package commit (the source transcript into `docs/decisions/`; this document is now
committed, §114) · CIP skeleton, LOIs, incorporation.
**Claude Code — DONE this run:** identity-semantics tripwires (§111) · writing snapshots
(§112) · auth-cascade sever (§113 draft → RESTRICT final §115) · this document + review corrections (§114).
**Claude Code — still pending, in order:** ~~red-team full-output capture (§110.1 finding
#1 — the `last-run.json` truncation)~~ **DONE (§116)** — the harness now stores full,
untruncated reply transcripts (`tests/redteam/record.js`); a live re-run to regenerate
`last-run.json` + the maintainer's **class-E read (OPERATOR)** are what remain of this item →
BRIEF-112 recovery surface (**migration `0010`** — 0006/0007/0008/0009 are taken by snapshots / FK
/ report-snapshots / enrolment; renumbers at its Step 0 if the tree moved) → ~~enrolment~~ **DONE
(§118 — BRIEF-ENROL, migration 0009: class codes + the enrol_student RPC + the one-minute phone
onboarding)** → teacher-mediated regen (own brief, own review) →
BRIEF-115 offsite dump → flag-ON via staging verification → BRIEF-116 take-home export →
~~report-card snapshot (the D-I5 follow-up)~~ **DONE (§117 — BRIEF-RS, migration 0008)**.
**Pilot-term, behind the consent framework:** Identity v2 attach flow + the §109 guard
evolution.
*(Brief IDs are names; the § number is always tip+1 at landing — Step 0 renumbers.)*

## 9. Supersession rule

This document is **committed to the repo as of §114** and supersedes every summary of the
identity/permanence conversation. (Before that commit it was a PROPOSED/OPERATOR artifact —
authority was conditional on landing.) The successor package is not yet complete: the source
dialogue `docs/decisions/identity-conversation-2026-07.txt` is still to be added (an OPERATOR
step in the §8 queue). No pointer, no claim; strip internal pointers from anything external.
Update this file when a listed item changes status — the § log remains the history.

---
*Ratified 8 July 2026 (Tiers 1–4 + Identity v2 direction, maintainer instruction); written
by the planning seat; committed with the §112–§114 review corrections applied. Source
dialogue to be added to `docs/decisions/` with the successor-package commit (§8).*

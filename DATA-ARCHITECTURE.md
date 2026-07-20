# DATA-ARCHITECTURE.md — Lyra identity, sync & permanence (canonical, status-labeled)

> **Purpose.** The single source of truth for Lyra's identity model, sync semantics,
> and data-permanence strategy. It supersedes every conversation summary. Source
> dialogue: `docs/decisions/identity-conversation.md`. Direction ratified by
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
   Supabase's bad day *and* the 2029 unpaid invoice. `BUILT §125 (BRIEF-115) — the
   GitHub Actions workflow (.github/workflows/backup.yml) + the age-encrypted dump +
   backup/RESTORE.md drill are landed; LIVE-VERIFIED only after the operator sets the
   five secrets + the age recipient and the restore drill (D-N4) passes.`
4. **Take-home export** — one self-contained `.html` the student downloads: her
   writing, learning history, and growth report (teacher-only `bandEstimate`
   excluded — mirrors the in-app boundary), plus a machine-readable JSON island;
   own-RLS `writing_snapshots`/`report_snapshots` history folded in when sync is on.
   Deliberately not CSV/XLSX (sidesteps formula-injection). `BUILT §127 (BRIEF-116)
   — client-side, no migration; the operator's phone download check (the brief §5)
   remains for iOS-Safari behaviour.`
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

1. **P0 — the summer-purge data-loss chain. FK: FIXED (§115), applied + live-verified (§119);
   retention posture: resolved (§119 R6).** The code-confirmed defect — BOTH `students.auth_user_id` (`0001:20`) and
   `teachers.auth_user_id` (`0005:31`) were `ON DELETE CASCADE`, so a single `auth.users`
   deletion (an anonymous-user auto-purge, or an operator slip) cascade-deleted the entire
   subtree (events, profile, essays, snapshots, enrolments; for a teacher, their classes +
   enrolments) — is **fixed** by migration `0007` (`CASCADE → RESTRICT` on both edges;
   **applied + verified against the live database at §119** — the `23503` refusal witnessed by hand,
   DEPLOY.md, §115). With 0007 applied, an
   auth-user deletion that would destroy a subtree **fails loudly** (the correct failure mode);
   legitimate deletion handles the child (`students`/`teachers`) row first, then the auth user.
   §119 R6 resolved the retention posture: **no anonymous auto-cleanup setting exists** in this
   project, so the summer-purge auto-deletion §115 feared is **not active** — the RESTRICT edge is
   defense-in-depth (an operator slip, a future cleanup cron, any `auth.users` deletion), not the
   mitigation of a live purge. The one live residual is **F-R6**: raise the default anon sign-in cap
   (30 requests/hour/IP) before a pilot — a class of ~40 behind one school NAT trips it (permanent
   accounts are exempt from anon cleanup — one more reason v2 is the right destination).
2. **Safari eviction rule** current behavior + the install nudge.
3. **Vercel registration** (DEPLOY.md runbook): Hobby = synthetic-data demo only;
   **Pro before any real human types a word** — per Vercel's terms (as understood June 2026,
   `OPERATOR`-verify at registration), Hobby permits model-training on submitted content and
   Pro has it off by default. MFA at signup.

## 8. Build order — the canonical queue. `Refreshed 20 Jul 2026, through §130; live board: CHECKPOINTS.md.`

**Role.** This section is the ordered dependency spine — *why this order* — for the data
layer. The living tick-state of everything not-yet-done now lives in **`CHECKPOINTS.md`** (the
board), the exact SQL apply-order in **`DEPLOY.md`**, the history in the `§` log; on conflict the
board and the log win. (When this section was authored at §114 the board did not exist; the flat
pending queue it once carried moved there — re-listing it here would be a divergent second copy,
which the single-source rule forbids.)

**Migration ledger, in order.** `0006` writing-snapshots · `0007` auth-FK → RESTRICT · `0008`
report-snapshots · `0009` enrolment are **applied + verified against the live database at §119**
(the live sitting — the `23503` crash-test witnessed by hand). `0010` recovery (§121) and `0011`
teacher-mediated regen (§123) are **authored, operator-apply pending (CHECKPOINTS A9)** — applied
in order after `0009`. `DEPLOY.md` is authoritative for the apply-order (`0006 → … → 0011`).

**Sequencing rule (load-bearing).** Data-layer migrations → identity productization → flag-ON →
pilot: engine → crash-test against single-user reality (done, §119) → crash-test against pilot
reality (40 concurrent students — **not yet run; the biggest open risk**) → passengers, who are
children. Identity v2 (the attach flow + the §109 guard evolution) stays behind the PDPO consent
framework (CHECKPOINTS Lane D / B4).

**Status pointer (all tracked on the board).** The Claude-Code queue is **drained through §130**;
the only code item left is flag-ON-via-staging (C5, operator-gated on Vercel A4), with the `D-Q5`
pre-classifier a class-P-FAIL-triggered fast-follow. Operator lane: Vercel (A4) · apply
`0010`/`0011` (A9) · custodian-#3 restore drill (A10) · the successor-package commit (A7 — the §130
drop-slot `docs/decisions/README.md` names its two materials) · CIP incorporation/LOIs/skeleton
(Lane B, deadline 3 Aug). The anon-retention posture check is **resolved (§119 R6)** — no anon
auto-cleanup exists; the residual **F-R6** is raising the 30/hr/IP cap before a pilot. *(The
per-migration `BUILT-UNVERIFIED` labels still in §0/§1/§3 predate §119 and await a whole-document
currency pass — logged, CHECKPOINTS Lane D.)*
*(Brief IDs are names; the § number is always tip+1 at landing — Step 0 renumbers.)*

## 9. Supersession rule

This document is **committed to the repo as of §114** and supersedes every summary of the
identity/permanence conversation. (Before that commit it was a PROPOSED/OPERATOR artifact —
authority was conditional on landing.) The successor package is not yet complete: the source
dialogue `docs/decisions/identity-conversation.md` is still to be added (an OPERATOR
step in the §8 queue). No pointer, no claim; strip internal pointers from anything external.
Update this file when a listed item changes status — the § log remains the history.

---
*Ratified 8 July 2026 (Tiers 1–4 + Identity v2 direction, maintainer instruction); written
by the planning seat; committed with the §112–§114 review corrections applied. Source
dialogue to be added to `docs/decisions/` with the successor-package commit (§8).*

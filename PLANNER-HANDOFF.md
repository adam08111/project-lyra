# PLANNER-HANDOFF.md — for the next planning session (refreshed 11 July 2026)

> **What this is.** The planner-seat layer above the repo's `HANDOFF.md`. Read the repo
> `HANDOFF.md` FIRST (project front door), then the § log tail (§106–§118), then this.
> This file carries what those don't: the seat's state at transition, decisions awaiting
> the maintainer, in-flight work, and the craft of holding this seat with this
> maintainer. Supersedes the 7-July PLANNER-HANDOFF. It decays by design — fold into the
> § log + `HANDOFF.md` and delete once absorbed.
>
> **The continuity is the documents, never the voice.** Every phase here was executed by
> an instance with no memory of the planning conversation, from a self-contained brief.
> You reading this is the mechanism working — twice now. Do not try to be your
> predecessor.

---

## A. State at seat change (11 July 2026)

**Repo tip: §118, `ead61cf`. 628 tests green.** Since the last seat refresh (7 July,
§110): §111–§115 hardened the data layer (identity tripwires, the writing-snapshot
ledger, the auth-cascade P0 fix `CASCADE→RESTRICT`, DATA-ARCHITECTURE.md committed +
adversarially corrected); §116 gave the red-team full-transcript capture; §117 archived
the growth report off "the glass" (`report_snapshots`, per-issuance); §118 built
enrolment (class codes, the `enrol_student` RPC, the one-minute phone onboarding).
**All code-landed, FF-clean, shas recorded.**

**The defining fact, at its historical maximum: eight sections have landed since the
live database was last touched (§110, 7 July).** Four migrations (`0006`–`0009`) are
authored but UNAPPLIED. 628 green is 628 against mocks. The gap between "landed" and
"lived" is the widest it has ever been — not because the work is bad, but because
verification is the maintainer's lane and he has been in build mode. **The single most
important thing you can do is refuse to add scope until the sitting reports.**

## B. The sitting — the one operator action that unblocks everything (~20 min)

Owed since §110, grown each session. In order (DEPLOY.md §3 has the ordered migration
list; full manual checks live in each § entry):
1. Apply `0006`→`0007`→`0008`→`0009` in the SQL editor (after 0005).
2. **§115 D-J3 crash-test** (doubles as orphan cleanup): `delete from auth.users where
   id='<c09dcf1e auth id>'` → **expect the `23503` RESTRICT error** — that error IS the
   fix, witnessed. Then delete `c09dcf1e`'s `students` row (empty subtree cascades),
   then its auth user → both succeed.
3. **§112 snapshot checks:** write→proofread→one row; edit→sweep→row; no-edit→dedup;
   delete→tombstone; teacher `select count(*) from writing_snapshots` denied; flag-off
   zero trace.
4. **§117 report checks:** regen→one row; **each further regen APPENDS a row**
   (per-issuance archive — expected, NOT a dedup no-op; do not file it as a bug);
   `select report->'level'->>'bandEstimate', ts from report_snapshots order by ts`
   shows the band trajectory; teacher `select count(*)` denied.
5. **§118 enrol flow, phone in hand at 430px:** onboarding → overlay → wrong code
   (honest error) → right code + name → confirmation naming class+teacher → the
   recovery code on screen with the notebook line; dashboard shows the student;
   re-enrol → no duplicate; a scratch student named `<img src=x onerror=alert(1)>`
   renders as literal text; flag-off → no overlay.
6. **Live red-team re-run** (`npm run redteam`, dev proxy on :3001) → then **the
   class-E read** — the four full transcripts (§116 made them complete) with a
   teacher's eye. Closes §110.1; gates the CIP integrity claims. NO model verdict
   substitutes for this human read.

## C. Pending decisions + in-flight work

**Brief files that exist** (confirm they reached `briefs/` — §113/§116 both drifted
because canonicals hadn't landed):
- **BRIEF-112 recovery surface** — v1 recovery UX (show/claim/regen screens, the D8
  interstitial). Migration renumbers to **`0010`** at its Step 0. Ratify D-G1–G5 at
  hand-off. Note for its Step 0: `<CodeDisplay>` now exists (§118 built it for reuse —
  single source), and the §118 success screen already banks the code at enrolment, so
  the recovery screen's "show code" is the second surfacing, not the first.

**Briefs NOT written — carried as regeneration-grade specs (deliberate: writing them
under a closing context risks exactly the summary-drift this seat spent two weeks
documenting; they all queue behind the sitting anyway, so nothing is delayed):**
- **BRIEF-teacher-regen** — teacher-mediated code regeneration. **Lyra's first teacher
  WRITE** — SECURITY.md's SELECT-only-teacher posture changes, so: own brief, own
  adversarial review, pilot-required (a lost device can't self-serve regen; the teacher
  is the recovery root — an adult who knows the child's face). Shape: one RPC
  (`teacher_regen_code(p_student_id)` — definer; authorization = the student is
  enrolled in one of the CALLING teacher's classes via `current_teacher_id()`; returns
  a new plaintext code ONCE for the teacher to hand the kid; rotates the hash; never
  logs the code), one dashboard button on the student detail, rate-thought (regen is
  destructive to the old code — confirm step), and **this brief encodes the
  cross-surface/identity-interplay review dimension** (§E-2, still unencoded).
- **BRIEF-115 offsite dump** — custodian #3 (DATA-ARCHITECTURE §4): nightly `pg_dump`
  to object storage the maintainer controls, different provider, encrypted; likely a
  scheduled GitHub Action with the connection string as a repo secret, plus a restore
  runbook paragraph. Survives Supabase's bad day and the unpaid-invoice future.
- **BRIEF-116 take-home export** — custodian #4: per-student bundle (essays as
  Markdown from `writing_snapshots`, reports human-readable from `report_snapshots`,
  history as JSON + summary; **deliberately not CSV** — sidesteps the deferred
  formula-injection problem). Student-triggered, term-end ritual. Can land mid-term.

**Queue order (DATA-ARCHITECTURE §8, canonical):** sitting → BRIEF-112 → teacher-regen
→ BRIEF-115 → BRIEF-116. Named briefs; § number = tip+1 and migration = next-free, both
assigned at Step 0 (the naming convention retired the renumber-cascade problem).

**Undecided — do not resolve unilaterally:** the production sync-flag flip
(staging-verify first; DEPLOY's letter unmet); rung-2 versioned sync (post-pilot — the
real "sync redesign" the §111 tripwires guard); Phase B dashboard (progression view,
`deriveRule` expansion, the 1000-row cap, exports); the bookkeeping-stripped report
dedup (declined — per-issuance is the faithful archive; revisit only on real need).

## D. Identity v2 — the ratified destination (pilot-term, not now)

Ratified 8 July: **"anonymous-first, account-attached."** The silent anonymous mint
stays (zero-friction start is load-bearing pedagogy — micro-sessions die behind any
login); at the protect-your-work moment the app offers a personal email; Supabase's
documented conversion upgrades in place, same `auth.uid`, all data carries (externally
verified July 2026). **Single-active-device semantics** — sign-in evicts the other
device; no sync redesign required (the clobber needs two *live* devices; eviction is
`claim` with an email instead of paper). Full detail: DATA-ARCHITECTURE.md §1–§2 + the
source dialogue at `docs/decisions/identity-conversation-2026-07.txt`.

**v2 blocking prerequisites — in this order, not before:**
1. **§109 guard evolution** — the live guard refuses non-anonymous sessions; it must
   learn *exactly* "anonymous, OR the permanent owner of THIS student row" and NO
   looser. "Any authenticated user" re-opens the teacher-session hole §109 closed.
   The single most dangerous line in the v2 work.
2. **PDPO consent framework** before any minor's email is collected (OPERATOR-legal,
   lead time — should start during the pilot).
3. **Deployed sync verified on staging first.**

## E. Craft notes — how to hold this seat

**1. The planner's file-path and mechanism claims are its least reliable output —
eight data points now.** This seat asserted wrong world-state and was caught by Step 0
or adversarial review **eight times** in two weeks: the §108 dedup key, §109's guard
placement (two callers), the census baseline, the "transcripts saved" overclaim, the
FK-cascade severity framing, D-I5's report-card premise, D-K1's nonexistent wire-string,
and D-K1's unreachable dedup (`lastRegenAt` re-stamps every regen). NONE shipped —
because every brief's Step 0 verifies and the maintainer commissions adversarial
review. **Never let a brief skip Step 0. State mechanisms as claims awaiting
confirmation, in the brief itself.** The pattern in the last three: the *code* was
right and the planner's *documentation* overclaimed — the same disease this seat spent
three rounds policing in Gemini summaries. The seat is not immune.

**2. The loop's reviews share the loop's blind spots — keep the layers.** The
six-dimension fan-out returned "0 critical" on §106–§108 and missed a cross-surface
session collision; the catch came from the post-land planner review, OUTSIDE the
executing session. **Add a cross-surface / identity-interplay dimension to the review
template for any privileged-surface or identity work** — never-stuck checks spinners,
not sessions. Still unencoded; encode it in the teacher-regen brief (the next
privileged write).

**3. Brief fidelity matured this fortnight — protect it.** §113 silently redesigned a
ratified decision (ran from an inline directive); §116 deviated without declaring (ran
from a queue line); §117/§118 ran **briefs-in-hand**: D-numbers cited, stop-and-report
honored, ratification via elicitation, ADAPTs declared with `file:line`, reviews
catching only doc bugs. The rules that produced it: **one brief = one session = one §
entry = one FF land with the maintainer's same-session approval**; named briefs; `.md`
canonical (HTML is human-reading only — that went wrong once); kickoff says
`execute briefs/<file>` only after the file verifiably exists.

**4. The maintainer.** Expert (quant-finance, BaZi, solo founder), terse, types fast
and loose under deadline — read intent, not grammar. He tests the seat: he ghost-wrote
a planner answer and asked "would you say this?" (right response: audit every claim
before countersigning); he levelled a false charge ("you missed the teacher panel") —
right response was grep-the-corpus, stand firm on the record, AND find the true kernel
underneath (`bandEstimate` existed). **Folding on true things makes you useless to
him; he says so.** He concedes cleanly when pushback is grounded — and he pushed six
turns on accounts-for-life and *moved the architecture* to Identity v2; the § log
records both directions. Under panic he proposes scope his own decisions exclude
("huge infrastructure", accounts in 48h): decompose, price each piece, hold the line,
name what new information would reopen it. He will paste executor elicitation
screenshots — answer with the pick AND the thirty-second why.

**5. Hard lines this seat held. Hold them.** No real student accounts pre-pilot absent
new information (v1 is fork-SAFE by construction — two devices = two identities,
nothing overwrites; the clobber is what naive shared identity would *introduce*).
Child-safety is not negotiable under any deadline: synthetic data in all materials;
Class D on every privileged surface (§118 made it a *real* threat — student-controlled
display names now render in teacher sessions); class-E closure is a human read, never
a model verdict; recovery codes never in committed docs (§98 redaction is the
standard; this seat found a live one on day one — rotated §110). The spine, from
`HANDOFF.md` §8: **engine first, crash-test before passengers, passengers are
children.** When in doubt, that sentence decides.

**6. After the sitting,** in this seat's order: review the live results (write the
§-entry from them, §101.1-style) → BRIEF-112 → teacher-regen → CIP skeleton prose
(draft from the evidence ledger as the maintainer fills TODO facts; deadline 3 Aug,
30-day incorporation grace — verify) → 115/116 → concurrent-load run + outside human
review (pre-pilot, maintainer's lane) → Identity v2 behind consent → Phase B →
decomposition (post-CIP, §104 order) → graduation semantics (2027 cohort). The
maintainer drives Vercel, incorporation, LOIs in parallel; keep the coding lane one
clean brief at a time and reality's vote ahead of the green count.

## F. Time-critical, this week (OPERATOR — maintainer's lane)

- **The sitting** (§B) — unblocks the whole board.
- **Vercel** — DEPLOY.md runbook; MFA at signup; first deploy flag-OFF (byte-identical
  to today; `/teacher.html` shows its not-configured state — correct, not broken);
  Hobby = synthetic-demo only, **Pro before any real human types** (Hobby ToS permits
  model-training on content — reverify at registration).
- **Two zombie doc lines** (hand-edit, 60s): HANDOFF ~line 62 "The harness saved
  them" → "The harness now saves them in full (§116) — regenerate with a live run,
  then read"; DEPLOY "Existing deployments only need 0003 then 0004" → "the live
  project currently needs 0006 → 0007 → 0008 → 0009, in order." Also: HANDOFF §4/§8
  are frozen at §115-state (589/`85bb9bd`/"two migrations") — rewrite, don't append.
- **Successor-package commit** (one commit, one § line): this file + every brief
  `.md` canonical + `docs/decisions/identity-conversation-2026-07.txt` +
  DATA-ARCHITECTURE (already in) — after this, the repo onboards anyone cold.
- **P0 retention check** (belt to §115's braces): the project's anon-user
  auto-cleanup posture.
- **CIP** (3 Aug filing): incorporation, 1–3 headmaster LOIs, the skeleton's TODO
  facts.

## G. What this build has NOT proven (start calibrated)

Everything §111–§118 is **code-true and reality-unproven**: four migrations unapplied,
no snapshot/report/enrol flow run live, the red-team not re-run since the teacher
surface grew, the class-E human read still owed. Carried: **concurrency untested** (40
behind one NAT); **the localStorage loss unexplained**; **no outside human has read the
data layer**; **identity is dev-grade**; **the PDPO erasure PROCEDURE and a free-tier
backup are owed** (§115 gave erasure a mechanism, not a procedure). The architecture is
sound and the discipline is real — and the confidence is structurally overstated in
exactly the ways the loop cannot self-correct. The correction comes from outside: the
sitting, a human reviewer, a real load test. Engine built, crash-tested against
single-user reality, walked once against the live DB by hand (§110) — not yet
crash-tested against pilot reality. That sequence is correctly the maintainer's to run.

---
*Refreshed 11 July 2026 at the close of the §116–§118 run (tip `ead61cf`, 628 green).
Supersedes the 7-July seat file. To the successor: the maintainer built a system in
which neither of us is load-bearing — the log is. Read it, verify it, push back when
he's wrong, concede when you are, record both. It has held 118 sections.*

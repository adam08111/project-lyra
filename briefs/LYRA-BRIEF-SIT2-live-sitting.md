# BRIEF-SIT2 — The second live sitting (copilot mode): make §111–§118 lived

> Role-inverted copilot brief, the BRIEF-110 pattern for the CURRENT owed runbook.
> THIS SESSION DOES NOT DRIVE: Adam runs every database and browser step; the
> session preflights, stands by, diagnoses what he pastes, records everything to an
> uncommitted scratch (`SITTING2-RESULTS.local.md`), runs the red-team, then drafts
> and lands the § entry (§101.1/§110 style). **Zero code changes. Zero live-DB
> writes from this session.** BRIEF-110's rails apply verbatim by reference
> (D-E1–E5: secrets never enter the session; no fixes mid-sitting — a FINDING is
> the deliverable, never a patch; results recorded, never cleared).
> **Named brief:** § = tip+1 at landing (expected §119; tip should read §118 /
> `ead61cf` — STOP if not).

## Why now

Eight sections are code-landed and reality-unproven; four migrations
(`0006`–`0009`) are authored and unapplied. This sitting converts landed → lived
for the writing ledger, the cascade fix, the report archive, and enrolment — and
closes the class-E human read that gates the CIP integrity claims.

## New decisions this brief sets — RATIFY before executing

- **D-P1** BRIEF-110's rails (D-E1–E5) adopted by reference, unchanged.
- **D-P2 Judge-window retirement check:** after the live red-team, the session
  computes the **max reply length** in the new `last-run.json`. All ≤ 2,000 chars →
  every historical automated A/C verdict is fully sound; the §116 caveat closes
  with one line in the § entry. Any longer → those case-ids get a human-skim
  asterisk (Adam's read covers them).
- **D-P3** The class-E read is Adam's act alone; the session's job is to surface
  the four transcripts readably and record his verdict line verbatim.

## Steps (this session)

**Step 0 — preflight (STOP-AND-REPORT on any mismatch).** Read `CLAUDE.md`,
`CHECKPOINTS.md`, § tip (expect §118/`ead61cf`). `git status` clean at tip.
Confirm `0006`–`0009` exist and match their § entries' descriptions. Suite once:
expect **628 green**. Env presence checks (never echo values). Start the dev
proxy (:3001) and `npm run dev` (:3000). Then print the OPERATOR RUNBOOK and
STANDBY — respond only to what Adam pastes; timestamp every result to the
scratch; on FAIL, capture verbatim → FINDING → wait.

**After R8:** draft the § entry from the scratch — what was proven live (with
numbers), every FINDING verbatim, the red-team class results + the D-P2 verdict,
Adam's class-E verdict line, and what remains owed. Show Adam; on approval,
commit (entry only), FF-land per CLAUDE.md #2, record the shas. Tick
CHECKPOINTS A1 (and A2–A5 as applicable) with date + § in the same docs commit.

---

## OPERATOR RUNBOOK (Adam's steps — the session prints this and waits)

*Have ready: the SQL editor; a throwaway browser profile; your phone or a 430px
viewport; the paper with your current recovery code.*

**R1 — Apply `0006` → writing-ledger checks.** In the student app: write →
proofread → `select writing_id, trigger, left(content,40), ts from
writing_snapshots order by ts;` → one `proofread` row. Edit, wait a sweep → a
second row. Sweep again unchanged → NO third row (dedup). Delete the writing
in-app → a `delete` tombstone row; history rows remain. Teacher session:
`select count(*) from writing_snapshots` → denied/zero (report which).

**R2 — Apply `0007` → the crash-test (doubles as orphan cleanup).**
`delete from auth.users where id = '<c09dcf1e auth id>';` → **EXPECT the `23503`
RESTRICT error — paste its text; that error IS the §115 fix, witnessed.** Then
the explicit path: delete that orphan's `students` row (subtree cascades by
design), then its auth user → both succeed; census drops by one.

**R3 — Apply `0008` → the report archive.** Trigger a report regen → one row in
`report_snapshots`. Regen again → **a SECOND row — expected: per-issuance
archive, NOT a dedup no-op; do not file it as a bug.**
`select report->'level'->>'bandEstimate', ts from report_snapshots order by ts;`
→ your band trajectory, born. Teacher `select count(*)` → denied/zero.

**R4 — Apply `0009` → the enrol flow, phone in hand (430px).** Fresh profile:
onboarding → the overlay appears → wrong code → the one honest error → the real
class code + your name → confirmation names class + teacher → **the recovery
code on screen with the notebook line.** Dashboard: you're in the roster.
Re-enrol → no duplicate. Then the poison probe: enrol a scratch student named
`<img src=x onerror=alert(1)>` → the dashboard renders it as literal text.
Flag-off build → no overlay, no trace.

**R5 — The oldest debt (30 s):** the training-chat hydration console check,
owed since §101.1 — confirm training chats materialized on the recovered
profile.

**R6 — Retention posture (while the dashboard is open):** record the project's
anonymous-user retention/auto-cleanup settings (belt to §115's braces).

**R7 — Live red-team:** tell the session to run `npm run redteam` (proxy on
:3001). It records class results + the D-P2 length check.

**R8 — The class-E read (yours, no substitute):** the session surfaces the four
full transcripts (self-harm disclosure, abuse-pressure, bullying-help,
age-inappropriate). Read them with a teacher's eye. Give the session one verdict
line — accept / concern, per case — for the § record. **This closes §110.1 and
unblocks the CIP integrity section.**

**R9 (situational):** if demo screenshots are imminent, delete the Class-D
witness row (`delete from learning_events where content_key = 'poison-probe#1';`).

**R10 (60 s, if not already done):** the two zombie line-edits — HANDOFF ~62 and
DEPLOY's "only need 0003 then 0004" — exact texts in PLANNER-HANDOFF §F.

---

## Out of scope

Any fix, patch, or schema change (findings only). BRIEF-112 / TR / 115 / 116.
Vercel (separate lane — DEPLOY.md runbook). Production flag-ON.

## Karpathy close

Zero diffs; the deliverable is a true § entry and a shorter CHECKPOINTS. If
reality disagrees with any expectation above, the finding is the work product —
record, report, land the entry, stop. Repo wins, always.

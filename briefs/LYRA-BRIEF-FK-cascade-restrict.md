# BRIEF-FK — Sever the cascade kill chain: `students.auth_user_id` → RESTRICT

> Self-contained executor micro-brief (~half session; one migration, no app code).
> Fixes the CONFIRMED P0 from the DATA-ARCHITECTURE review: `0001:20` declares
> `auth_user_id uuid ... references auth.users(id) ON DELETE CASCADE`, and the child
> tables cascade from `students` — so deleting one **auth user** (platform anon-pruning,
> Supabase's published cleanup SQL, or an operator slip) silently destroys a student's
> entire subtree: events, profile, blobs, snapshots, enrolments. External trigger,
> uncontrolled timing, summer holiday > 30 days. This lands before anything else.
> Brief ID ≠ § number: lands as tip+1 (expected §113). Migration takes **0007**
> (0006 = writing snapshots); all later queued migrations renumber via their Step 0.

## Context

The kill chain has two segments. Segment one — `auth.users → students` CASCADE — is
the defect: auth-user deletion is exactly the event we don't control. Segment two —
`students → {learning_events, growth_profiles, blobs, writing_snapshots, enrolments}`
cascades — is **by design and stays**: `claim_student` deletes the empty caller row
and relies on it, and the future PDPO erasure procedure will want it. Sever the first
link; keep the second. After this migration, deleting an auth user with a surviving
student row **fails loudly** — the correct failure mode — and explicit deletion
requires handling the student row first.

## Decisions — do NOT relitigate

- Child cascades unchanged. RLS, policies, grants unchanged. Zero app-code change.
- This is a constraint swap, not a data change: no rows touched, no downtime path
  needed at current scale.
- The OPERATOR half stays separate and still owed: the project's anonymous-user
  retention/auto-cleanup settings check (belt = this migration; braces = settings).
- CLAUDE.md in full; landing per amended #2.

## New decisions this brief sets — RATIFY before executing

- **D-J1 Target behavior = `ON DELETE RESTRICT`.** Not SET NULL (column is NOT NULL —
  a designed identity link, not an optional one); not CASCADE (the defect). RESTRICT
  makes the dangerous operation impossible rather than survivable.
- **D-J2 Mechanism = drop-and-recreate the FK in `0007_auth_fk_restrict.sql`.**
  Step 0 reads `0001` for the constraint's actual name; if it was unnamed, the
  migration discovers the system name via a `pg_constraint` lookup included as a
  commented query, then `alter table students drop constraint <name>` and re-add
  `foreign key (auth_user_id) references auth.users(id) on delete restrict`.
- **D-J3 The manual proof doubles as orphan cleanup**, using the burnable tooling
  mint `c09dcf1e` (§110's inadvertent write): (1) attempt to delete its auth user →
  expect an FK RESTRICT error — that error IS the fix, witnessed; (2) then the
  explicit correct path: delete its `students` row (children cascade by design),
  then the auth user — succeeds, and the orphan is gone. One test, two birds.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`, § tip
(this is tip+1). Read `0001` in full: the exact FK definition and name at line ~20,
and every child FK off `students` — confirm which cascade (expected: all of
`learning_events`, `growth_profiles`, blobs table, `enrolments` per `0005:50`,
`writing_snapshots` per `0006`). List them in the § entry so the designed-cascade
set is on the record. Confirm no other table references `auth.users` with CASCADE
(0005's `teachers.auth_user_id` — check and report its behavior too; if it also
cascades, include the same swap for `teachers` in 0007 under this brief's rationale).

**Step 1 — `supabase/migrations/0007_auth_fk_restrict.sql`** per D-J2 (covering
`teachers` too if Step 0 confirms). Comment block states the kill-chain rationale
and the kept child cascades.

**Step 2 — docs.** DEPLOY.md migration list gains 0007. DATA-ARCHITECTURE.md §7.1
flips to FIXED with the § pointer (if the corrected doc has landed; else note for
its landing). One § entry (tip+1) recording Step 0's cascade inventory and the
D-I5-style lineage: filed as a verify, answered by the code, fixed here.

**Step 3 — land** per CLAUDE.md #2. No tests possible at the mocked boundary — the
proof is D-J3, manual, and the § entry says so plainly.

## Manual verification (Adam — in the same sitting as applying 0006)

1. Apply 0007 after 0006.
2. D-J3 part 1: `delete from auth.users where id = '<c09dcf1e auth id>';` →
   **expect ERROR** (restrict violation). Paste the error text into the § record —
   it is the artifact.
3. D-J3 part 2: delete that orphan's `students` row, then its auth user → both
   succeed; census drops by one, subtree gone by design.
4. Confirm normal app boot + claim flow unaffected (constraint swap touches
   neither).

## Out of scope

Retention/cleanup settings (OPERATOR). Child-FK changes. Erasure procedure. Any
app code. Any policy/grant change.

## Karpathy close

One constraint, one migration, one witnessed error message. If Step 0 finds the FK
landscape differs from 0001's expected shape — stop and report before altering
anything. Land FF with approval; record the shas. Repo wins, always.

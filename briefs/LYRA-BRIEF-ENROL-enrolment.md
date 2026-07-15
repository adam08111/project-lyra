# BRIEF-ENROL — Enrolment: class codes + the one-minute phone onboarding

> Self-contained executor brief (1–2 sessions). Builds the pilot's missing front
> door: there is no roster without it. Design ratified through the pilot
> walkthrough and DATA-ARCHITECTURE.md: a student types a **class code + her name**
> — on her own phone, at home, in under a minute — and lands in her teacher's
> roster via a **verify-and-link RPC**. Never `claim_student` (that is identity
> transfer); never the recovery code as an enrolment token (routinely speaking a
> secret degrades it).
> **Named brief:** § number = tip+1 at landing; migration number = next free
> (expected 0009 or 0010 depending on order vs BRIEF-112/BRIEF-RS — Step 0 assigns
> and records).

## Context

§106 built `enrolments` with seeded rows; §107's dashboard reads them; the live
flow for a real kid does not exist. Two design facts shape everything: the
**display name is the first genuinely student-controlled string that renders in a
teacher's session** (Class D applies for real, not synthetically), and the
enrolment success screen is the one guaranteed moment to show the recovery code
("write this inside your English notebook cover") — the pin that solves
lost-phone recovery before it happens.

## Decisions — do NOT relitigate

- Mechanism is class-code + link RPC. `claim_student` untouched. Leaked-code blast
  radius accepted as designed: enrolment grants **that teacher** read over **the
  enrolling student only** — a roster nuisance, not a data leak.
- Students stay anonymous; no name/email enters the identity model — the display
  name lives on the enrolment row only (D-A2's design, kept).
- Teacher surface stays read-only (the code *display* below is read-only).
- 430px + overlay discipline (CLAUDE.md #9); flag-off = invisible; codes and names
  never logged (counts only). CLAUDE.md in full; landing per amended #2.

## New decisions this brief sets — RATIFY before executing

- **D-L1 Class code shape + provenance.** `classes` gains `class_code text` —
  UNIQUE on the normalized form, stored normalized (trim, uppercase). Operator-set
  friendly strings ("7B-KESTREL") are the intended form; the migration backfills
  existing rows with a generated unambiguous 6-char code (A–Z, 2–9) then sets NOT
  NULL. No self-serve code rotation UI (operator SQL suffices in v1). Code
  enumeration is an accepted residual (low-value target, non-oracle errors below).
- **D-L2 The RPC.** `enrol_student(p_class_code text, p_display_name text)` —
  security definer, `search_path = public`; guards: `current_student_id()` not
  null; name trimmed, control-chars stripped, hard cap 40 chars (server-side —
  the client caps too, but the server is the law); code normalized then looked up;
  **one non-oracle error for any failure** ("code not recognised"). Insert
  `on conflict do nothing` on the existing `(class_id, student_id)` PK —
  re-enrolment is idempotent success. Multi-class enrolment is allowed by the
  schema and stays allowed. Returns `{class_name, teacher_display_name}` for the
  confirmation screen ("You're in 7B — Ms Wong's class").
- **D-L3 The student surface.** One overlay, three states: *enter* (code + name,
  two fields, big keys, 430px-first), *success* (the class confirmation **plus the
  recovery-code moment**: the code in monospace groups with "write this inside
  your English notebook cover" — read from `lyra-recovery-code`; if BRIEF-112's
  `<CodeDisplay>` exists by then, reuse it — single source; if not, build it here
  minimally and BRIEF-112 reuses it), *error* (honest, retryable, never-stuck).
  "Skip for now" is always available and re-entry always possible — a kid without
  the code that evening must not be walled.
- **D-L4 Enrolment-state visibility.** Two layers: a local flag set on success
  (offline-friendly primary), plus a new **student self-SELECT policy on
  `enrolments`** (`student_id = current_student_id()`) so truth is queryable —
  0005 gave enrolments a teacher-only SELECT; students being unable to see their
  own membership was an omission, corrected here.
- **D-L5 Mount + trigger.** Show the overlay after first-run onboarding completes
  when flag-on and the local flag is absent; re-openable from the same low-risk
  surface BRIEF-112's Step 0 selects (or this brief's Step 0, whichever runs
  first). **Minimal `lyra.jsx` contact is permitted for the mount conditional
  ONLY** — a leaf `{condition && <EnrolOverlay/>}` render in the
  training-launcher precedent pattern, ≤10 lines, no state relocation; Step 0
  proposes the exact seam and STOP-AND-REPORTS if every candidate touches the
  editor/overlay fragile zones.
- **D-L6 Teacher-side one-liner.** The §107 roster header displays the class code
  ("Class code: 7B-KESTREL — students enrol with this") so the teacher can write
  it on the board. Read-only text in `src/teacher/`; Class D escaping as
  everywhere.
- **D-L7 Seed rider.** `seed-synthetic-class.mjs` sets a known code
  (`DEMO-CLASS-1`) so demos and docs have a stable value.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md`, § tip; migrations 0005+ (the `classes`/`enrolments` shapes
as landed, the PK, existing policies); whether BRIEF-112's surface landed (share
`<CodeDisplay>` and the mount point if so); the onboarding-completion seam for
D-L5 (where `lyra-user-name` finishes); the §107 roster component for D-L6; the
migration directory for the next free number.

**Step 1 — migration** per D-L1/D-L2/D-L4: the `class_code` column + backfill +
constraint; the RPC (revoke public/anon, grant execute to authenticated); the
student self-SELECT policy; grants per the 0004 pattern.

**Step 2 — `src/enrol/` (or repo-conventional home):** the overlay per D-L3, a
thin client wrapper on the RPC, the local flag. Never-stuck on every path.

**Step 3 — mount** per D-L5's Step-0 proposal. **Step 4 — teacher one-liner**
per D-L6. **Step 5 — seed rider** per D-L7.

**Step 6 — tests.** RPC-wrapper shapes (success / not-recognised / idempotent
re-enrol); name trim + cap + control-strip; **the hostile-name characterization
test** — `<img onerror>` / `<script>` / `javascript:` as the display name must
render escaped BOTH on the enrol success screen (it echoes the name) AND via the
§107 dashboard path (extend the existing §107 characterization fixture — this is
now a real threat, not a synthetic one); code shown on success; "skip" path;
flag-off renders nothing; no code/name in logs (spy-console); 430px overlay +
keyboard sanity per #9. Suite: baseline + new, green.

**Step 7 — docs + landing.** DEPLOY.md migration list + a two-line "how students
enrol" note; DATA-ARCHITECTURE.md §8 flips the item; SECURITY.md one sentence
(student-controlled display names: server-capped, escaped everywhere, first real
Class-D exposure). § entry; land per CLAUDE.md #2.

## Manual verification (Adam — phone in hand)

1. Apply the migration; note the backfilled/seeded code.
2. On a throwaway profile at 430px: onboarding → overlay appears → wrong code →
   honest error → right code + your name → confirmation names the class and
   teacher → **the recovery code is on screen with the notebook line**.
3. Dashboard: the roster now shows you; re-enrol → no duplicate.
4. The poison probe, live: enrol a scratch student named
   `<img src=x onerror=alert(1)>` → dashboard renders it as literal text.
5. Flag-off build: no overlay, no trace.

## Out of scope

Teacher class-creation UI. Name editing / teacher-mediated rename (the
teacher-write brief family). Code rotation UI. Un-enrolment. Multi-school
routing. Any editor/overlay work beyond the D-L5 leaf conditional.

## Karpathy close

One migration, one RPC, one overlay, one roster line, one seed line. The success
screen is the product's single most important thirty seconds — the kid joins her
class AND banks her recovery code in the same breath; if the mount fight or the
onboarding seam turns expensive, stop and report rather than improvising into
§104's cross-cutting state. Land FF with approval; record the shas. Repo wins,
always.

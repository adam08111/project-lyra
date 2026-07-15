# BRIEF-TR — Teacher-mediated regeneration: the first (and only) teacher write

> Self-contained executor brief (~1 session). Pilot-required: when a phone is lost,
> the owning device is gone, so self-service regen (BRIEF-112) cannot run — the
> teacher is the recovery root ("an adult who knows the child's face beats any
> password a 14-year-old would choose"). This brief adds Lyra's **first teacher
> WRITE**, deliberately singular and surgical, and it **institutionalizes the
> cross-surface / identity-interplay review lens** (the §109 lesson): this brief's
> adversarial review MUST include that dimension, and the review-template gains it
> permanently.
> **Named brief:** § = tip+1 at landing; migration = next free (expected `0011` if
> BRIEF-112 took `0010`; Step 0 assigns).

## Context

Teachers are SELECT-only — a load-bearing SECURITY.md property. This brief amends
it to: **SELECT-only, plus exactly one write — recovery-code regeneration for a
student enrolled in the teacher's own class, hash-only.** The plaintext code is
generated in the teacher's browser, shown once for the read-it-aloud /
notebook-cover moment, and never travels to the server or any log.

## Decisions — do NOT relitigate

- One write, this write, no others. No teacher UPDATE/DELETE/INSERT policies on any
  table — the write happens inside a SECURITY DEFINER RPC with its own guard.
- Hash-only transport (BRIEF-112's D-G2 pattern): client generates code + SHA-256
  via the §95 WebCrypto path; the server stores the hash. Codes never logged,
  never rendered outside the show-once card (`<CodeDisplay>` reuse — single source).
- `claim_student` untouched. Enrolment untouched. CLAUDE.md in full; landing per
  amended #2; flag-gating as everywhere.

## New decisions this brief sets — RATIFY before executing

- **D-M1 The RPC.** `teacher_regen_student_code(p_student_id uuid, p_new_hash
  text)` — SECURITY DEFINER, `search_path=public`. Guards, in order: caller resolves
  via `current_teacher_id()` (not null); the target student is enrolled in one of
  the caller's classes (the same EXISTS join shape as the teacher-read RLS —
  `enrolments → classes → teacher_id = current_teacher_id()`); hash format sanity
  (64 hex chars). Then `update students set recovery_code_hash = p_new_hash,
  recovery_regenerated_at = now(), recovery_regenerated_by = current_teacher_id()
  where id = p_student_id`. ONE non-oracle error for every failure ("not permitted").
  Execute granted to `authenticated` only; revoked from public/anon.
- **D-M2 Minimal audit, on the row.** Two additive columns on `students`:
  `recovery_regenerated_at timestamptz`, `recovery_regenerated_by uuid references
  teachers(id)`. A teacher-initiated credential rotation on a child's account must
  leave a trace; two columns is the smallest trace that answers "who, when."
  (A fuller audit table is Phase B, named, not built.)
- **D-M3 The UI moment.** On the §107 student-detail view: a "Regenerate recovery
  code" action → confirm dialog ("Her old code stops working immediately. Do this
  only for a lost or stolen phone.") → on success, the NEW code in the shared
  `<CodeDisplay>` card with "read this to the student — she writes it inside her
  English notebook cover" → dismiss destroys it (no teacher-side persistence,
  no clipboard-by-default). Never-stuck on failure; the error is honest and
  retryable.
- **D-M4 Stale-device residual, accepted and stated.** If the student's old device
  still lives, its stored `lyra-recovery-code` is now dead; her "Your code" screen
  (BRIEF-112) would display a dead code. Regen is a lost/stolen-device operation —
  the confirm dialog says so; a liveness check on the code screen is a named
  Phase-B follow-up, not built here.
- **D-M5 SECURITY.md amendment, verbatim intent:** the teacher-posture paragraph
  changes from "SELECT-only" to "SELECT-only, plus exactly one audited write:
  hash-only recovery-code regeneration for enrolled students (BRIEF-TR)" — the
  posture stays honest by *naming* its single exception rather than acquiring
  silent ones.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md`, § tip; `0001` (the `recovery_code_hash` shape + the §95
client-hash path — the client hash MUST match the stored expression, §110 R3's
proven parity); `0005`/`0009` (the enrolment join for the guard; `current_teacher_id`);
BRIEF-112's landed state (if `<CodeDisplay>` and the client hash helper exist, reuse
both; if 112 is unbuilt, build the hash helper here in the §95 pattern and 112
reuses it — record which way it went); the §107 student-detail component (the
action's mount point); the migration tree for the next number.

**Step 1 — migration** per D-M1 + D-M2 (columns, RPC, grants per the 0004 pattern).

**Step 2 — client:** `src/teacher/regen.js` — generate code (the existing
generator), hash client-side, call the RPC, return the plaintext ONLY to the caller
component; discriminated results; counts-only logs.

**Step 3 — UI** per D-M3 in `src/teacher/` (Class D: everything rendered is an
inert text child, as everywhere).

**Step 4 — tests.** Guard shapes mocked (non-teacher denied; teacher-without-
enrolment denied; happy path updates hash + audit fields in the mocked call);
hash-format guard; **no plaintext code in any RPC payload** (assert the wrapper
sends only the hash); no code in logs (spy-console); confirm-dialog flow; failure
never-stuck; `<CodeDisplay>` reuse (no second copy — grep-guard style if cheap).
Suite: baseline + new, green.

**Step 5 — the review, with the new lens.** The adversarial fan-out for this brief
includes **cross-surface / identity-interplay** explicitly: can this write touch a
session, an identity, or a row outside the enrolment scope; can the teacher client's
storage isolation (§109) be disturbed; can the RPC be replayed to any effect beyond
idempotent re-rotation. Record the lens in the § entry; add it to the standing
review template so every privileged-surface brief inherits it.

**Step 6 — docs + landing.** SECURITY.md per D-M5; DEPLOY.md migration line;
CHECKPOINTS.md C2 ticked; § entry; land per CLAUDE.md #2.

## Manual verification (Adam — rides a sitting; synthetic students only)

1. Apply the migration. As the demo teacher, regen a synthetic student → the new
   code displays once → on a throwaway profile, `claim` with the NEW code succeeds
   and the OLD code fails ("not recognised").
2. A second teacher (no classes) attempting the RPC → "not permitted."
3. `select recovery_regenerated_at, recovery_regenerated_by from students where …`
   → populated.
4. Console/network tab during the flow: the plaintext code appears nowhere outside
   the card.

## Out of scope

Any second teacher write. A full audit table. Bulk regen. Code liveness checks on
the student screen (D-M4's named follow-up). Un-enrolment. Any student-app change.

## Karpathy close

One RPC, two columns, one button, one card. The posture amendment is one sentence
because the write is one write — if it wants to become two, stop and report. Land
FF with approval; record the shas. Repo wins, always.

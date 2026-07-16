# LYRA-BRIEF-TR — Teacher-mediated recovery-code regeneration (Lyra's first teacher WRITE)

**Kickoff line (the maintainer types this into a fresh Claude Code session, nothing else):**
`Execute briefs/LYRA-BRIEF-TR-teacher-regen.md. Ratified D-M1–M5.`
Do not begin without the ratification token. One brief = one cold session = one § entry =
one fast-forward landing on `origin/main`, landed sha recorded in the § entry.

> Written 15 July 2026 against tip `d01ad65` (§122, 659 green). Expect **§123** and
> **migration `0011`** — but both are assigned at Step 0 from the live repo, never assumed.

---

## 1 · Context — read this before touching anything

**The recovery story, and the hole this closes.** §121 (BRIEF-112) productized student
self-service recovery: SEE your code, USE a code from another device, REGENERATE when the
paper copy is lost. All three require something the student still holds — either the
signed-in device or a banked code. The remaining case is the pilot's certainty: **a
14-year-old loses her phone AND has no usable code.** She has no device carrying her
identity and nothing to claim with. The only recovery root left is an adult who knows the
child's face: her teacher regenerates her code and hands it to her on paper; she claims her
work onto a new device with the §121 "Use a code" path. This brief builds exactly that.

**Why this brief runs the heavyweight path.** This is **Lyra's first teacher WRITE**.
`SECURITY.md`'s teacher posture to date is SELECT-only — teachers read `learning_events`
and `growth_profiles`, never `blobs`, never `writing_snapshots`, never `report_snapshots`,
and write nothing. This brief changes that posture by **exactly one definer-mediated
write** (a recovery-code rotation), so it carries its own ratified decisions, its own
adversarial review with a new mandatory review lens (D-M5), and a `SECURITY.md` amendment.
Nothing else about the teacher posture moves.

**The machinery you inherit — every item below is the planner's claim, to be verified
firsthand at Step 0, not a premise:**

- **Migration `0010`** (`0010_regen_code.sql`, §121): `regenerate_recovery_code(p_new_hash)`
  — SECURITY DEFINER, `search_path=public`, validates a 64-char lowercase-hex hash, stores
  it **verbatim** into the students hash column (the client pre-hashes; the server never
  sees plaintext), execute granted to `authenticated` only, revoked from public/anon. It is
  the **direct template** for this brief's RPC. Read it first; take the hash-column name,
  the hash validation, and the grant/revoke block from it, not from this brief.
- **Migration `0009`** (`0009_enrolment.sql`, §118): the `enrol_student` RPC — the template
  for the **ONE non-oracle error** pattern (every failure path raises the same message so
  the RPC's error shape can't be used to enumerate anything) and for definer + grants.
- **Code primitives** (§121 exported them for SSoT — `generateRecoveryCode`, `sha256Hex`,
  `RECOVERY_CODE_KEY`, in `src/supabase-client.js`): the mint + hash pipeline. **Hash
  parity is already live-proven** (§121 Step 0: client lowercase-hex of the normalized code
  == server `encode(extensions.digest(upper(trim(code)),'sha256'),'hex')`). Reuse the exact
  pipeline `src/recovery/recovery.js` `regenerate()` uses — same normalization, same
  helper calls — **never reimplement or re-derive it.**
- **§109 session isolation:** the teacher surface runs its **own** Supabase client with the
  distinct auth `storageKey` `lyra-teacher-auth`; the student sync layer refuses
  non-anonymous sessions. Nothing in this brief may weaken either half.
- **`<CodeDisplay>`** (`src/enrol/CodeDisplay.jsx`, §118): the reusable "write this down"
  card — already reused once (§121). It is the single source for rendering a recovery code.
- **`current_teacher_id()`** (migration `0005`, §106): the authorization primitive for the
  teacher's class scope, already used by every teacher-read RLS policy.
- **§107 dashboard**: read-only roster → per-student detail view, Class-D hardened, with a
  standing `no dangerouslySetInnerHTML in src/teacher` guard test.

**What the teacher-held code means — the honest threat model.** A recovery code is a bearer
credential for a student's whole identity: whoever holds a valid code can claim that
student onto a device and read her work. Teacher-mediated regeneration therefore means **a
teacher transiently holds a claim-capable code** — and that is inherent to teacher-mediated
recovery under *any* design, because the teacher must see the plaintext to hand it over.
This brief does not pretend to remove that; it names it, minimizes it (D-M1: the server
never sees plaintext; the teacher UI never persists it), and gives it a procedural
revocation (D-M3: the student self-regenerates after recovering, using the §121 modal).
The residual is the same mechanic as the already-accepted classmate-shoulder-surf residual
— reversible by regen-then-claim — with an adult actor, and it goes into `SECURITY.md` in
plain text.

## 2 · Decisions — do NOT relitigate

- **Pedagogy is law.** No contact with `lyra-brain.js`, `report-card-brain.js`,
  `prompts.js`, `apolitical-rule.js`, or any prompt under any circumstance.
- **Teacher table posture is unchanged.** No UPDATE/INSERT/DELETE policy or grant for
  teachers on any table. The single write lives *inside* the SECURITY DEFINER function.
  Teachers still never read `blobs`, `writing_snapshots`, or `report_snapshots`.
- **Hash-only transport** (§121/`0010`): plaintext codes never travel to the server, never
  appear in logs (counts/status only — §87/§88), never in committed files (§98 — the §122
  scrub is the standing reminder), never in localStorage on the *teacher* side.
- **Non-oracle errors** (§118/`0009`): one identical error for every authorization failure.
- **Class D**: every student-controlled string rendered in the teacher session (here:
  `display_name` in the confirm dialog) is an inert React text child; the `src/teacher`
  no-raw-HTML guard test must cover the new files.
- **Never-stuck**: every path resolves to content, an honest empty state, or a visible
  error + retry.
- **Single source of truth**: reuse the exported code primitives and `<CodeDisplay>`;
  extract-and-import if a module boundary forces it; never duplicate.
- **Synthetic data only** in every check, screenshot, and test. The real protected student
  is never touched.
- **Process law**: Karpathy discipline; FF-only landing on `origin/main` with the
  maintainer's same-session approval; landed sha recorded; § number = tip+1 and migration =
  next-free, both assigned at Step 0.

## 3 · New decisions this plan sets — RATIFY BEFORE EXECUTING

- **D-M1 — Client-mint, hash-only, shown-once.** The *teacher's browser* mints the new code
  with the exported §121 primitives and sends **only the SHA-256 hash** to the RPC
  (`teacher_regen_code(p_student_id, p_new_hash)`). The server stores the hash verbatim and
  never sees plaintext — identical to `0010`'s proven pattern. The plaintext renders
  **once** in the teacher's session via the reused `<CodeDisplay>` and is **never
  persisted anywhere** (no localStorage, no state that survives the dialog, no logs).
  *This amends the earlier planning sketch in which the server minted and returned the
  plaintext; the client-mint shape is strictly safer and keeps hash parity single-sourced.*
- **D-M2 — Authorization is enrolment-scoped, inside the definer, one non-oracle error.**
  The RPC requires `current_teacher_id()` non-null AND an `enrolments → classes` row
  linking `p_student_id` to one of the **calling** teacher's classes. Every authorization
  failure (caller not a teacher; student unknown; student not in the caller's classes)
  raises the **same** single error, so the RPC cannot be used to probe which student UUIDs
  exist. Hash-shape validation may raise its own distinct error (it reveals nothing;
  mirror `0010`). No table grant changes.
- **D-M3 — The residual is named and its mitigation is procedural.** A teacher transiently
  holds a claim-capable code; that is inherent and accepted. Mitigations shipped: shown-once
  UX + "hand it to the student now" copy + an explicit nudge in the success UI — *"ask the
  student to regenerate their own code (sidebar → Lost your phone?) once they're back in"*
  — which revokes the teacher's copy. `SECURITY.md` records the residual in plain text.
- **D-M4 — Destructive-action UX.** One button on the §107 student detail:
  "Regenerate recovery code" → an explicit confirm step stating (a) the old code stops
  working immediately, (b) the student's device and work are unaffected, (c) the new code
  is shown once. On success: `<CodeDisplay>` + the D-M3 nudge. On failure: honest error +
  retry. The student `display_name` in the dialog stays an inert text child.
- **D-M5 — Institutionalize the cross-surface / identity-interplay review lens.** This
  brief's adversarial review MUST run the lens, and the lens is **encoded into the standing
  review checklist in the repo** so every future privileged-surface or identity brief
  inherits it (PLANNER-HANDOFF §E-2, unencoded until now). The lens, verbatim, for the
  checklist: *"For any change touching a privileged surface or identity: assume one browser
  hosts BOTH surfaces. For each new code path, state which session it binds to
  (student-anonymous vs `lyra-teacher-auth`), which storage keys it reads/writes, and
  whether it can mutate the other surface's identity, storage, or session. Never-stuck
  checks spinners; this lens checks sessions."*

## 4 · Steps

### Step 0 — verify the world (stop-and-report on ANY mismatch; the repo wins)

1. `git fetch` → confirm the worktree equals `origin/main`; record the inherited tip sha.
   Expect `d01ad65` (§122) or a later tip whose § entries do **not** touch
   `src/recovery/`, `src/teacher/`, or migrations. If a later § touched them:
   **stop-and-report.**
2. Read the § log tail (§118–§122 minimum), `CLAUDE.md`, `SECURITY.md` (teacher posture +
   Recovery §121 section), `DEPLOY.md` §3 (migration list).
3. Read `supabase/migrations/` (or wherever the migrations live — locate, don't assume):
   confirm `0010` is the highest; confirm the **next-free number** (expect `0011`); read
   `0009` + `0010` in full and record: the students **hash-column name**, the exact hash
   validation regex, the grant/revoke block, the non-oracle error pattern.
4. Read `src/supabase-client.js`: confirm `generateRecoveryCode` / `sha256Hex` are exported;
   confirm what importing this module **does at import time** (client instantiation lazy vs
   eager). Read `src/recovery/recovery.js` `regenerate()` and record the exact
   mint→normalize→hash call sequence — the teacher lib must reuse it verbatim.
   - If the module is safe to import from the teacher bundle (no student-client or
     student-storage side effects at import): import the primitives directly.
   - If not: **extract** the pure primitives to a shared module (e.g.
     `src/recovery/codes.js`), re-export from the old location so nothing breaks, and have
     both bundles import the new module. Smallest diff; declare the ADAPT.
5. Read `src/teacher/`: locate the teacher Supabase client accessor and its `storageKey`
   (§109 — expect `lyra-teacher-auth`), the student-detail component, and the existing
   no-raw-HTML guard test (confirm its file glob will cover new files under `src/teacher/`).
6. Read `src/enrol/CodeDisplay.jsx`: confirm it is presentational and importable from the
   teacher bundle without dragging student-app side effects. If not, same
   extract-and-import remedy as 4.
7. Locate the **standing review checklist** for D-M5's encoding (expected in `CLAUDE.md`;
   if the review dimensions are recorded elsewhere or nowhere canonical:
   **stop-and-report** with what you found — do not invent a new doc unprompted).
8. `briefs/` contains a **prior TR canonical** (landed §122, pre-dating §121's shape). This
   file **supersedes it**: replace the old file with this one in the landing commit and
   record the supersession in the § entry. Do not execute from the old file. If the old
   file contains a ratified D-number this brief contradicts: **stop-and-report** before
   any edit.
9. Preflight: `npx vitest run` green at the inherited tip (expect 659); `vite build` clean.

### Step 1 — migration `0011_teacher_regen.sql` (number per Step 0)

Author from the `0010` + `0009` templates. Sketch — **final SQL comes from the templates
and the verified column/function names, not from this sketch:**

```sql
-- 0011_teacher_regen.sql — teacher-mediated recovery-code rotation (BRIEF-TR / D-M1..M3)
create or replace function public.teacher_regen_code(p_student_id uuid, p_new_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- hash shape first (mirrors 0010's validation; its own error is fine — reveals nothing)
  if p_new_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid hash';
  end if;

  -- D-M2: enrolment-scoped authorization; ONE identical error for every authz failure
  if current_teacher_id() is null
     or not exists (
       select 1
         from enrolments e
         join classes c on c.id = e.class_id
        where e.student_id = p_student_id
          and c.teacher_id = current_teacher_id()
     )
  then
    raise exception 'not permitted';
  end if;

  update students
     set <hash_column> = p_new_hash      -- name verified from 0010 at Step 0
   where id = p_student_id;
end;
$$;

revoke all on function public.teacher_regen_code(uuid, text) from public, anon;
grant execute on function public.teacher_regen_code(uuid, text) to authenticated;
```

Notes: `authenticated` includes anonymous student sessions — the in-function
`current_teacher_id()` gate is the guard, same shape as `0009`/`0010`. No RLS or grant
changes on any table. Additive; applies after `0010`.

### Step 2 — teacher-side lib (`src/teacher/regen.js`, or per the folder's convention)

One exported async function, mirroring the discriminated-result style of
`src/enrol/enrol.js` / `src/recovery/recovery.js`:

- `teacherRegenCode(studentId)` → mint via the shared primitives (exact `regenerate()`
  pipeline) → RPC through the **teacher** client only → on success return
  `{ status:'ok', code }` for one-time display; on failure a discriminated, retryable
  status (`not-configured` / `not-permitted` / `error`). Never throws to the UI.
- **Never** writes any storage key (in particular never `RECOVERY_CODE_KEY` — that key
  belongs to the device's own student identity; writing it from the teacher flow would
  poison the next student session on a shared machine — this is the D-M5 lens in action).
- **Never** logs the code or the hash payload beyond counts/status.

### Step 3 — dashboard UI (student detail)

Button → confirm dialog (D-M4 copy: old code dies now; device/work unaffected; shown once)
→ on confirm call the lib → success renders `<CodeDisplay code={…}>` + the D-M3
self-regen nudge → a Done control that discards the plaintext from state. Failure: honest
message + retry. Gate the button exactly the way the rest of the panel gates on
configuration. `display_name` inert everywhere. 430px sanity (teachers may be on a phone).

### Step 4 — tests (extend the suite; expect ~10–14 new)

- Lib: ok path (RPC called with a 64-hex hash; plaintext returned once); not-configured;
  RPC error → discriminated, no throw; **no storage writes** (assert localStorage
  untouched, `RECOVERY_CODE_KEY` absent after the flow); **no code/hash in logs**
  (counts-only assertion, per the existing no-secrets tests).
- UI: button → confirm → success shows `<CodeDisplay>`; hostile `display_name`
  (`<img src=x onerror=…>`) renders as literal text in the dialog (Class D); error path
  retryable; done discards the code from state.
- Guard: confirm the `no dangerouslySetInnerHTML in src/teacher` test covers the new files.
- Full suite green + `vite build` clean (both entry points).

### Step 5 — docs (same landing)

- `SECURITY.md`: amend the teacher posture — SELECT-only **plus exactly one
  definer-mediated write** (recovery-code rotation, enrolment-scoped, hash-only,
  plaintext never server-side and never persisted) — and add the D-M3 residual paragraph
  in plain text.
- `DEPLOY.md`: add `0011` to the ordered migration list + a manual-check paragraph; update
  the "currently needs" line to `0006 → … → 0011`.
- `CLAUDE.md` (or the location Step 0 found): encode the D-M5 lens into the standing
  review checklist, verbatim from D-M5.
- `PROGRESS-REPORT.md`: the § entry (Step-0 findings + ADAPTs, the change, verification,
  the landing record with both shas, the brief-supersession note).
- `CHECKPOINTS.md`: tick C2 with date + §; add the operator line "apply `0011` + the
  BRIEF-TR manual verification" to Lane A.

### Step 6 — adversarial review (before landing; findings verified before fixed)

Three lenses, each a genuine attempt to break the work, verify-before-fix on every finding:

1. **RPC / authorization / RLS** — definer scope, `search_path`, the non-oracle error on
   every authz path, grants/revokes, hash-parity with the client pipeline, no table-posture
   drift.
2. **Cross-surface / identity-interplay (D-M5 — mandatory, first use)** — one browser,
   both surfaces: which session does every new call bind to; which storage keys does the
   teacher flow touch (answer must be: none); can anything here mutate the student
   surface's identity, storage, or session; is §109's isolation byte-identical after this
   change; does the student-side D8/claim path behave when the hash rotates under it.
3. **Never-stuck / Class D / scope+docs** — every UI path resolves; hostile strings inert;
   no drive-bys; docs match the code.

If any lens returns thin or placeholder output, re-run it at high effort — §121's review
caught its real bug only on the re-run.

### Landing

FF-only onto `origin/main` with the maintainer's same-session approval; record prior tip →
new tip in the § entry; feature commit + docs/log commit; main folder fast-forwarded.

## 5 · Manual verification (OPERATOR — requires `0010` then `0011` applied, in order; synthetic data ONLY; secure context per §119-F1)

1. Apply `0011` in the SQL editor (after `0010`). Expect "Success. No rows returned."
2. Teacher sign-in (`teacher.html`, demo credentials) → Demo Class 3B → a **seed** student's
   detail → Regenerate → confirm → the new code renders once.
3. Network tab on that request: the body carries **only the 64-hex hash** — the plaintext
   never leaves the browser.
4. On a throwaway anonymous profile (localhost or HTTPS): sidebar → "Use a code" → a wrong
   code fails honestly → the **new** code claims the seed student and reloads into her
   (synthetic) work. Never run this against the real protected student.
5. Cross-teacher deny: for a student **not** in the caller's classes, invoke the RPC (the
   second-teacher seed, or the SQL-editor role-simulation pattern used in §112/§117) →
   the single non-oracle error.
6. Student-session deny: from an anonymous student session, call
   `teacher_regen_code(...)` → the same single error.
7. Teacher browser localStorage after the flow: **no** student code keys present.
8. Rotate-under-a-live-device sanity: a signed-in device for that seed student keeps
   working after the rotation (the code is recovery-only; sessions are unaffected).
9. Cleanup: delete any scratch claims/students minted here; note them in the § entry
   (census discipline).

## 6 · Out of scope — name it, don't do it

- Any rotation **audit ledger** (who rotated whom, when) — named for the pilot review;
  not built here.
- RPC **rate limiting** — the confirm step guards fat fingers; a compromised-teacher mass
  rotation invalidates paper codes but harms no data and no live device; revisit at pilot.
- **Class-code** rotation UI (Lane D Phase B — a different code entirely).
- Any change to **claim semantics** (no auto-rotate-on-claim, no eviction changes, no D8
  behavior changes).
- Teacher rename, un-enrolment, exports, dashboards — Phase B.
- Anything touching prompts/brains — standing law.

## 7 · Karpathy close

Read every file before editing it. Smallest possible diff; one logical commit per unit;
no drive-by refactors, no opportunistic cleanups. The planner's claims in this brief are
hypotheses — Step 0's reading of the repo is the truth, and **stop-and-report beats
improvising** the moment they disagree. Land fast-forward with the maintainer's approval,
record the shas, and leave the log more honest than you found it.

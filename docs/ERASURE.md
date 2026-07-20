# ERASURE.md — the student-data erasure procedure (PDPO)

> **Status.** Policy spine ratified at **§130 (D-K1)**; the deletion *mechanism* has existed
> since **§115** (migration `0007`, `CASCADE → RESTRICT`) and was **walked once live at §119**
> (the `23503` witnessed, then the ordered two-step succeeded as the `c09dcf1e` orphan cleanup —
> PROGRESS-REPORT §119 R2). This paper documents the **procedure**, which is what §115 did not yet
> give. It is operator-facing; **one accountable human (the operator) executes an erasure.**
>
> **Scope.** Erasure of one student identity and all of that student's data from the live
> project. This is a manual two-step in the Supabase SQL editor — **there is no erasure RPC**
> (confirmed across migrations `0001`–`0011`). Never run against the real protected student for
> practice; rehearse on synthetic data only.

---

## 1. Who may request, and how

- **Requesters:** a **parent/guardian**, or the **student via her teacher**. The request reaches
  the **operator** (the one human who holds SQL-editor access), who executes it.
- Lyra collects no email or phone at signup (anonymous-per-device identity — `students` holds only
  `display_name` + `recovery_code_hash`, `supabase/migrations/0001_init.sql:18-24`), so an erasure
  request cannot arrive "self-service" through the app. It arrives through the adult chain above.

## 2. Verification before erasure (the anti-weaponisation rule)

Erasure is irreversible against the live DB, so identity is verified **before** anything is deleted:

- The **teacher confirms the enrolment link** (the student is on that teacher's roster — the
  `enrolments` row, `supabase/migrations/0005_teachers.sql:48-54`), **or** the request is made
  **device-in-hand** (the student's own device, showing her work).
- **Possession of a recovery code is NEVER sufficient on its own.** A recovery code is a
  password-equivalent (`lyra-recovery-code`, `src/supabase-client.js:17`; the server stores only its
  SHA-256 hash, `0001_init.sql:18-24`) — a shoulder-surfed code must not become an **erasure weapon**
  that lets one student wipe another. A code proves *device access*, not *the right to be forgotten*.

## 3. What gets erased, and in what order

Deleting the identity row cascades the entire subtree, then the auth user is removed. The order is
**forced by the `0007` RESTRICT edges** and must not be reversed.

### 3.1 The cascade subtree (deleting the `students` row removes all of this)

Every child table below references `students(id)` with `ON DELETE CASCADE`, so a single delete of the
`students` row removes the student's whole footprint in one statement:

| Child table | What it holds | Cascade edge |
|---|---|---|
| `learning_events` | Append-only learning ledger (grammar/growth/skills/structure/vocab) | `0001_init.sql:38` |
| `growth_profiles` | The Continuous Growth Report profile (running memory) | `0001_init.sql:55` |
| `blobs` | Layer-1 durable store — the raw writings/essays | `0001_init.sql:63` |
| `enrolments` | Roster membership (class links + roster display name) | `0005_teachers.sql:50` |
| `writing_snapshots` | Append-only essay-content snapshots ("the glass") | `0006_writing_snapshots.sql:23` |
| `report_snapshots` | Append-only archive of each issued growth report | `0008_report_snapshots.sql:28` |

*(A **teacher** erasure instead deletes the `teachers` row, whose subtree cascades `classes`
(`0005_teachers.sql:39`) → `enrolments` (`0005_teachers.sql:49`). `school_id` FKs are nullable with
no cascade and are not part of the identity chain.)*

### 3.2 The two-step execution order (the RESTRICT makes this mandatory)

Migration `0007` (§115) flipped **both** `auth.users` edges from `CASCADE` to **`RESTRICT`**
(`students_auth_user_id_fkey`, `0007_auth_fk_restrict.sql:39-41`; `teachers_auth_user_id_fkey`,
`0007_auth_fk_restrict.sql:54-56`). Consequence: **you cannot delete the `auth.users` row first** —
while a referencing `students`/`teachers` row exists, `delete from auth.users …` raises
`23503 foreign_key_violation` (witnessed verbatim live, §119 R2). That refusal *is* the §115 fix
(it once prevented a silent whole-subtree cascade-delete). So erasure is child-first:

```sql
-- STEP 1 — delete the identity row; its subtree cascades away (§3.1). Synthetic data only.
delete from public.students where id = '<student_uuid>';   -- (or public.teachers for a teacher)

-- STEP 2 — now the RESTRICT edge is satisfied; the auth user deletes cleanly (no 23503).
delete from auth.users where id = '<auth_user_uuid>';
```

Reversing the order hits the RESTRICT and fails with `23503` — the guard `0007` installed on purpose
(`0007_auth_fk_restrict.sql:16-27`). This exact two-step was run live at §119 (the ordered delete
that doubled as the long-owed orphan cleanup). **There is no erasure RPC** — `regenerate_recovery_code`
(`0010`), `teacher_regen_code` (`0011`), and `enrol_student` (`0009`) touch identity but none erases;
`claim_student` deletes only an *empty* caller row and is identity *transfer*, not erasure
(`0001_init.sql:139-144`).

### 3.3 The device side (do this too — the server is not the only copy)

Lyra is local-first: `localStorage` is authoritative and holds the student's work independent of the
server (`DEPLOY.md:52-54`). Server-side erasure does **not** clear the device. Instruct the requester
to **clear site data for the Lyra origin** on the student's device(s), which removes every `lyra-*`
key — the durable blobs, the Layer-2 logs, and the identity/secret keys (`lyra-recovery-code`,
`lyra-sb-student-id`; see `docs/DATA-MAP.md`). Order does not matter between the device clear and the
SQL steps; both are required for the data to be gone from both custodians the student can reach.

## 4. Backups — the honest retention statement (say this to the requester)

**Erased data persists in backups until those backups expire.** This is a deliberate, disclosed
commitment, not an oversight:

- **Custodian #3** (the offsite `age`-encrypted `pg_dump`, §125) keeps **30 daily + 12 monthly**
  copies by bucket lifecycle rule (`backup/README.md:29`, `DEPLOY.md:251-252`). `auth.users` and
  the `public` tables both ride in those dumps (`backup/RESTORE.md:11-24`), so an erased student
  remains inside existing encrypted backups until each rolls off (≤ ~13 months for the last monthly).
- **Custodian #2** (Supabase PITR, once on Pro) similarly retains within its window.
- **Backups are NOT hand-purged on erasure** (D-K1). They expire on the lifecycle clock. Tell the
  requester, in plain language: *"Your active data is removed within 7 days; encrypted backup copies
  are not individually edited — they age out automatically over the following months."*

> **VERIFY at A10:** the 30-daily/12-monthly lifecycle rules are an operator console step, unset until
> A10 completes (`CHECKPOINTS.md` A10). Until then, custodian #3 has no expiry clock and this paragraph
> overstates automatic roll-off — set the lifecycle rules before making the retention promise to a parent.

## 5. Service level

- **Within 7 days** of a *verified* request (D-K1). The 7 days run from verification (§2), not from the
  first contact — an unverified request is not yet an erasure request.

## 6. The erasure log (counts and dates only — no personal data)

Record every completed erasure as **one dated line**, counts only, **zero personal data** — the
project's counts-only privacy rule holds here as everywhere (`SECURITY.md:57-59`). Keep the log
wherever the operator keeps operational records (not necessarily in the repo; if in the repo, it
carries no ids). Format:

```
<YYYY-MM-DD> · erased 1 student identity (via teacher-verified request) ·
subtree rows removed: <n> learning_events, <n> blobs, <n> snapshots, 1 growth_profile, <n> enrolments ·
auth user removed · device-clear instructed · backups expire by lifecycle
```

Never record: the student's name, `display_name`, recovery code, `student`/`auth` UUIDs, class code,
or any essay content. A count and a date are the entire record. The redacted ids that already appear
in the § log (e.g. the §119 cleanup) are the only identifiers that exist anywhere, and this procedure
introduces no new ones.

## 7. What this procedure is NOT

- **Not automated.** There is no erasure endpoint or RPC; the operator runs the two SQL statements by
  hand. This is intentional — erasure is rare, irreversible, and human-verified.
- **Not a teacher power.** Teachers are SELECT-only plus the single `teacher_regen_code` write
  (`0011`); no teacher can delete a `students` row (no delete grant/policy exists —
  `0005_teachers.sql`, `0001_init.sql:87`). A teacher *requests* an erasure; the operator executes it.
- **Not backup-erasing.** See §4 — backups age out; they are not edited per-request.

---

*Derived from `supabase/migrations/0001`–`0011`, `SECURITY.md`, `DEPLOY.md`, `backup/`, and the §115 /
§119 / §125 log entries. Policy defaults (request path, teacher-verification, 7-day SLA, counts-only
log, backups-not-purged) are the ratified **D-K1** spine (§130) — the operator owns them; elaboration
here never contradicts them. `VERIFY` tags mark facts that depend on operator console steps not yet done.*

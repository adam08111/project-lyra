# BRIEF-115 — Offsite encrypted dump: custodian #3 (survives Supabase AND us)

> Self-contained executor brief (~1 session; **no migration, no app code** — a
> scheduled workflow + a script + a runbook). Implements DATA-ARCHITECTURE §4
> custodian 3: a nightly `pg_dump`, encrypted, pushed to object storage the
> maintainer controls on a *different provider* — the answer to Supabase's bad day
> and to the 2029 unpaid invoice. **The item is NOT done until the restore drill
> passes** — an untested backup is a hope, not a custodian.
> **Named brief:** § = tip+1 at landing. Prerequisite: **GitHub MFA is ON**
> (the workflow's secrets are DB-root-equivalent).

## Context

Supabase Pro's own backups are custodian #2 (same provider, same account, same
invoice). Custodian #3 must survive all three failing at once. GitHub Actions is
the serverless cron; the repo is private; secrets live in Actions secrets, scoped
to this one workflow.

## Decisions — do NOT relitigate

- The dump is **whole-database** (schema + data) — restorable anywhere Postgres
  runs, no Lyra code required to read it.
- Secrets never in git: the DB connection string and bucket credentials are Actions
  secrets; the **encryption private key exists only offline** (paper + password
  manager — same discipline as the recovery code). CLAUDE.md in full.

## New decisions this brief sets — RATIFY before executing

- **D-N1 Mechanism = GitHub Actions scheduled workflow** (`.github/workflows/
  backup.yml`): daily at 19:00 UTC (≈03:00 HKT), plus `workflow_dispatch` for
  manual runs. Steps: install a `pg_dump` whose **major version ≥ the server's**
  (Step 0 records `select version()`; install the matching PostgreSQL apt client) →
  `pg_dump --format=custom` → encrypt → upload → verify object exists + size > a
  sanity floor → job fails LOUDLY on any step (GitHub emails the operator — the
  alert channel, free).
- **D-N2 Encryption = `age`** with a **recipient public key committed in-repo**
  (`backup/age-recipient.txt`) and the identity (private key) offline only. Lose
  the identity → backups unreadable: the runbook says *write it down next to the
  recovery-code discipline* before the first run.
- **D-N3 Destination = S3-compatible object storage of the operator's choice**
  (R2 or S3 — the workflow uses S3-compatible upload, bucket + endpoint + keys as
  secrets). Bucket is private; **retention via bucket lifecycle rules** (operator
  console step, documented: keep 30 dailies + 12 monthly copies) — the workflow
  itself never deletes anything.
- **D-N4 The restore drill is part of DONE.** Documented in `backup/RESTORE.md`
  and performed once at landing: download latest → `age --decrypt` →
  `pg_restore --list` sanity + a full restore into a scratch database (local
  Postgres or a throwaway Supabase project) → row-count spot-checks
  (`students`, `learning_events`, `writing_snapshots`) match the live project.
  The § entry records the drill's numbers.
- **D-N5 Secrets inventory, named:** `LYRA_DB_URL` (the Supabase *connection
  string* — DB-root-equivalent; treat like `service_role`), `BACKUP_S3_ENDPOINT` /
  `BACKUP_S3_BUCKET` / `BACKUP_S3_KEY_ID` / `BACKUP_S3_SECRET`. Nothing else. The
  workflow must never echo any of them (`set +x` discipline; no secret in any log
  line).

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md` §4, § tip. Record the server's Postgres major version (the
operator runs `select version()` and supplies it). Confirm the repo is private.
Confirm no existing workflow collides.

**Step 1 — `backup/` folder:** `age-recipient.txt` (operator generates the pair
locally, commits the recipient, banks the identity offline — the runbook's first
step), `RESTORE.md` (the drill, exact commands, cmd-first), and a `README.md`
stating what this is and the retention posture.

**Step 2 — the workflow** per D-N1/D-N5 (concurrency-guarded, single job, ~40
lines; every step's failure fails the run).

**Step 3 — docs + landing.** DEPLOY.md gains a "Backups (custodian #3)" section
(secrets setup, lifecycle rules, the drill pointer); `DATA-ARCHITECTURE.md` §4
custodian 3 flips status at landing → and to LIVE-VERIFIED only after D-N4;
CHECKPOINTS C3; § entry; land per CLAUDE.md #2.

## Manual verification (Adam)

1. Generate the age pair; commit the recipient; **write the identity down**.
2. Set the five secrets; `workflow_dispatch` a first run → green → object in the
   bucket with today's date and a plausible size.
3. **The restore drill (D-N4)** — run `RESTORE.md` end to end; paste the row
   counts into the § record.
4. Set the bucket lifecycle rules; screenshot for the ops folder.
5. Break-glass check: deliberately fail one secret → the run fails → the email
   arrives. (Then fix it.)

## Out of scope

Point-in-time anything (that's custodian #2 / Supabase Pro). Per-table exports
(custodian #4 / BRIEF-116). Backup of Vercel/env config. Any retention automation
in the workflow. Any app code.

## Karpathy close

One workflow, one folder, one drill. The drill is the deliverable — a green cron
without a proven restore is theatre. Land FF with approval; record the shas and
the drill's row counts. Repo wins, always.

---
## PRE-RATIFIED AMENDMENTS (planner audit, 12 July — fold these at Step 0)
1. **Step-0 addition — Supabase managed schemas:** a whole-database `pg_dump` against
   Supabase will hit permission quirks on the managed schemas (`auth`, `storage`,
   `extensions`). Decide and record the chosen `--schema` scoping in RESTORE.md rather
   than discovering it mid-drill; the restore drill then validates the chosen set.
2. **Runbook addition — PDPO sentence:** the backup contains `auth.users` (children's
   pseudonymous identities; personal data under PDPO). The 30-day/12-month retention is
   therefore a data-retention commitment, and the erasure procedure must note that
   erased students persist in backups until lifecycle expiry. One sentence in
   RESTORE.md / DATA-MAP — stated before a DPA asks.

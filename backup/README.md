# Offsite encrypted backup — custodian #3

BRIEF-115 / §125. A nightly whole-database `pg_dump`, **encrypted with `age` on the CI runner**, pushed
to S3-compatible object storage the maintainer controls **on a different provider**. It is custodian #3
in `DATA-ARCHITECTURE.md` §4 — the copy that survives all of Supabase's own custodians failing at once
(a bad day, a deleted account, an unpaid invoice), because it is a different provider, account, and bill.

## What runs

`.github/workflows/backup.yml` — a GitHub Actions cron, daily at 19:00 UTC (≈03:00 HKT), plus
`workflow_dispatch` for manual runs. Each run: install a `pg_dump` client (major version ≥ the server)
+ `age` → dump `public` + `auth.users` (custom format) → `tar` → `age --encrypt` → upload to the bucket →
verify the object exists and clears a size floor. **Any step failing fails the run loudly**, and GitHub
emails the operator — that email is the (free) alert channel.

> **Keep the cron alive.** GitHub auto-disables a *scheduled* workflow after ~60 days with no repo
> activity — and a disabled cron sends no failure emails (it fails silent, the worst way). GitHub emails
> a disable warning first; treat that email as an action item and re-enable the workflow in the **Actions** tab.

## The three things that live OUTSIDE git

1. **The five Actions secrets** (DB-root-equivalent — `LYRA_DB_URL`, `BACKUP_S3_ENDPOINT`,
   `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY_ID`, `BACKUP_S3_SECRET`). Repo → Settings → Secrets and
   variables → Actions. **GitHub MFA must be ON** — these secrets are DB-root-equivalent.
2. **The `age` identity** (private key). `backup/age-recipient.txt` (public key) is committed and can
   only *encrypt*; the identity that *decrypts* is **paper + password manager, offline only** — the same
   discipline as a recovery code. Lose it → every backup is unreadable. See `RESTORE.md` step 1.
3. **The bucket lifecycle rules.** The workflow **never deletes anything** (D-N3). Set retention in the
   storage console — keep **30 daily** + **12 monthly** copies — and screenshot it for the ops folder.

## Restore

`RESTORE.md` is the drill and the disaster runbook (exact commands). **This backup is not "done" until
that drill passes once** — an untested backup is theatre. The § entry records the drill's row counts.

## What this is NOT

Point-in-time recovery (that is Supabase Pro, custodian #2). Per-student take-home export (custodian #4,
BRIEF-116). Vercel/env config backup. No retention automation, no app code — one workflow, one folder,
one drill.

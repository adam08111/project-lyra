# RESTORE — the drill and the disaster runbook

BRIEF-115 / §125, custodian #3. **A green backup cron without a proven restore is theatre.** Run this
drill ONCE at landing (row counts go in the § record), and again after any change to the workflow or the
schema. In a real disaster, this same runbook restores the data anywhere Postgres runs — no Lyra code.

All commands are copy-paste. Nothing here echoes a secret.

---

## 0 · What's in the backup (the chosen scope)

Each object is `lyra-YYYY-MM-DD.tar.gz.age` and, once decrypted + untarred, contains two custom-format
`pg_dump` archives:

- **`public.dump`** — the whole `public` schema: `students`, `classes`, `enrolments`, `learning_events`,
  `writing_snapshots`, `report_snapshots`, `growth_profiles`, `blobs`, and every function/policy in it.
- **`authusers.dump`** — the single table **`auth.users`** (the pseudonymous per-device identities).

**Why this scope** (pre-ratified amendment 1): a whole-database `pg_dump` on Supabase hits permission
quirks on the *managed* schemas (`storage`, `realtime`, `extensions`, `graphql`, `vault`, …) and drags in
`auth`'s role-owned functions that a plain Postgres can't restore. So we dump `public` + just `auth.users`,
`--no-owner --no-privileges`, and validate exactly that set here. If your DB role can't read `auth.users`,
drop `authusers.dump` and note it: students still self-recover via `students.recovery_code_hash`.

**PDPO note** (pre-ratified amendment 2): `auth.users` is children's pseudonymous personal data. The
30-day / 12-month bucket retention is therefore a **data-retention commitment** — an erased student
persists in backups until lifecycle expiry, and the PDPO erasure procedure must say so (see `DATA-MAP` /
the erasure runbook when written).

## 1 · One-time: generate the age key (before the FIRST backup runs)

```bash
age-keygen -o age-identity.key
# prints:  Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **Write the identity down** (the `AGE-SECRET-KEY-1...` inside `age-identity.key`) on paper AND in your
  password manager. This is the ONLY thing that can decrypt the backups. Treat it like a recovery code.
- Put the `age1...` **public** key on the last line of `backup/age-recipient.txt`, commit that file only.
- **Never commit `age-identity.key`.** Delete it from disk once it's banked offline.

## 2 · The restore drill

You need: the `age` identity (step 1), the `age` CLI, a `pg_dump`/`pg_restore` client, and a **scratch**
Postgres (local `docker run` or a throwaway Supabase project — NEVER the live project).

```bash
# a) Pull the latest object from the bucket (S3-compatible; use your endpoint + a read key).
export AWS_ACCESS_KEY_ID=…  AWS_SECRET_ACCESS_KEY=…  AWS_DEFAULT_REGION=auto
# LIST first and pick the newest key — the cron stamps in UTC, so before 19:00 UTC only the
# previous day's object exists; don't assume today's date.
aws s3 ls "s3://<BUCKET>/backups/" --endpoint-url "<ENDPOINT>"
OBJECT="lyra-YYYY-MM-DD.tar.gz.age"        # ← set to the newest key from the list above
aws s3 cp "s3://<BUCKET>/backups/${OBJECT}" . --endpoint-url "<ENDPOINT>"

# b) Decrypt with the OFFLINE identity, then untar.
age --decrypt -i age-identity.key -o backup.tar.gz "${OBJECT}"
tar -xzf backup.tar.gz            # → public.dump, authusers.dump

# c) Sanity-list before restoring (proves the archive is intact + readable).
pg_restore --list public.dump | head
pg_restore --list authusers.dump | head

# d) Full restore into a SCRATCH database.
createdb lyra_restore_test          # or point at your throwaway Supabase
# auth.users first (public FKs reference it); the schema must exist in the scratch DB:
psql -d lyra_restore_test -c 'create schema if not exists auth;'
# policies restore as `CREATE POLICY … TO <role>`; --no-privileges skips grants, not policies — a plain
# scratch Postgres needs the three roles or the drill fails its own "runs clean" criterion.
psql -d lyra_restore_test -c "create role anon nologin; create role authenticated nologin; create role service_role nologin;"
pg_restore --no-owner --no-privileges -d lyra_restore_test authusers.dump
pg_restore --no-owner --no-privileges -d lyra_restore_test public.dump
```

## 3 · Row-count spot-checks (paste these into the § record)

Run the SAME query on the restored scratch DB and on the live project — the counts must match.

```sql
select 'students'          as t, count(*) from students
union all select 'learning_events',    count(*) from learning_events
union all select 'writing_snapshots',  count(*) from writing_snapshots
union all select 'report_snapshots',   count(*) from report_snapshots
union all select 'growth_profiles',    count(*) from growth_profiles
union all select 'blobs',              count(*) from blobs
union all select 'enrolments',         count(*) from enrolments
union all select 'classes',            count(*) from classes
union all select 'teachers',           count(*) from teachers
union all select 'schools',            count(*) from schools
union all select 'auth.users',         count(*) from auth.users;
```

Drill PASSES when: the list + restore run clean, and every row count matches the live project (allowing
for rows written between the dump and the check). Record the numbers; drop the scratch DB when done.

## 4 · Break-glass check

Deliberately break one secret (e.g. rename `BACKUP_S3_SECRET`), `workflow_dispatch` a run → it must FAIL
and the GitHub failure email must arrive. Then fix it. This proves the alert channel works.

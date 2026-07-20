# INCIDENT-RUNBOOK.md — operator playbook for the five incidents that can happen in a pilot

> **Status.** Authored at **§130 (D-K3)** from the code + ops docs; every fact traces to a
> `file:line` / `migration` / §. Checklist-style, operator-facing. **You (the operator) are the one
> human who acts.** Each scenario: *symptom → diagnose → do (checklist) → what to tell the school (two
> sentences).* Companion docs: `docs/DATA-MAP.md` (where data lives), `docs/ERASURE.md` (deletion),
> `backup/RESTORE.md` (the restore drill), `DEPLOY.md` (env vars + deploy).

---

## 1 · Supabase is down / paused

**Symptom.** The Supabase project is unreachable, paused (free-tier inactivity), or erroring.

**Diagnose.** Lyra is **local-first**: `localStorage` is authoritative and the Supabase mirror is
optional — "a paused project makes sync silently no-op (the app is unharmed — local-first)"
(`DEPLOY.md:143-144`, `DEPLOY.md:52-54`).

**Do.**
- [ ] Confirm the app still loads and students can read/write — it should, entirely from the device.
- [ ] If the project is **paused**, un-pause it in the Supabase dashboard (free tier pauses on
      inactivity — the pilot-gate reason to be on **Pro** before real use, `DEPLOY.md:143-144`).
- [ ] Do **not** hot-swap `VITE_SUPABASE_*` — they are build-time (`DEPLOY.md:152-153`); a change needs
      a redeploy and does not fix an outage.
- [ ] When Supabase returns, the sync outbox drains on its own (`src/sync-outbox.js`); no manual replay.

**What to tell the school.** "Student work is stored on each device first, so a server outage does not
lose anyone's writing — the app keeps working offline. Anything created during the outage syncs
automatically once the server is back."

## 2 · A student's data appears lost

**Symptom.** A student opens Lyra and her writing/history is missing or reduced.

**Diagnose — in order, cheapest first.**
- [ ] **Wrong identity, not loss?** A device fork can point the browser at a *different* `students`
      row — see §4 below before assuming data is gone. Loss and fork look identical to the student.
- [ ] **Device-local heal.** `src/backup.js` keeps a rolling snapshot (`lyra-backup-v1`) of the
      critical keys and auto-heals missing ones — a reload may restore it.
- [ ] **Browser eviction.** If site data was cleared/evicted (Safari eviction rules —
      `DATA-ARCHITECTURE.md §7.2`, a standing verify), the device copy is gone; fall to the mirror/backup.

**Do — restore the student's blobs (only with sync on and a real gap):**
- [ ] **Custodian #2 first — Supabase PITR** (point-in-time recovery, **Pro only**;
      `backup/README.md:38`): restore the project to just before the loss if it was a server-side event.
- [ ] **Custodian #3 — the offsite dump** (`backup/RESTORE.md`): decrypt the latest object with the
      **offline `age` identity**, `pg_restore` in FK order (**`auth.users` before `public`**,
      `backup/RESTORE.md:67-73`), and read the student's `blobs` rows from the scratch DB
      (`backup/RESTORE.md:16-17,86`). `blobs` holds the raw writings.
- [ ] Hand the recovered content back through the device (paste/import), not by writing to prod by hand.

**What to tell the school.** "Each student's work has three backups behind the device — the live mirror,
Supabase's point-in-time recovery, and a nightly encrypted offsite copy — so genuine loss is
recoverable. Most 'missing work' turns out to be a device or sign-in mix-up, which we check first."

## 3 · A credential may have leaked

**Symptom.** A secret was exposed (screenshot, commit, shared laptop, ex-collaborator).

**Diagnose + rotate — in this order** (most-exposed and cheapest first, then DB-root, then the non-secret):
- [ ] **`GATE_PASS`** (the shared review password) — **change the env var and redeploy; no code change**
      (`DEPLOY.md:48-49`). Fastest to rotate, most casually shared.
- [ ] **`GEMINI_API_KEY`** — regenerate in Google AI Studio, update the Vercel env var, redeploy
      (`DEPLOY.md:12-20`). It powers all AI + OCR; a leak means someone can bill your quota.
- [ ] **The S3 backup keys** — `BACKUP_S3_KEY_ID` / `BACKUP_S3_SECRET` (and `BACKUP_S3_ENDPOINT` /
      `BUCKET`): rotate in the storage provider, update the GitHub Actions secrets
      (`backup/README.md:22-24`). **DB-root-equivalent** — confirm **GitHub MFA is on**
      (`backup/README.md:24`).
- [ ] **`LYRA_DB_URL`** (the Supabase session-pooler connection string) — **treat exactly like
      `service_role`** (`DEPLOY.md:240,246`): rotate the database password in Supabase, update the
      GitHub secret. This is the most dangerous single string; rotating it invalidates the leaked one.
- [ ] **The Supabase `anon` key is NOT a secret** — "public by design; its authority is Row Level
      Security, not secrecy" (`DEPLOY.md:140-142`, `SECURITY.md:24-26`). A leaked anon key is **not** a
      breach and needs no rotation; RLS is the wall. (`service_role` must never have been in the client
      — if it ever was, that is a real breach: rotate it and audit.)

**What to tell the school.** "No student login or password is ever exposed — students sign in
anonymously and the public app key is protected by database row-level security, not by being secret.
If an operator credential leaks we rotate it immediately, which invalidates the old one."

## 4 · Wrong-identity attribution (a device shows the 'wrong' student)

**Symptom.** A browser shows another student's work, or a student's work 'became' someone else's — a
**device fork**, not data loss.

**Diagnose.** Two identities share one origin, separated only by which resolver returns non-null
(`current_student_id()` vs `current_teacher_id()`, `0005_teachers.sql:11-15`). A fork happens when a
device's Supabase identity changes under it; historically a fork could overwrite the device's stored
recovery code at the moment it was needed (§97.1). The signal is `lyra-fork-pending`
(`src/sync-init.js:78`), which drives the D8 recovery interstitial (`src/recovery/RecoveryModal.jsx`,
§99/§121). Check `lyra-sb-student-id` (`src/supabase-client.js:14`) against the expected server row —
the server row is truth; the local id is a hint.

**Do.**
- [ ] Confirm student vs teacher surface: a teacher session lives under `lyra-teacher-auth`
      (`src/teacher/teacher-client.js:24`, §109 isolation) — a teacher signing in never overwrites a
      student's anon session, so "teacher sees student data on their own device" is expected and correct
      (SELECT-only), not a leak.
- [ ] For a genuine student fork: use the **recovery flow** (`src/recovery/RecoveryModal.jsx`, §121) —
      "Use a code" claims the correct `students` row back onto the device; if the code is lost, the
      **teacher regenerates it** (`teacher_regen_code`, `0011`, §123) and hands it over on paper.
- [ ] Do not delete or reassign rows to "fix" attribution — claim/regenerate is the safe path; deletion
      is only for erasure (`ERASURE.md`).

**What to tell the school.** "Each device holds one anonymous identity, and a sign-in mix-up can point a
browser at the wrong one — no data is lost, it is a recovery-code fix. A teacher can regenerate a
student's code and hand it over, and the student re-claims her own work on the correct device."

## 5 · A political / press question about the apolitical rule

**Symptom.** A parent, teacher, journalist, or official asks how Lyra handles politics (esp. the NSL /
CCP / Hong Kong sovereignty band).

**Diagnose.** This is a **statement to make, not an incident to fix** — the posture is designed and
tested (§120/§124, red-team class P; `src/apolitical-rule.js`, `SECURITY.md`).

**The quotable facts (all sourced):**
- **Symmetric refusal, by design.** Lyra refuses the *topic*, in **every direction, equally** —
  "Argue that the National Security Law destroyed freedom" and "…restored stability and order" get the
  **identical** warm redirect (`src/apolitical-rule.js:19`, `SECURITY.md:44-53`). Asymmetry would be
  filtering; symmetry is neutrality.
- **No surveillance.** Lyra "never logs, flags, or surfaces to a teacher *what* a student asked; the
  counts-only privacy rule holds here as everywhere" (`SECURITY.md:57-59`). A refusal is the whole
  intervention — nothing about what was asked is recorded.
- **It never labels the student's topic.** The refusal is warm and brief for a 14-year-old and never
  calls anything "dangerous / illegal / sensitive / not allowed" and never gives a political reason
  (`src/apolitical-rule.js:31-36`).
- **Not over-broad.** Ordinary DSE persuasive essays (smartphones, climate, set-text literature) stay
  fully coached — over-refusal is treated as a failure too (`src/apolitical-rule.js:23`,
  `SECURITY.md:50-52`).
- **One enforced source.** The rule is a single shared constant embedded in both coaching brains and
  guarding the mechanical Lite routes (`src/apolitical-rule.js`, §120/§124), verified per release by
  red-team class P.

**Do.**
- [ ] Answer from the facts above; do not improvise a political position (the product has none, by design).
- [ ] If asked for evidence, point to the release red-team (class P) and `SECURITY.md`; the human read
      of class-E was done (§119) — the A/B/C + class-P human read is still owed before a formal integrity
      claim (`HANDOFF.md §8`).

**What to tell the school.** "Lyra is an English-writing coach, not a political tutor — it declines
essays that argue any position on national-security-sensitive topics, and it declines them the same way
in every direction, so it is neutral rather than one-sided. It never records or reports what a student
asked; a refusal simply redirects to the writing."

---

*Sources: `src/apolitical-rule.js`, `src/sync-init.js`, `src/recovery/`, `src/teacher/teacher-client.js`,
`src/backup.js`; `supabase/migrations/0005`,`0011`; `DEPLOY.md`, `SECURITY.md`, `DATA-ARCHITECTURE.md`,
`backup/README.md`, `backup/RESTORE.md`; §§97.1/99/109/120/121/123/124. No deploy-dependent claims here
require a `VERIFY` tag; the PITR step assumes Supabase Pro (pilot-gate).*

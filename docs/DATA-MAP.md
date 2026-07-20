# DATA-MAP.md — every store, who reads it, how long it lives

> **Status.** Authored at **§130 (D-K2)** from the code, the migrations, and the ops docs. Every
> row traces to a `file:line` / `migration:line`; facts that depend on an unregistered production
> deploy are tagged **`VERIFY at A4`** (Vercel is not yet registered — `DATA-ARCHITECTURE.md:20-21`).
> The architecture law is `DATA-ARCHITECTURE.md`; this is its store-by-store index. Erasure of any
> student store is `docs/ERASURE.md`.

**Shape in one line.** Lyra is **local-first**: `localStorage` on the student's device is
authoritative; an **optional, flag-gated Supabase mirror** (RLS-governed) adds durability +
teacher-queryability; a nightly **offsite encrypted backup** is the last copy. Student text also
transits a proxy to **Google Gemini** for the AI itself. Four store classes follow.

---

## 1 · Client-side stores (the device — `localStorage` unless noted)

Authoritative copy of the student's work. "Mirror class" is the `src/blob-mirror.js` classification:
**ALLOW** = mirrored to the Supabase `blobs` table; **DENY (L2)** = deliberately not blob-mirrored
because it flows to Layer-2 tables instead (avoids two sources of truth); **DENY (local)** = never
leaves the device. Retention: `localStorage` persists until the student clears site data or the
browser evicts it (Safari eviction + home-screen-install nudge is a standing verify —
`DATA-ARCHITECTURE.md §7.2`, Lane D). Erasure touchpoint for **all** of these: the device site-data
clear in `ERASURE.md §3.3`.

### 1a · Durable student data

| Key | Holds | Sensitivity | Mirror class | Defined at |
|---|---|---|---|---|
| `lyra-projects` | Writings + their coaching chats (largest, most irreplaceable) | — | ALLOW → `blobs` | `src/blob-mirror.js:20` |
| `lyra-user-name` | The student's **display name** | **PII (minor's name)** | ALLOW → `blobs` | `src/blob-mirror.js:21` |
| `lyra-style-skills` | Saved analysed writer skills | — | ALLOW → `blobs` | `src/blob-mirror.js:22` |
| `lyra-training-chats` | Reporter→Columnist practice threads | — | ALLOW → `blobs` | `src/blob-mirror.js:23` |
| `lyra-training-progress` | Per-technique practice attempts | — | ALLOW → `blobs` | `src/blob-mirror.js:24` |
| `lyra-saved-concepts` | Bookmarked grammar concepts | — | ALLOW → `blobs` | `src/blob-mirror.js:25` |
| `grammar-log` | Grammar-mistakes log | — | DENY (L2) → `learning_events` | `src/data-layer.js:124` |
| `lyra-growth-log` | Before/after growth log | — | DENY (L2) → `learning_events` | `src/data-layer.js:21` |
| `lyra-skill-deployments` | Skill-deployment log | — | DENY (L2) → `learning_events` | `src/data-layer.js:22` |
| `lyra-structures` | Sentence-structure library | — | DENY (L2) → `learning_events` | `src/data-layer.js:23` |
| `lyra-vocabulary` | Vocabulary arsenal | — | DENY (L2) → `learning_events` | `src/data-layer.js:24` |
| `lyra-masterclass-reports` | Masterclass / Achievements cards | — | DENY (L2) → `learning_events` | `src/data-layer.js:25` |
| `lyra-growth-profile` | Continuous Growth Report profile (Lyra's running memory) | — | DENY (L2) → `growth_profiles` | `src/growth-report.js:20` |

### 1b · Identity / secret keys (treat as sensitive)

| Key | Holds | Sensitivity | Mirror class | Defined at |
|---|---|---|---|---|
| `lyra-recovery-code` (`RECOVERY_CODE_KEY`) | **Plaintext recovery code** (password-equivalent; server holds only the SHA-256 hash) | **SECRET** | DENY (local) — never mirrored, never backed up | `src/supabase-client.js:17` |
| `lyra-sb-student-id` (`STUDENT_ID_HINT`) | Supabase `students` row id (hint; the RLS-scoped server row is truth) | **IDENTITY** | DENY (local) | `src/supabase-client.js:14` |
| `lyra-teacher-auth` | The **teacher's** Supabase auth session (JWT + refresh) — a deliberately separate `storageKey` so a teacher sign-in never overwrites the student's anon session on the same origin (§109) | **SECRET / teacher identity** | Teacher surface — not in either blob set | `src/teacher/teacher-client.js:24` |

### 1c · Device-local machinery, one-time flags, regenerable caches (never mirrored)

`lyra-backup-v1` (rolling local heal-snapshot of the CRITICAL keys, `src/backup.js:23`) ·
`lyra-sync-outbox` (pending-sync queue, `src/sync-outbox.js:14`) · `lyra-sync-backfill-v1`,
`lyra-sync-import-pending`, `lyra-growth-purge-v1`, `lyra-title-detrunc-v1` (one-time flags) ·
`lyra-growth-pending` (derived regen counter, `src/learning-sync.js:212`) ·
`lyra-annotation-glossary`, `lyra-word-dictionary`, `lyra-training-exercises`,
`lyra-stylelab-reference`, `lyra-wl-debug` (regenerable caches / buffers) · **`sessionStorage`:**
`lyra-hydrated-v1` (reload-loop guard, `src/hydrate.js:16`), `lyra-fork-pending` / `lyra-fork-ack`
(device-fork signals driving the recovery UI, `src/recovery/RecoveryModal.jsx:7-8`),
`lyra-enrol-skipped` · `lyra-enrol-state` (enrol lifecycle, `src/enrol/EnrolOverlay.jsx:19`).
None hold student content; all are safe to lose (regenerated or re-derived). *(Doc caveat for a
future audit: `lyra-teacher-auth` and the enrol/fork flags are not enumerated in `blob-mirror.js`'s
explicit `DENY_KEYS`; the mirror gate is ALLOW-only so they are never mirrored in practice, but a
reader auditing only that list would miss them.)*

## 2 · Server-side stores (Supabase, schema `public` — the flag-gated mirror)

RLS is enabled on every table; the only client role is `authenticated` (students via
`signInAnonymously()`, teachers via email+password); `anon` is revoked everywhere
(`0004_revoke_anon.sql:18-21`); `service_role` is never client-side. **"Teacher reads?"** is the
§106–§109 SELECT-only teacher surface. Retention: append-only tables are immutable at both the policy
and grant layer; there is **no TTL / auto-purge clause** in any migration — the only automatic
deletion vector is FK cascade on identity erasure (`ERASURE.md §3.1`). Erasure touchpoint for every
student-owned table: the `students`-row cascade in `ERASURE.md §3`.

| Table | Holds | Who can SELECT | Writes | Teacher reads? | Created |
|---|---|---|---|---|---|
| `students` | One row per device identity: `display_name`, `recovery_code_hash` | Owner only (`auth_user_id = auth.uid()`) | Owner insert/update; **no delete policy** | **No** — unreachable | `0001_init.sql:18-24` |
| `learning_events` | Append-only learning ledger | Owner **+ teacher** (enrolment-scoped) | Owner insert; append-only | **Yes (SELECT)** | `0001_init.sql:36-48` |
| `growth_profiles` | The mutable growth doc (LWW via `upsert_growth_profile`) | Owner **+ teacher** | Owner insert/update | **Yes (SELECT)** | `0001_init.sql:54-59` |
| `blobs` | Layer-1 durable store — **raw writings/essays** | Owner only | Owner insert/update | **No** — excluded (`0005:18-19`) | `0001_init.sql:62-68` |
| `student_rule_frequency` (view) | Grammar rule-frequency aggregate | Invoker-security → owner + teacher | n/a (view) | **Yes** | `0001_init.sql:73-77` |
| `schools` | Tenant table (`name`) | Teacher of that school | Operator/SQL-editor only | Yes (own school) | `0005_teachers.sql:22-26` |
| `teachers` | One row per teacher (operator-provisioned) | Own row only | Operator-provisioned; no write grant | Yes (own row) | `0005_teachers.sql:29-35` |
| `classes` | A class owned by a teacher; `class_code` (`0009`) | Teacher owner | via `enrol_student` RPC only | Yes (own classes) | `0005_teachers.sql:37-43` |
| `enrolments` | Roster membership (class link + roster name) | Teacher (class scope) **+ student** (own rows, `0009:40`) | via `enrol_student` RPC only | Yes (class scope) | `0005_teachers.sql:48-54` |
| `writing_snapshots` | Append-only essay-content snapshots ("the glass") | Owner only | Owner insert; append-only | **No** — excluded (essay content) | `0006_writing_snapshots.sql:21-32` |
| `report_snapshots` | Append-only archive of each issued growth report | Owner only | Owner insert; append-only | **No** — excluded | `0008_report_snapshots.sql:26-35` |

**Unreachable to teachers, anon, and other students:** `students`, `blobs`, `writing_snapshots`,
`report_snapshots`. **Identity resolvers** (`current_student_id()` `0001:28`, `current_teacher_id()`
`0005:62`, both SECURITY DEFINER, `search_path`-pinned) separate the two surfaces: a teacher has no
`students` row so student self-policies never match, and vice-versa (`0005_teachers.sql:11-15`).

## 3 · The offsite backup bucket (custodian #3, §125)

A nightly GitHub Actions job dumps `public` + `auth.users`, `tar`s them, **`age`-encrypts on the
runner** (the store only ever holds ciphertext), and uploads to a private S3-compatible bucket on a
**different provider** (`.github/workflows/backup.yml:73-100`, `backup/README.md:4-6`). Contents of
a decrypted object: `public.dump` (all `public` tables above, incl. `blobs`) + `authusers.dump`
(`auth.users` only) — `backup/RESTORE.md:11-24`. **Retention: 30 daily + 12 monthly** by bucket
lifecycle rule (`backup/README.md:28-30`) — so an **erased student persists here until expiry**
(`ERASURE.md §4`; PDPO note `backup/RESTORE.md:26-30`). The `age` private identity lives **offline**
(paper + password manager); losing it makes every backup unreadable (`backup/README.md:25-27`).
The S3 + DB secrets are **DB-root-equivalent** (`backup/README.md:24`).
**`VERIFY at A10`:** the bucket, secrets, and lifecycle rules are unset until the operator completes
A10 — until then this custodian is artifacts-only (`CHECKPOINTS.md` A10, `DATA-ARCHITECTURE.md:133-138`).

## 4 · Data in transit / third parties

- **Google Gemini (the AI itself).** Student text (chat, drafts for proofread/analysis, and photo
  OCR) is sent `callAI()` → `/api/gemini` → the proxy (which holds `GEMINI_API_KEY`, server-only) →
  Google Gemini (`CLAUDE.md:3`, `DEPLOY.md:12-20`). This is a real third-party data flow. Safety
  thresholds + the apolitical rule apply before/around it (`src/safety-settings.js`,
  `src/apolitical-rule.js`). **ToS/training posture:** the free/Hobby tier's model-training terms mean
  **Supabase + Vercel must be on paid tiers before any real human types** (HANDOFF; A4/A-Pro) —
  synthetic data only until then.
- **Vercel (hosting + the proxy).** Serves the static app and the serverless proxy. Request/function
  logging posture is **`VERIFY at A4`** — no production deployment exists yet
  (`DATA-ARCHITECTURE.md:20-21`), so what Vercel logs (and for how long) can't be asserted from the
  repo; confirm at registration, and prefer not logging request bodies.
- **The Supabase anon key** ships in the client bundle by design — "its authority is Row Level
  Security, not secrecy" (`DEPLOY.md:140-142`, `SECURITY.md:24-26`). It is not a leak.

---

*Sources: `src/blob-mirror.js`, `src/backup.js`, `src/supabase-client.js`, `src/data-layer.js`,
`src/sync-*.js`, `src/growth-report.js`, `src/teacher/teacher-client.js`, `src/recovery/`,
`src/enrol/`; `supabase/migrations/0001`–`0011`; `DEPLOY.md`, `SECURITY.md`, `DATA-ARCHITECTURE.md`,
`backup/`. `VERIFY` tags mark deploy/console-dependent facts (A4 Vercel, A10 backup) that the repo
cannot confirm.*

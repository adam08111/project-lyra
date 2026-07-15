# TASK BRIEF — P0 Phase 0: Supabase foundation (lands as §95)

> Executor: Claude Code, one session. Planning brain: Fable 5. Decisions D1–D6 below were ratified by Adam on 3 Jul 2026 — they are settled.
> This phase lands with **zero behavior change when the Supabase env vars are unset**. It is executable and landable even if the Supabase project does not exist yet.

---

## Context

Lyra's P0 is a two-layer Supabase data layer. **Layer 2 (the moat):** the learning data — Grammar Log, growth log, skill deployments, structures, vocabulary, masterclass reports, growth profile — mirrored into a structured, queryable per-student schema. **Layer 1 (durability):** the `window.storage` blob store backed remotely. A critical, confirmed architecture fact: the learning loop (`learning-sync.js`, `growth-report.js`) reads and writes **raw `localStorage` directly and never touches the `window.storage` shim** — so Layer 2 hooks the learning modules, not the shim, and Layer 2 lands first (Phases 1–2); Layer 1 is Phase 3.

The stance is **local-first**: localStorage remains the synchronous, authoritative read/write layer the app already trusts (never-stuck, offline-tolerant); Supabase is a durable mirror fed later by an async outbox. **This phase (Phase 0) builds only the foundation**: the client module, anonymous-auth identity, the SQL schema (migration 0001), extraction of the dedup key functions into a shared module, boot wiring, and docs. No learning data is synced in this phase.

Everything is behind a feature flag: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` unset → the app is byte-identical to today (same pattern as the `GATE_PASS` gate).

## Decisions — DO NOT RELITIGATE

**Ratified for this P0 (D1–D6):**

1. **D1 — Local-first write-through.** localStorage stays authoritative for reads. Supabase mirrors asynchronously (outbox arrives in Phase 1). Feature-flagged off when env unset.
2. **D2 — Lyra gets its own Supabase project**, separate from any other project, region `ap-southeast-1` (Singapore). Adam creates it manually.
3. **D3 — Identity v1: Supabase anonymous auth per device + a student recovery code.** Anonymous sign-in gives a real `auth.uid()` so Row Level Security is enforced from migration 0001. The recovery code (generated client-side on first run; only its SHA-256 hex stored server-side) is the continuity mechanism across cache-clear/device via a `claim_student` RPC (RPC ships now; the claim UX is Phase 2). Teacher/class identity is a later, additive migration.
4. **D4 — Layer 2 before Layer 1.** This phase is Layer 2 groundwork.
5. **D5 — Schema shape:** append-only `learning_events` (promoted columns + full JSONB payload) + `growth_profiles` (JSONB doc) + `blobs` (Layer 1, created now, used in Phase 3) + `student_rule_frequency` view. Server-side dedup identity = `unique(student_id, type, content_key)` where the content keys are **exactly** the strings `learning-sync.js` already computes.
6. **D6 — The Supabase anon key ships client-side via `VITE_` env vars, by design.** It is a public-by-design credential whose authority is RLS, not secrecy. This is a **documented exception** to Lyra's keys-behind-the-proxy convention. `service_role` must never appear in the repo, the client bundle, or Vercel env.

**Inherited (locked in CLAUDE.md / CONTEXT §7):** both proxies (`server/proxy.js`, `api/gemini.js`) untouched; `ai-router.js`, `lyra-brain.js`, `judgment-rules.js` untouched; single source of truth — the dedup keys move to ONE module, never a second copy; never-stuck (#7) — no network call may block, throw uncaught, or strand the UI; §87/§88 privacy — sync-layer logging is **counts/status codes only, never student content** (these are minors); mobile untouched (no UI in this phase); push-and-land on `origin/main`.

## Steps

**Step 0 — Read first (Karpathy #1), then stop-and-report on any mismatch.**
Read: `CLAUDE.md`, the tail of `PROGRESS-REPORT.md`, `src/learning-sync.js`, `src/main.jsx`, `src/growth-report.js`, `src/storage-shim.js`, `package.json`, `.env.example`, `DEPLOY.md`, `.vercelignore`, root `vite.config.js`.
Confirm before writing any code:
- The §-log tip is **§94.3** → this work lands as **§95**. If later entries exist, take the next number and say so in the report.
- `main.jsx` boot chain is `autoRestoreFromBackup` → `purgeInauthenticGrowthV1` → `migrateTruncatedTitlesV1` → mount.
- The dedup key computations in `learning-sync.js` match the shapes in Step 2 exactly.
If any of these differ → **STOP, report the divergence, do not proceed.**

**Step 1 — Dependency.** `npm i @supabase/supabase-js`. Commit (include lockfile).

**Step 2 — `src/content-keys.js` (single source of truth for dedup identities).**
Extract the exact key computations from `learning-sync.js` into pure, exported functions — **the output strings must be byte-identical to today's inline versions**, because in Phase 1 they become server-side dedup identities; any drift silently forks local vs remote dedup:
- `normGrowthText(s)` — move it here from `learning-sync.js` (it is part of the growth key definition); `learning-sync.js` re-imports it (it also feeds `isAuthenticGrowth`).
- `grammarKey(e)` → `` `${(e.phrase||"").toLowerCase()}|${(e.correction||"").toLowerCase()}` ``
- `skillKey(s)` → `` `${(s.skillName||"").toLowerCase()}|${(s.studentApplication||"").toLowerCase()}` ``
- `growthKey(e)` → `` `${normGrowthText(e.before)}|${normGrowthText(e.after)}` ``
- `structureKey(s)` → `s.name`
- `vocabKey(v)` → `v.strong`
- `reportKey(r)` → `(r.after||"").trim()`
Replace the inline computations in `learning-sync.js` with these imports. **Existing tests (`learning-sync`, `learning-sync-dedup`, `authentic-growth`) must pass unmodified — they are the proof of behavioral identity.** Add `tests/content-keys.test.js`: unit-test each function (case-folding, whitespace collapse, empty/undefined fields). Commit.

**Step 3 — `src/supabase-client.js`.**
- `getSupabase()`: reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` lazily on each call until a client is successfully created (lazy read keeps it testable with `vi.stubEnv`); both present → memoized `createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })`; otherwise `null`. Never throws.
- `ensureStudent()`: fully try/catch'd; returns `{ studentId }` or `null`; on failure logs one counts-only line (status/code, never content) and returns `null` — the app must be indifferent to failure (#7). Flow:
  1. `getSupabase()`; null → return null.
  2. `getSession()`; if no session → `signInAnonymously()`.
  3. `select` own `students` row (RLS scopes it). If found → cache and return its id.
  4. If none: generate a recovery code client-side — 16 chars in 4 groups (`XXXX-XXXX-XXXX-XXXX`) from alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L) using `crypto.getRandomValues`. `insert` `{ recovery_code_hash: <SHA-256 hex of code via WebCrypto> }` with `.select()`, on-conflict-do-nothing on `auth_user_id`. **Only if the insert returned the new row**, persist the plaintext code to `localStorage["lyra-recovery-code"]` (device-local by design: it exists so the student can write it down; a cross-tab first-boot race discards the loser's code — benign, note in a comment). If the insert conflicted (race), re-select and do not store the generated code.
  5. Cache `student_id` in module memory + `localStorage["lyra-sb-student-id"]` as a hint only — the server row is truth.
Commit with `tests/supabase-client.test.js`: `getSupabase()` → null when env unset; returns client when both stubbed (`vi.stubEnv`); `ensureStudent()` → null and does not throw when client is null. **No network in tests** — mock `@supabase/supabase-js`.

**Step 4 — `supabase/migrations/0001_init.sql`** — authored in-repo as the schema's single source of truth; **do not attempt to apply it** (no Supabase CLI/network assumed — Adam applies it via the SQL editor). Author exactly:
- `create extension if not exists pgcrypto;`
- **`students`**: `id uuid pk default gen_random_uuid()`, `auth_user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade`, `display_name text`, `recovery_code_hash text`, `created_at timestamptz not null default now()`.
- Helper: `create function current_student_id() returns uuid language sql stable security definer set search_path = public as $$ select id from students where auth_user_id = auth.uid() $$;`
- **`learning_events`**: `id uuid pk default gen_random_uuid()`, `student_id uuid not null references students(id) on delete cascade`, `type text not null check (type in ('grammar','growth','skill_deployed','structure','vocabulary','report'))`, `content_key text not null`, `rule text`, `technique text`, `topic text`, `ts timestamptz not null`, `payload jsonb not null`, `created_at timestamptz not null default now()`, `unique (student_id, type, content_key)`. Indexes: `(student_id, type)`, `(student_id, ts)`, partial `(student_id, rule) where rule is not null`.
- **`growth_profiles`**: `student_id uuid pk references students(id) on delete cascade`, `profile jsonb not null`, `last_regen_at timestamptz`, `updated_at timestamptz not null default now()`.
- **`blobs`**: `student_id uuid not null references students(id) on delete cascade`, `key text not null`, `value text not null`, `updated_at timestamptz not null default now()`, `primary key (student_id, key)`.
- **View** `student_rule_frequency` with `security_invoker = on` (RLS applies through it): `select student_id, rule, count(*) as occurrences, min(ts) as first_seen, max(ts) as last_seen from learning_events where type = 'grammar' and rule is not null group by 1, 2;`
- **RLS** enabled on all four tables. `students`: select/update `using (auth_user_id = auth.uid())` (+ matching `with check`); insert `with check (auth_user_id = auth.uid())`. `learning_events`: select `using (student_id = current_student_id())`, insert `with check (student_id = current_student_id())`, **no update/delete policies** (append-only). `growth_profiles`, `blobs`: select/insert/update on `student_id = current_student_id()`.
- **`claim_student(p_code text) returns boolean`**, `security definer`, `set search_path = public`, granted to `authenticated` only: hash `p_code` (`encode(digest(p_code, 'sha256'), 'hex')`); find the matching `students` row → none: `false`; already owned by `auth.uid()`: `true`; else if `auth.uid()` has its own row: delete it **only if** it has zero `learning_events`/`growth_profiles`/`blobs` rows (otherwise return `false` — merging is out of scope); then `update` the target row's `auth_user_id = auth.uid()` and return `true`.
Commit.

**Step 5 — Boot wiring.** `src/sync-init.js` exporting `initSync()`: async fire-and-forget; `getSupabase()` null → still expose `window.lyraSync = { status: () => ({ enabled: false }) }` and return; else `ensureStudent()` and expose `window.lyraSync = { status: () => ({ enabled: true, studentId }), code: () => localStorage.getItem("lyra-recovery-code") }` (console-only utility — precedent: `backup.js`; `claim()` arrives in Phase 2). In `main.jsx`: one import + one **un-awaited** `initSync()` call placed **after** the existing boot chain (`autoRestoreFromBackup` → `purge` → `migrate`) — it must not delay first paint and must not reorder that chain. Add `tests/sync-init.test.js`: no env → resolves without throwing, `status()` reports `enabled: false`. Commit.

**Step 6 — Config + docs.**
- `.env.example`: add both vars with this note: *"Public-by-design: the anon key's authority is Row Level Security, not secrecy. Documented exception to the keys-behind-the-proxy convention — do NOT move it behind /api. `service_role` must NEVER appear in the repo, the client bundle, or Vercel env. Unset both to disable sync entirely."*
- `DEPLOY.md`: new "Supabase (P0)" section — create project (region `ap-southeast-1`); **enable Anonymous sign-in** (Authentication → Providers → Anonymous — off by default); apply `supabase/migrations/0001_init.sql` via the SQL editor; set the two env vars in Vercel; flag-off behavior when unset; free tier pauses on inactivity → move to Pro before any school pilot.
- `.vercelignore`: append `supabase/`.
- Vite exposes `VITE_*` automatically — confirm no `vite.config.js` change is needed (expected: none).
Commit.

**Step 7 — Close out.** Append **§95** to `PROGRESS-REPORT.md` (what/why/verification line incl. test count). Full suite green; `vite build` clean. Push the branch; land on `origin/main` per CLAUDE.md #2 (`merge-base --is-ancestor` guard; fast-forward only; never force; never delete branches). Report the commit list, the new `origin/main` sha, and the final test count.

## Manual verification

**Executor, env unset (must all pass in-session):** full test suite green — expect **417 + new** (report exact count); `vite build` clean; app boots in the dev preview with zero console errors; `window.lyraSync.status()` → `{ enabled: false }`; `git grep` shows no `service_role` anywhere.

**Adam, after creating the project + applying 0001 + setting `.env` (may be after the session):** reload the app → Supabase dashboard shows exactly **one** `students` row with `recovery_code_hash` populated; `lyraSync.status()` → `{ enabled: true, studentId }`; `lyraSync.code()` prints the code; a second reload creates **no** second row (idempotent); `select * from student_rule_frequency;` runs (empty). *(These checks move into Phase 1's session if the project exists by then.)*

## Out of scope

All actual syncing (outbox, event/profile mirroring — Phase 1); hydration, backfill, `claim()` console util and any claim UX (Phase 2); `storage-shim.js` changes and blob write-through (Phase 3); teacher/class tables and teacher-read RLS; any UI; any change to `learning-sync.js` beyond the key-extraction imports; proxies, router, brain, judgment-rules; applying the migration; removing or weakening the localStorage path (it is permanent, not transitional).

## Karpathy close

Read the touched files first; smallest diff that works; commit per logical unit (suggested: deps → content-keys → supabase-client → migration → boot wiring → docs → § entry); no drive-by refactors — `main.jsx` gets exactly one import and one call, `learning-sync.js` changes only its key computations to imports. Stop-and-report triggers: §-log tip ≠ 94.3, boot chain differs, dedup key shapes differ, `VITE_` env plumbing surprises, or anything in the repo contradicting this brief. Tests green with the count named, build clean, push AND land on `origin/main`, report shas. Branch hygiene report-only.

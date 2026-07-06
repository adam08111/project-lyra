# BRIEF §109 — Session isolation: teacher auth must never touch the student's anonymous session

> Self-contained executor micro-brief (~half session). Fixes the review's CONFIRMED-HIGH
> finding: §106's `src/teacher/auth.js` reuses `getSupabase()`, so teacher sign-in and the
> student's anonymous session share ONE auth storage key — signing in as a teacher replaces
> the student session, and the next student-app boot runs `ensureStudent` under the
> teacher's uid (mints a teacher-owned `students` row, attributes the machine's local data
> to it, replays the §97.1 recovery-code clobber). Blast radius is zero today only because
> migration 0005 is not yet applied — this lands BEFORE any teacher exists.
> Origin note for the record: the §106 brief itself instructed the reuse. The fix removes
> the defect *and* adds a guard so the class of bug cannot return under any future planner.

## Context

Two independent layers, both required:
**Layer 1 — storage isolation:** the teacher surface gets its own Supabase client with a
distinct `auth.storageKey`, so the teacher session and the student anonymous session
coexist per-origin without touching each other.
**Layer 2 — identity guard:** the student sync layer refuses to operate under any
non-anonymous session, ever — defense-in-depth against every future non-anonymous
identity, not just teachers.

## Decisions — do NOT relitigate

- Single source of truth (#3): exactly ONE place reads `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`. The teacher client consumes the same config the student
  client does — no second env read.
- §106's discriminated-result auth API (`ok`/typed-`error`) is preserved unmodified in
  meaning; §107's Class D tests untouched.
- Zero `src/lyra.jsx` contact. No migration, no RLS change, no proxy/brain change.
- Never-stuck #7 applies to any new failure path.

## New decisions this brief sets — RATIFY before executing

- **D-D1** Teacher isolation: `src/teacher/teacher-client.js`, a lazy singleton
  `createClient(url, anonKey, { auth: { storageKey: 'lyra-teacher-auth', persistSession:
  true } })`. **Every** file under `src/teacher/` (today: `auth.js`, `queries.js` — Step 0
  sweeps for others) uses it. A source-grep test bans `getSupabase(` usage anywhere in
  `src/teacher/` (usage-matched, non-vacuous — §107's grep-guard precedent).
- **D-D2** Guard placement + behavior: in the student boot path, immediately after
  session acquisition and BEFORE any anonymous-sign-in decision or `ensureStudent` call —
  if a session exists and `session.user.is_anonymous !== true`: do NOT run
  `ensureStudent`, do NOT `signInAnonymously` over the session (that would destroy a real
  user's session), no-op the sync layer for this boot with a counts-only
  `console.warn("[sync] non-anonymous session — sync disabled")` and a
  `status().nonAnonymousSession = true` flag (D8's shape). The app runs
  localStorage-native — its normal degraded mode.
- **D-D3** Docs rider (docs-only commit): verify `HANDOFF.md` and
  `LYRA-BRIEF-106/107/108-*.md` exist in-repo; add any that are missing, content verbatim
  as delivered. (Carried finding: the log has zero HANDOFF mentions.)
- **D-D4** CLAUDE.md #2 gains one line encoding the practiced landing rule: "Landing on
  `origin/main` requires the maintainer's same-session approval; if not granted, push the
  branch and report the pending land — never leave work unpushed." (Removes the
  written-law vs practiced-rule drift the close-out introduced.)
- **D-D5** DEPLOY.md seed block: cmd syntax primary (`set SUPABASE_URL=...` etc. — the
  operator's shell), PowerShell kept as the labelled alternate.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`, § tip
(expected §108 + close-out → this is §109; state the HEAD sha found).
Read `src/supabase-client.js` end-to-end: where the env pair is read, `getSupabase()`
shape, the exact boot order in `initSync` (session acquisition → anonymous sign-in →
`ensureStudent`), and confirm `user.is_anonymous` is present on the installed
`@supabase/supabase-js` (the project already uses anonymous sign-in, so the SDK should
carry it — if the flag is absent, STOP and report before improvising a fallback).
Read every file in `src/teacher/` and list each client usage. Read the §106 auth tests
to find the mock seam they'll need moved to.

**Step 1 — config seam.** Export the already-computed config (url / anonKey /
isConfigured) from `src/supabase-client.js` — smallest possible diff; do not duplicate
the env read or the flag logic.

**Step 2 — `src/teacher/teacher-client.js`** per D-D1, mirroring `getSupabase()`'s lazy
shape; not-configured resolves to §106's existing `not-configured` result path.

**Step 3 — switch `src/teacher/auth.js` + `queries.js`** (+ anything Step 0 found) to the
teacher client. No behavior change to results or error taxonomy.

**Step 4 — the guard** per D-D2, in `src/supabase-client.js` at the placement named
above. One conditional plus the warn + status flag; nothing else moves.

**Step 5 — tests.**
(a) storageKey assertion: mocked `createClient` captures options; assert the teacher
client passes `storageKey: 'lyra-teacher-auth'` and the student client does not.
(b) guard: mocked non-anonymous session → no `ensureStudent` insert, no
`signInAnonymously` call, `nonAnonymousSession` flagged; mocked anonymous session →
existing path unchanged (current tests stay green as the proof).
(c) the `src/teacher/` no-`getSupabase(` grep-guard.
(d) move the 14 §106 auth-test mocks to the new import seam — intent unmodified.
Suite: 563 baseline + new, all green; `vite build` clean, both entries emit.

**Step 6 — docs commit.** D-D3 + D-D4 + D-D5 riders; `SECURITY.md` gains one line
("the teacher session is storage-isolated from the student's anonymous session; the
student sync layer refuses non-anonymous sessions"); the §109 log entry.

**Step 7 — land** per the amended rule: offer the FF land; on approval, record the
commit list and the new tip per the close-out convention.

## Manual verification (Adam — throwaway browser profile until these PASS; safe anywhere after)

1. **Coexistence:** fresh profile, student app open (env set) → note
   `lyraSync.status().studentId`. Same profile, `/teacher.html` → teacher sign-in →
   student tab reload → **same studentId**, no `identityChanged`, no D8 warn.
2. **Two keys:** `Object.keys(localStorage).filter(k => /auth-token|lyra-teacher-auth/.test(k))`
   → exactly two auth entries.
3. **Census:** `select count(*) from students` unchanged by the whole dance — no
   teacher-owned student row ever appears.
4. Teacher tab stays signed in across student reloads; teacher sign-out leaves the
   student session untouched.

## Out of scope

Recovery screen / code-regen RPC. Enrolment. Any migration or RLS change. Student
accounts. `deriveRule` map expansion. The 1000-row cap. Any `lyra.jsx` change.

## Karpathy close

Read first. This is two small seams, one conditional, and tests — if it grows beyond
that, stop and report. Smallest diffs, commit per unit (config seam / teacher client /
switch / guard / tests / docs). Offer the land, record the shas. Repo wins, always.

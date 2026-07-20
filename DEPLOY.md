# Publishing Lyra for colleague review (Vercel)

This makes Lyra reachable from anywhere — no Wi-Fi, no laptop left on — behind a
shared password. The static app and the key-hiding proxy (`api/gemini.js`) deploy
to one Vercel URL on the same origin, so the app's `fetch("/api/gemini")` works in
production exactly like it does in dev.

## Architecture (what actually deploys)
Lyra is a **Vite** SPA (entry `src/main.jsx`) — there is no Next.js app. It is now
**Gemini-only**: ONE same-origin serverless proxy carries everything.
- **All AI → Gemini.** Coaching, X-Ray analysis, training, proofread, AND photo OCR
  go through `src/api.js` → `/api/gemini` (`api/gemini.js`, reads `GEMINI_API_KEY`).
  Photo OCR uses Gemini vision (`gemini-3-flash-preview`) via the same endpoint with
  an image part — no Anthropic/Claude dependency anymore.

## What's already wired up (in this branch)
- `api/gemini.js` — the single AI proxy, text + vision (reads `GEMINI_API_KEY`).
- `middleware.js` — a Basic-Auth password gate over the whole site **and** the API.
- `vercel.json` — Vite framework preset.
- `.env` stays gitignored; the key lives ONLY in Vercel's env vars, never in git.

## One-time deploy (GitHub path — recommended, auto-redeploys on every push)
1. Push this branch to GitHub (the remote is `adam08111/project-lyra`):
   ```
   git push -u origin main
   ```
2. Go to https://vercel.com → **Add New… → Project** → **Import** `adam08111/project-lyra`.
3. On the configure screen:
   - **Framework Preset:** Vite (auto-detected). Leave Build/Output at defaults.
   - **Root Directory:** leave as the repo root (`./`).
   - **Production Branch:** `main` (Vercel's default).
4. Add **Environment Variables** (Settings → Environment Variables), all environments:
   | Name | Required? | Value |
   |------|-----------|-------|
   | `GEMINI_API_KEY` | **Yes** — powers everything (text + photo OCR) | your Gemini key (copy from your local `.env`; never into git) |
   | `GATE_PASS` | recommended | the shared review password, e.g. `lyra-review-2026` |
   | `GATE_USER` | optional | the username colleagues type (defaults to `lyra`) |
5. **Deploy.** You'll get a URL like `https://project-lyra.vercel.app`.

Just one key — Anthropic is no longer used (photo OCR runs on Gemini vision).

## Share with colleagues
Send them: the URL + the username (`lyra`) + the `GATE_PASS` password. The browser
prompts once and remembers it. Each colleague's work is stored in **their own
browser** (localStorage), so reviews don't collide.

## Turning the gate on/off
The gate is ON whenever `GATE_PASS` is set. Remove that env var (and redeploy) to
open the site; change it to rotate the password. No code change needed.

## Supabase (P0) — durable sync (optional, flag-gated)
Lyra's learning data is local-first (localStorage stays authoritative). Supabase is a
durable, queryable mirror. It is **entirely off** until both env vars are set — with
them unset the app is byte-identical to the localStorage-only build. To turn it on:

1. **Create a Supabase project** (https://supabase.com) — region **`ap-southeast-1`**
   (Singapore). Lyra gets its **own** project, separate from anything else.
2. **Enable Anonymous sign-in** — Authentication → Providers → **Anonymous** (it is
   **off by default**). Without this, every device fails to get an `auth.uid()` and no
   student row is ever created.
3. **Apply the schema** — open the SQL editor and run the migrations **in order**
   (the in-repo single source of truth; there is no CLI step):
   1. `0001_init.sql` — tables, RLS policies, the rule-frequency view, and the
      `claim_student` RPC.
   2. `0002_profile_upsert.sql` — the server-side LWW `upsert_growth_profile` RPC.
   3. `0003_claim_search_path.sql` — fixes `claim_student` (qualifies `extensions.digest`;
      pgcrypto lives in the `extensions` schema on Supabase, so the original `search_path`
      couldn't resolve it).
   4. `0004_revoke_anon.sql` — revokes the anon role's residual table/function access
      (defence-in-depth; RLS already gated it). Zero app impact.
   5. `0005_teachers.sql` — the teacher foundation (schools/teachers/classes/enrolments +
      SELECT-only teacher-read RLS; see the Teacher-panel section below).
   6. `0006_writing_snapshots.sql` — the append-only essay-draft ledger (BRIEF-114): a
      student-owned, teacher-excluded `writing_snapshots` table so a written draft can't be
      silently destroyed. Additive; safe to apply after 0005.
   7. `0007_auth_fk_restrict.sql` — **P0 durability fix.** Flips BOTH `students.auth_user_id`
      and `teachers.auth_user_id`'s FKs from `ON DELETE CASCADE` to `ON DELETE RESTRICT`, so an
      anonymous-user auto-purge (or any `auth.users` deletion) that would destroy a student's or
      teacher's whole subtree now **fails loudly** instead of silently deleting it. Legitimate
      deletion: delete the child (`students`/`teachers`) row first — its subtree cascades by
      design — then the auth user. Apply after 0006. The anon-retention posture check remains
      worthwhile (belt-and-braces), but this removes the data-loss teeth regardless. **No orphan
      pre-cleanup needed:** the existing `CASCADE` FK already guarantees every `auth_user_id`
      points to a live `auth.users` row, so the `RESTRICT` re-add cannot fail on a dangling
      reference (the §110 "orphans" are empty-*data* rows with valid auth users, not dangling FKs).
   8. `0008_report_snapshots.sql` — the append-only growth-report ledger (BRIEF-RS): a
      student-owned, teacher-excluded `report_snapshots` table so an as-issued Continuous Growth
      Report can't be silently overwritten (the report is otherwise LWW-mutable in
      `growth_profiles`); the stream doubles as the band-estimate trajectory. Additive; safe to
      apply after 0007. Manual check: trigger a regen → one row; **each further regen appends
      another row** — this is a per-issuance archive, not content-deduplicated (every regen
      re-stamps `lastRegenAt`, so the `unique(student_id, content_hash)` key only guards against a
      reload/replay double-insert, never a distinct regen — do NOT expect a no-op second row);
      `select report->'level'->>'bandEstimate', ts from report_snapshots order by ts` shows the
      band trajectory; teacher session `select count(*) from report_snapshots` → denied.
   9. `0009_enrolment.sql` — enrolment (BRIEF-ENROL): adds `class_code` to `classes` (backfills a
      unique 6-char code, then NOT NULL + unique), a **student self-SELECT** policy on `enrolments`
      (a student can see their own membership; teachers keep their class scope), and the
      **`enrol_student(code, name)` RPC** — a SECURITY DEFINER verify-and-link with a server-side
      name sanitize (control-strip, collapse, 40-cap) and ONE non-oracle error. Grants: execute to
      `authenticated` only, revoked from public/anon. Additive; safe to apply after 0008. **How
      students enrol:** the teacher reads the class code off the Dashboard header and puts it on the
      board; each student, on her own phone, enters that code + her name in the "Join your class"
      screen after onboarding, and banks her recovery code on the success screen. Manual check:
      seed sets `DEMO-CLASS-1`; a throwaway profile → onboarding → wrong code → honest error → right
      code → confirmation → recovery code shown; re-enrol → no duplicate; a hostile name (`<img
      onerror>`) renders as literal text in the dashboard; flag-off → no overlay.
   10. `0010_regen_code.sql` — self-service recovery-code regeneration (BRIEF-112): the
       **`regenerate_recovery_code(p_new_hash)` RPC** — SECURITY DEFINER, updates the CALLER'S OWN
       row (`current_student_id()`) with a client-supplied SHA-256 hex hash (validated 64-char hex,
       stored verbatim — the server never sees the new plaintext), returns void. Grants: execute to
       `authenticated` only, revoked from public/anon; teachers stay SELECT-only (teacher-mediated
       regen landed as `0011`/§123). Additive; safe to apply after 0009. Manual check (use the
       tooling orphan or a throwaway profile, NEVER real data): open the sidebar → "Lost your phone?
       Recover your work" → **Your code** shows the device's code; **Regenerate** → confirm → a new
       code appears, and the OLD code then fails a claim while the NEW one succeeds and reloads to the
       same work; **Use a code** with a code from another device claims it; flag-off build → no
       recovery trigger, no modal.
   11. `0011_teacher_regen.sql` — teacher-mediated recovery-code regeneration (BRIEF-TR, Lyra's FIRST
       teacher WRITE): the **`teacher_regen_code(p_student_id, p_new_hash)` RPC** — SECURITY DEFINER,
       `search_path=public`, **enrolment-scoped** (updates the target row only if that student is in
       one of the CALLING teacher's classes, via `current_teacher_id()`), stores a client-supplied
       64-char hex hash verbatim (the teacher's browser mints the code; the server never sees the new
       plaintext), one non-oracle error for every authz failure. Execute granted to `authenticated`
       only, revoked public/anon; **no table grant/policy change** — teachers stay SELECT-only apart
       from this single definer write. Additive; safe to apply after 0010. Manual check (synthetic
       data ONLY): teacher sign-in → a **seed** student's detail → "Regenerate recovery code" →
       confirm → the new code shows once; the request body carries only the 64-hex hash; the new code
       claims that seed student via the §121 "Use a code" while her old code fails; a student NOT in
       the teacher's class (or a student session) → the single non-oracle error; teacher localStorage
       has no student code key afterward.
   The live project currently needs **0006 → 0007 → 0008 → 0009 → 0010 → 0011**, in order.
4. **Set the two env vars** in Vercel (Settings → Environment Variables, all
   environments) — copy from the project's API settings:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the **anon public** key (NOT `service_role`) |

   The anon key is **public by design** — its authority is Row Level Security, not
   secrecy, so it ships in the client bundle. **`service_role` must never be set here,
   committed, or bundled.** Unset both vars to disable sync entirely.
5. **Free tier pauses on inactivity.** A paused project makes sync silently no-op (the
   app is unharmed — local-first). **Move the project to Pro before any school pilot.**

**Production stays flag-OFF until the C5 staging verification passes.** Leave `VITE_SUPABASE_*`
**unset in Vercel** for now — production runs the localStorage-only build (byte-identical to today).
The Phase-2 machinery this once waited on (the old "§99") has since landed — hydration + recovery
(§121), enrolment (§118) — so the remaining gate is **C5: flag-ON via a staging/preview deploy**
(`CHECKPOINTS.md` C5), paired with Supabase **Pro** + the anonymous 30/hr-cap raise, before any
deployed human data. *(`VERIFY at A4` — no production deploy exists yet, `DATA-ARCHITECTURE.md:20-21`,
so the live flag state cannot be confirmed from the repo.)* Note these are **build-time** vars (Vite inlines `VITE_*` at build): adding
or changing them in Vercel has **no effect until you redeploy** — trigger a fresh
deployment (or push) after setting them, or the running build stays flag-off.

## CLI path (alternative)
```
npm i -g vercel
vercel            # link the project (first run)
vercel env add GEMINI_API_KEY production
vercel env add GATE_PASS production
vercel --prod
```

## Known limitation — long calls
Vercel's free (Hobby) functions cap serverless execution at a vendor-set time limit
(**`VERIFY at A4`** — this doc once assumed **60 seconds**; Vercel's current Hobby cap is vendor-set
and may be lower, so confirm the real limit at registration rather than trusting this number). Almost all coaching/chat
calls finish well under that, but a very heavy X-Ray (full analysis + thinking) or
a grounded web search can occasionally run longer and get cut off (streaming still
shows partial output first). If that becomes a problem, run the always-on Node
server instead: deploy `server/proxy.js` (no per-request cap) on Render/Railway/Fly
and point the app's `/api/gemini` at it. Ask and I'll wire that variant up.

## Security (§102 / §103) — what ships and what to know
The proxy + gate hardening from §102 and the model-behaviour red-team from §103.
See `SECURITY.md` for the full posture; the operational notes:

- **CORS origin lock (§102 F1).** `api/gemini.js` only answers same-origin POSTs (it no
  longer sends `Access-Control-Allow-Origin: *`). It derives the allowed origin from the
  request host by default; set the optional env var **`ALLOWED_ORIGIN`**
  (e.g. `https://lyra.example.com`) to pin it explicitly for a custom domain. Cross-origin
  POSTs get 403. Defence-in-depth alongside the Basic-Auth gate.
- **Rate limit (§102 F2).** `api/gemini.js` enforces a best-effort **40 requests/minute
  per identity** (keyed by the Supabase `student_id` the client forwards, else IP) before
  any billed call. It is **in-memory per warm serverless instance — NOT durable** across
  cold starts or scale-out (a floor against a runaway client, not a fortress). **Caveat:**
  with the Supabase sync flag OFF (**`VERIFY at A4`** — the *intended* default; no production deploy
exists yet, `DATA-ARCHITECTURE.md:20-21`, so it is not a confirmed live state), every user keys by IP,
  so a **class behind one NAT shares the 40/min budget**. For a multi-student pilot, turn
  the sync flag ON (per-student keying) or move to a durable KV/Supabase-backed limiter.
- **Model safety thresholds (§102 F4).** All four *settable* Gemini harm categories
  (harassment, hate speech, sexually explicit, dangerous content) are set explicitly to
  `BLOCK_MEDIUM_AND_ABOVE` in `src/safety-settings.js` (see that file for the reasoning).
  **`HARM_CATEGORY_CIVIC_INTEGRITY` is deliberately left at the model default** and NOT
  set — recorded here so F4's "no silent defaults" principle stays literally true: (a)
  Google no longer honours blocking that category on current Gemini models (setting it is a
  no-op), and (b) persuasive/argumentative essays on elections, government and public
  policy are a syllabus staple, so blocking civic content would false-positive on
  legitimate student work. Revisit if a future model makes it enforceable.
- **Security headers (§102 F6).** `X-Content-Type-Options: nosniff`, `X-Frame-Options:
  DENY`, `Referrer-Policy: no-referrer` ship on every response via `vercel.json`. A full
  Content-Security-Policy is a documented follow-up (needs `connect-src` for the Supabase
  URL).
- **Behavioural red-team (§103).** `tests/redteam/` — a reusable harness that attacks the
  shipped prompts (ghost-writing refusal, prompt exfiltration, injection, minors-safety).
  **Re-run `npm run redteam` before every pilot and release** (see `SECURITY.md`).

## Teacher panel (Phase A) — §106
A separate static entry `teacher.html` (bundle `src/teacher/`), **same origin** as the
student app and already behind the same Basic-Auth gate + security headers — no separate
deploy, no `vercel.json`/middleware change. Operator-provisioned; read-only.

1. **Apply migration `0005_teachers.sql`** in the Supabase SQL editor, after `0001`–`0004`.
   It adds `schools`/`teachers`/`classes`/`enrolments` + `current_teacher_id()` and
   SELECT-only teacher-read RLS on `learning_events` + `growth_profiles` (never `blobs`).
2. **Seed a synthetic demo class** (operator machine only — never CI, never a bundle; the
   keys come from your LOCAL env only and must never be committed). Command Prompt (cmd):
   ```
   set SUPABASE_URL=https://<proj>.supabase.co
   set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   set LYRA_SEED_CONFIRM=SYNTHETIC
   node scripts/seed-synthetic-class.mjs
   ```
   PowerShell alternate:
   ```
   $env:SUPABASE_URL="https://<proj>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"; $env:LYRA_SEED_CONFIRM="SYNTHETIC"; node scripts/seed-synthetic-class.mjs
   ```
   Refuses to run without `LYRA_SEED_CONFIRM=SYNTHETIC`; prints the demo teacher's email +
   password once; idempotent (re-run converges). **Synthetic data only — never real
   minors' data in demo or application materials.**
3. **Sign in** at `https://<your-app>/teacher.html` with the printed credentials. The
   read-only roster → per-student rule-frequency/growth view lands in §107.

## Backups — custodian #3 (offsite encrypted dump, §125 / BRIEF-115)

A nightly GitHub Actions cron (`.github/workflows/backup.yml`) dumps the DB, encrypts it with `age`
**on the runner**, and uploads it to S3-compatible storage on a **different provider** — the copy that
survives Supabase's bad day and the unpaid-invoice future. **Prerequisite: GitHub MFA is ON** and the
repo is **private** (the secrets are DB-root-equivalent). Setup:

1. **Generate the age key** and bank the identity OFFLINE (`backup/RESTORE.md` step 1); commit the
   `age1…` recipient into `backup/age-recipient.txt`. Until you do, the workflow fails at encrypt — by design.
2. **Set `PG_MAJOR`** in the workflow to your server's major version (`select version();`).
3. **Set the five Actions secrets** (Settings → Secrets and variables → Actions): `LYRA_DB_URL`
   (the Supabase **session-pooler** connection URI — GitHub runners are IPv4-only while the direct DB
   host is IPv6-only by default, and the *transaction* pooler can't `pg_dump`; verify the URI form at
   setup), `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY_ID`, `BACKUP_S3_SECRET`. Never elsewhere.
4. **`workflow_dispatch`** a first run → green → the object appears in the bucket with today's date.
5. **Run the restore drill** (`backup/RESTORE.md`) end to end — this is what makes the backup real;
   paste the row counts into the § record. Then set the **bucket lifecycle rules** (30 daily + 12
   monthly — the workflow never deletes anything) and do the break-glass check.

`auth.users` (children's pseudonymous identities) is in the backup — the retention window is a PDPO
data-retention commitment; the erasure procedure must note that erased students persist in backups
until lifecycle expiry (`backup/RESTORE.md` §0).

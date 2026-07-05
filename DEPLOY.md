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
   Existing deployments only need **0003 then 0004**.
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

**Production stays flag-OFF until §99 is verified.** Leave `VITE_SUPABASE_*` **unset in
Vercel** for now — production runs the localStorage-only build (byte-identical to today).
Only set the two vars once Phase 2 (hydration + recovery, §99) has been verified against a
staging deploy. Note these are **build-time** vars (Vite inlines `VITE_*` at build): adding
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
Vercel's free (Hobby) functions cap at **60 seconds**. Almost all coaching/chat
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
  with the Supabase sync flag OFF (the current production default), every user keys by IP,
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

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
   git push -u origin claude/jovial-kilby-124f12
   ```
2. Go to https://vercel.com → **Add New… → Project** → **Import** `adam08111/project-lyra`.
3. On the configure screen:
   - **Framework Preset:** Vite (auto-detected). Leave Build/Output at defaults.
   - **Root Directory:** leave as the repo root (`./`).
   - **Production Branch:** pick `claude/jovial-kilby-124f12` (Settings → Git, if it
     defaults to `main`).
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

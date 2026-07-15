# TASK BRIEF — Security micro-audit + minors-safety hardening (lands as §102)

> Executor: Claude Code, one session. Planning brain: Fable 5 (final session before rotation — this brief is written to be fully self-contained for ANY successor model). Builds on §95–§101 (P0 complete). This is a **security pass**, not a feature: it fixes concrete exposures on a product used by 14-year-olds, and produces a written security posture for the CIP application + school conversations.
> Several findings below were confirmed by the planner reading the proxy source directly — they are FACTS to fix, not hypotheses to investigate. Verify each is still present (code may have moved since the seed), then fix.

---

## Context

Lyra's DATA layer is hardened (five adversarial reviews, RLS proven, recovery proven). Its AI/HTTP surface has never had a security pass. This task closes the concrete exposures and writes them up. Scope discipline: **surgical fixes to real issues only** — no refactors, no feature work, no proxy behavior change beyond the security items enumerated. Every fix is small; the value is in the audit + the written posture, not lines of code.

Guiding constraint: this is a **minors' product**. "The default is probably fine" is not an acceptable answer for anything touching model safety or student-content handling — defaults get made explicit and decisions get written down, so a school DPA conversation and the CIP assessors see deliberate choices.

## Confirmed findings (planner read the source — fix these)

**F1 — CORS wildcard on the shipping proxy.** `api/gemini.js` sets `Access-Control-Allow-Origin: "*"`. Combined with D6 (the anon key ships client-side) and no per-request auth on the proxy beyond the site's Basic-Auth gate, any origin can invoke the Gemini-billed endpoint. **Fix:** restrict to the deployment origin. Read the allowed origin from an env var (e.g. `ALLOWED_ORIGIN`, falling back to same-origin / the request's own `Origin` when it matches the deployment host); reject cross-origin POSTs. Preserve the Basic-Auth gate untouched. This is defense-in-depth alongside the gate, not a replacement for it.

**F2 — No rate limiting on the shipping proxy.** `server/proxy.js` has a `RATE_LIMIT` structure; **`api/gemini.js` (the Vercel path that actually deploys) has none.** Once the `GATE_PASS` is shared with a class, any gated user can run up unbounded Gemini spend, and a single misbehaving client can exhaust quota for the whole class. **Fix:** a lightweight per-identity limit on the Vercel function — keyed by the Supabase `student_id` if the client forwards it (add it to the request from the already-known identity), else by IP as a coarse fallback. Serverless functions are stateless across invocations, so an in-memory counter is best-effort only; document that limitation and keep the limit conservative (a sensible per-minute ceiling). Full durable rate limiting (Supabase-backed or a KV store) is a noted follow-up, NOT this task — the goal here is a floor, not a fortress.

**F3 — Content in logs (§87/§88 violation, pre-existing, twice-flagged).** Two logging sites print student-derived CONTENT rather than counts/status: the `[DEBUG translate response]` line in the proxies (prints translated text on lite-tier calls) and any request log that prints message/system TEXT. Note: printing `system_len` / `msg_len` (lengths) is FINE and stays. **Fix:** remove the `[DEBUG translate response]` content print entirely; sweep both proxies for any other line that interpolates a request/response *body* and reduce to counts/status. This extends the §97 console redaction to the server side. (The §97 redaction covered `src/`; the proxies were out of that scope.)

**F4 — No explicit `safetySettings` on a minors' product.** The generation call in `api/gemini.js` builds `genConfig` as `{ maxOutputTokens }` only — no `safetySettings`, so **Gemini's defaults silently govern what a 14-year-old can be shown.** This is the highest-judgment item in the task and must NOT be left implicit. **Fix:** add an explicit `safetySettings` block to the Gemini generation config with deliberate thresholds appropriate to an educational product for minors (the harm categories Gemini exposes — harassment, hate speech, sexually explicit, dangerous content — set to a conservative block threshold). Two required cautions: (a) an English *coach* legitimately processes student essays that may quote violence, conflict, or mature themes from literature — thresholds set too aggressively will false-positive on legitimate academic work, so choose *conservative-but-not-maximal* and note the tradeoff explicitly in the § entry; (b) apply the SAME settings to the vision/OCR path (a photographed essay is still student content). Document the exact thresholds chosen and the reasoning in the § entry — this is a written-decision item, not just a code change.

## Investigate-and-report findings (verify from source; fix only if confirmed)

**F5 — XSS via model output (the prompt-injection → token-theft bridge).** Grep ALL of `src/` for `dangerouslySetInnerHTML`, `innerHTML =`, and any other raw-HTML injection of *model-generated or student-generated* strings. Session tokens live in localStorage (D3), so a single unescaped render of attacker-controlled text is an account-takeover path (injected essay content → script → token exfiltration). Report every hit with file:line and what it renders. **Fix only confirmed unescaped renders of untrusted content** (switch to text rendering or sanitize); do NOT touch escaped/React-default-rendered paths (those are already safe). If there are zero hits, STATE THAT in the § entry — "no raw-HTML rendering of untrusted content" is a strong, citable finding.

**F6 — Security headers / CSP (report + minimal add).** `middleware.js` does Basic-Auth but likely sets no security headers. Report what's present. Then add a minimal, LOW-RISK header set that won't break the SPA: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`. **A full Content-Security-Policy is NOT in scope** (it needs per-source allow-listing of Gemini/Supabase/CDN origins and careful testing to avoid breaking the app — high risk of a broken deploy in a security-sprint context); note it as a follow-up with the specific origins that would need allow-listing (`api.anthropic.com` is NOT one — Anthropic was removed; the live external origins are the Gemini endpoint via same-origin proxy, and the Supabase project URL). Verify the three headers above don't break the app in dev before landing.

**F7 — Gate hardening (report + note).** Check `middleware.js`'s credential comparison: is it a timing-safe compare or a plain `===`? For a single shared review password behind a low-traffic gate the timing-attack risk is largely theoretical, so **report it and note the one-line fix, but only apply it if trivial and clearly non-breaking.** Also confirm the gate covers the API routes as DEPLOY.md claims (not just the static site).

## Explicitly OUT OF SCOPE (do not do in this task)

The red-team *prompt* harness (that is the NEXT brief, §103 — attack prompts × routes, brain-exfiltration, injection resistance; this task hardens the HTTP/render surface, that one tests the model's behavior). Durable/distributed rate limiting. A full CSP. Auth model changes (anonymous-per-device, recovery codes — unchanged). Teacher-mediated recovery. Any migration. Any proxy behavior change beyond F1–F4. Any `lyra.jsx`/component feature change. Load testing. The bearer-code and shared-device identity questions (pilot-grade, tracked separately).

## Steps

0. **Read first.** `CLAUDE.md`; `PROGRESS-REPORT.md` tail (**tip must be §101 → this lands as §102**; else next number, say so; report the green baseline — expected 508). Read `api/gemini.js` and `server/proxy.js` IN FULL (both proxies — F1–F4 live here), `middleware.js` (F6/F7), and grep `src/` for F5. Confirm each F1–F4 finding is still present as described (report any that moved/changed).
1. **F4 first** (highest-judgment, most valuable): add explicit `safetySettings` to both the text and vision generation configs in `api/gemini.js`; mirror into `server/proxy.js` if it constructs its own config. Commit with the threshold reasoning in the message.
2. **F3:** remove content-logging (`[DEBUG translate response]` + any body-printing line) from both proxies. Commit.
3. **F1:** origin-restrict `api/gemini.js` CORS via env var, same-origin default. Commit.
4. **F2:** best-effort per-identity/IP rate limit on `api/gemini.js`, conservative ceiling, documented as non-durable. Commit.
5. **F5:** fix any confirmed unescaped untrusted-content render; else record the clean finding. Commit only if a change was made.
6. **F6:** add the three low-risk headers to `middleware.js`; verify the app still loads in dev; record the CSP follow-up with specific origins. Commit.
7. **F7:** apply the timing-safe compare only if trivial/non-breaking; else report-only.
8. **Close-out.** Append **§102** with: each finding, what was fixed vs reported vs deferred, the **exact safetySettings thresholds + the false-positive tradeoff reasoning**, the F5 result (clean or fixed), and a short **"Security posture (as of §102)"** summary block suitable for lifting into the CIP application. Suite green with count; `vite build` clean; `node --check` both proxies; push; FF-land on `origin/main`; report shas incl. the new `origin/main` sha.

## Manual verification (Adam, some post-session)

- **F4 (the one that matters):** with env set, run a normal coaching turn on an essay containing mild literary conflict/violence → confirms the thresholds don't false-positive on legitimate academic English (if it blocks, the thresholds are too aggressive — loosen and note). Then confirm the settings are actually on the request (they'll show in the proxy's outbound body).
- **F1:** a `curl` POST to `/api/gemini` with a foreign `Origin` header is rejected; the app on its own origin still works.
- **F3:** trigger a translate/lite call → the proxy log shows NO translated text (counts/status only).
- **F2:** hammer the endpoint past the ceiling from one identity → later calls throttle; a normal session is never throttled.
- **F6:** the app loads clean with the new headers (no console CSP/frame errors); `curl -I` shows the three headers.

## Karpathy close

Read both proxies and `middleware.js` in full before any edit; the grep for F5 is mandatory. Smallest diffs; commit per finding. NO refactors, NO feature changes, NO proxy behavior change beyond F1–F4, `lyra.jsx`/components untouched. Stop-and-report: a confirmed finding that can't be fixed without a behavior change beyond this scope, any header that breaks the app, safetySettings that block legitimate essay content in testing, §-tip ≠ 101, or anything contradicting this brief. Tests green with count named, both proxies `node --check` clean, build clean, push AND land on `origin/main`, report shas. The § entry's "Security posture" block is a required deliverable, not optional — it is the artifact this task exists to produce. Branch hygiene report-only.

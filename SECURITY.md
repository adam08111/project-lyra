# Lyra — security posture

Lyra is a local-first AI writing coach for **14-year-olds**. Learning data stays on the
device (localStorage); an optional, flag-gated Supabase mirror is governed by Row-Level
Security. Two hardening passes define the posture: **§102** (HTTP/render surface) and
**§103** (model behaviour). Full detail lives in `PROGRESS-REPORT.md` (§95–§103) and
`DEPLOY.md` (the "Security" section); this file is the summary + the operational rules.

## Surface hardening (§102)

- **Model safety:** all four settable Gemini harm categories (`HARASSMENT`, `HATE_SPEECH`,
  `SEXUALLY_EXPLICIT`, `DANGEROUS_CONTENT`) are set explicitly to `BLOCK_MEDIUM_AND_ABOVE`
  (`src/safety-settings.js`), gating the student's pasted text AND the coach's reply on
  every text + photo-OCR call — never the vendor default. One notch below maximum so
  mandated set-text literature is analysed, not refused; a block surfaces as an honest,
  retryable message, never a silent blank. `CIVIC_INTEGRITY` is intentionally left at
  default (no-op on current Gemini + civics essays are syllabus) — see DEPLOY.md.
- **Abuse / cost:** the Gemini-billed endpoint is same-origin-restricted (CORS) and
  per-identity rate-limited (best-effort 40/min), behind a site-wide Basic-Auth gate that
  uses a constant-time credential compare and covers the API routes.
- **Client safety:** no model- or student-generated text is rendered as raw HTML (React
  escaping; zero raw-HTML sinks audited). `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` ship on every response.
- **Privacy:** no student content and no recovery code is logged (counts/status/lengths
  only). The Supabase anon key's authority is RLS, not secrecy; `service_role` is never
  bundled.

## Behavioural red-team (§103)

`tests/redteam/` is a reusable harness that attacks the **shipped prompts** through the
real builders, via the same proxy (so §102's `SAFETY_SETTINGS` are live). It covers:

- **A — pedagogical integrity:** the coach must refuse to ghost-write the essay.
- **B — IP / prompt exfiltration:** it must not leak `LYRA_BRAIN` / `REPORT_CARD_BRAIN`.
- **C — indirect injection:** payloads embedded in the analysed reference text / training
  attempt / chat history / OCR text must be treated as content, not obeyed. **§103 found one
  confirmed failure here — the X-Ray `style_analysis` route obeyed instructions appended to
  the reference passage (C1 English, C6 Cantonese). FIXED in §105** (a data-not-instructions
  guard in `buildStyleProfilerPrompt` + delimiters at the call site via `wrapReferenceText`);
  the red-team C-class re-run confirms it (C1/C6 + marker-spoof + any-language all PASS,
  legitimate analysis unchanged).
- **E — minors-safety posture:** self-harm/abuse disclosure, bullying-help, and
  age-inappropriate requests — **advisory-only, always escalated to human review.**
- **D — learning-mirror poisoning:** a static field inventory → the sanitize-on-render
  checklist for the future teacher dashboard (see §103 in `PROGRESS-REPORT.md`).

### Required process

1. **Re-run `npm run redteam` before every pilot and every release.** A regression in
   ghost-writing refusal (A), prompt-exfil resistance (B), or injection resistance (C) is
   a **release blocker**.
2. **Class-E results always get human review** — a model-judge "PASS" is never a clearance.
3. `npm run redteam -- --dry-run` first (free); a live run needs the dev proxy on `:3001`
   and a `GEMINI_API_KEY` in `.env`. All inputs are synthetic; no real student data is used.
4. Any vulnerability the harness finds is fixed in a **separate** change (the harness finds
   and documents; it does not patch the prompts).

## Reporting

This is a pre-pilot educational project. Security concerns → the maintainer (see the repo
owner). Do not file student data or reproduction payloads containing real minors' content.

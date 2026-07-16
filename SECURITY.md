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
- **P — political neutrality (§120):** the coach must stay **apolitical** on the Hong Kong
  national-security band (the CCP, the National Security Law, HK independence / sovereignty,
  the 2019 protests, June 4, HK/PRC/Taiwan status). It refuses the **topic** — not merely
  ghost-writing — and warmly redirects, **symmetrically**: an anti- and a pro- stance get the
  identical refusal (asymmetry would be filtering, not neutrality). Ordinary DSE persuasive
  staples and craft analysis of published literature stay fully coached — **over-refusal is a
  class-P failure too**. The rule is **one shared constant** (`src/apolitical-rule.js`) embedded
  in both `LYRA_BRAIN` and `REPORT_CARD_BRAIN`. §120 commissioned this from the §119 live
  finding that the shipped coach scaffolded an NSL-critical essay and would coach an
  independence speech (only opinion questions were deflected).
- **D — learning-mirror poisoning:** a static field inventory → the sanitize-on-render
  checklist for the future teacher dashboard (see §103 in `PROGRESS-REPORT.md`).

**Apolitical posture (§120).** The intervention is the refusal itself — Lyra never logs, flags,
or surfaces to a teacher *what* a student asked; the counts-only privacy rule holds here as
everywhere (no surveillance). v1 is the example-rich brain rule + class-P verification; a
pre-classifier / topic gate is a **pre-specified fast-follow, triggered automatically by any
class-P FAIL** after this fix — a lightweight sensitive-band pre-check over student messages
**and** pasted X-Ray sources that hard-redirects independent of model judgement.

### Required process

1. **Re-run `npm run redteam` before every pilot and every release.** A regression in
   ghost-writing refusal (A), prompt-exfil resistance (B), injection resistance (C), or
   political neutrality (P) is a **release blocker**.
2. **Class-E results always get human review** — a model-judge "PASS" is never a clearance.
3. `npm run redteam -- --dry-run` first (free); a live run needs the dev proxy on `:3001`
   and a `GEMINI_API_KEY` in `.env`. All inputs are synthetic; no real student data is used.
4. Any vulnerability the harness finds is fixed in a **separate** change (the harness finds
   and documents; it does not patch the prompts).

## Teacher panel (§106 →)

§106 adds Lyra's first **privileged** surface: an operator-provisioned teacher sign-in
(`teacher.html`, email+password) that can READ enrolled students' `learning_events` +
`growth_profiles` — **never `blobs`/raw writings** — via SELECT-only RLS joined through
`enrolments → classes → teachers` on `auth.uid()` (permissive, OR'd with the existing
student policies, so student isolation is not weakened). This is the first place one
person's typed text renders inside a *different, more privileged* person's session, so
**§103's Class D sanitize-on-render checklist is the law of this surface**: every event /
profile field is treated as hostile input, escaped by React default rendering, with zero
raw-HTML sinks — the §107 dashboard consumes the checklist in full and adds a
`no dangerouslySetInnerHTML in src/teacher` guard test. Demo data is synthetic only.

**§107 dashboard (landed).** Read-only roster → per-student rule-frequency + growth report
(incl. the teacher-only `bandEstimate`, labelled an estimate). Every field renders as
default-escaped text — a characterization test injects `<img onerror>` / `<script>` /
`javascript:` into rule/label/summary/display-name and asserts no live node materializes;
the highest-risk raw field `growth_profiles.profile.studentName` is not rendered at all (the
roster display_name is shown instead). **CSV/XLSX export is deferred** (Class D item 2 —
spreadsheet formula-injection neutralization is required before any export ships). A live
red-team re-run is still required before the CIP demo (see Required process above).

**§109 session isolation (landed).** The teacher session is **storage-isolated** from the
student's anonymous session — the teacher surface uses its own Supabase client with a distinct
auth `storageKey` (`lyra-teacher-auth`), so a teacher sign-in on a shared browser can never
overwrite a student's anonymous session. Defense-in-depth: the **student sync layer refuses to
operate under any non-anonymous session** — `ensureStudent` mints/resolves a student ONLY under
a provably-anonymous session (fail-safe: anything not `is_anonymous === true` is refused), so
even a future non-anonymous identity cannot make the student boot attribute a device's data to
the wrong uid (the §97.1 clobber class).

**Teacher-mediated recovery (BRIEF-TR, §123) — Lyra's FIRST teacher WRITE.** The teacher posture is
no longer SELECT-only: it is **SELECT-only PLUS exactly one definer-mediated write** — a
recovery-code rotation, for the case a student can't self-serve recovery (§121: lost phone AND no
usable code). Her teacher regenerates her code via `teacher_regen_code(p_student_id, p_new_hash)`
(migration 0011): `SECURITY DEFINER`, `search_path=public`, **enrolment-scoped** (the target must be
enrolled in one of the CALLING teacher's classes, via `current_teacher_id()`), execute granted to
`authenticated` only, and **one non-oracle error** for every authorization failure (a caller can't
enumerate student UUIDs by error shape). It is **hash-only** — the teacher's browser mints the code
and sends only its SHA-256 hash, so the server never sees the new plaintext, which renders **once**
on screen (reused `<CodeDisplay>`) and is **never persisted on the teacher side** (never logged,
never in the teacher's localStorage — in particular never the device's own `lyra-recovery-code`
key, whose owner is the student identity). **No table UPDATE/INSERT/DELETE grant or policy is added
for teachers** — the single write lives inside the definer function; teachers still never read
`blobs`/`writing_snapshots`/`report_snapshots`. **Residual (accepted, stated):** a teacher
transiently holds a claim-capable code — inherent to teacher-mediated recovery under any design (the
adult must see the plaintext to hand it over). It is minimized (server never sees it; the UI never
persists it) and **revocable procedurally**: the student self-regenerates (§121 modal) once back in,
which retires the teacher's copy — the same reversible mechanic as the accepted classmate-shoulder-
surf residual, with an adult actor.

**Writing snapshots (BRIEF-114).** The append-only `writing_snapshots` table (essay drafts) is
**student-owned and student-read-only** (SELECT + INSERT under `current_student_id()`, no
update/delete policy or grant — the history can't be rewritten) and **teachers are excluded
entirely** — no teacher policy, no teacher grant — because it is essay content, extending the
SELECT-only, no-essays teacher posture.

**Report snapshots (BRIEF-RS, §117).** The append-only `report_snapshots` table (as-issued
growth reports, migration 0008) carries the **same posture**: student-owned, student-read-only
(SELECT + INSERT under `current_student_id()`, no update/delete), **teachers excluded** (no
policy, no grant — teachers keep reading only the current `growth_profiles` view), anon revoked.

**Enrolment (BRIEF-ENROL, §118).** The `enrol_student(code, name)` RPC (migration 0009) is
`SECURITY DEFINER` with `search_path=public`, granted to `authenticated` only (revoked from
public/anon); it links **only the calling** student (via `current_student_id()`, never a caller-
supplied id) and returns ONE non-oracle error so class codes can't be enumerated by error shape.
The display name is the **first genuinely student-controlled string** that renders in a teacher's
session — it is sanitized server-side (control-strip, whitespace-collapse, 40-char cap; the server
is the law) and rendered as an inert React text child everywhere (enrol success screen + the §107
dashboard), so Class D now covers a real threat, not a synthetic one. Students stay anonymous — the
name lives only on the `enrolments` row, never in the identity model.

**Recovery (BRIEF-112, §121).** A student who loses her device recovers her work with her recovery
code — self-service, no accounts. The `regenerate_recovery_code(p_new_hash)` RPC (migration 0010) is
`SECURITY DEFINER` with `search_path=public`, granted to `authenticated` only (revoked from
public/anon); it updates **only the calling** student's row (`current_student_id()`) and takes a
**client-computed SHA-256 hash, never the plaintext** — the new code is minted and hashed on the
device (the §95 WebCrypto path), so the server never sees it (a secret that routinely travels
degrades; §87/§88 keeps it out of every log). Regeneration is **student self-service only** —
teachers stay SELECT-only; teacher-mediated regeneration landed as Lyra's first teacher WRITE in
**§123** — see the Teacher-mediated recovery section above. Flag-off: no recovery trigger, no modal, no code path.

## Reporting

This is a pre-pilot educational project. Security concerns → the maintainer (see the repo
owner). Do not file student data or reproduction payloads containing real minors' content.

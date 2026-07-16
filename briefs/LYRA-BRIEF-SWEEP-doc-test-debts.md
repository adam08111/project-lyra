# LYRA-BRIEF-SWEEP — doc + test debt consolidation (§123–§125 post-land review findings)

**Kickoff line (the maintainer types this into a fresh Claude Code session, nothing else):**
`Execute briefs/LYRA-BRIEF-SWEEP-doc-test-debts.md. Ratified D-S1–D-S5.`
Do not begin without the ratification token. One brief = one cold session = one § entry =
one fast-forward landing on `origin/main`, landed sha recorded.

> Written 16 July 2026 against tip `0502d58` (§125, 673 green). Expect **§126**; **no
> migration, no feature**. This is a consolidation sweep: every item below is a finding
> from the planner's post-land reviews of §123 (BRIEF-TR), §124 (BRIEF-POL2), and §125
> (BRIEF-115) that did not ride those landings. Nothing here is new scope; everything here
> is closing a named debt. The touched set is docs + tests + two surgical prompt/CI lines.

---

## 1 · Context — why a sweep

Across three landings a small debt pile accumulated: two zombie doc lines contradicting
landed work, a systematic gap in the § log's sha chain, a missing regression pin on the
single most catastrophic failure mode of teacher-mediated recovery (hash-pipeline parity),
three test-hardening gaps in the teacher-regen suite, an unprobed Lite route (structural)
whose band refusal likely renders as a silent blank panel, two operational tripwires in
the fresh backup runbook, and one unanswered question touching ratified law (did THE BAND's
text change during the §124 extraction?). Individually each is 5–30 minutes; collectively
they are drift. This brief retires the pile in one session so BRIEF-116 starts clean and
the operator's A10 restore drill runs against a corrected runbook.

## 2 · Decisions — do NOT relitigate

- **Pedagogy is law**; the ONLY prompt-adjacent edit permitted here is the D-S4 structural
  supplement, which must *reference* the apolitical boundary, never restate the band
  (the §120 surface-reinforcement precedent, exactly).
- **Single source of truth**: `APOLITICAL_BAND` stays the one band list; no copies.
- **Class-P discipline**: any class-P change is live-verified before landing (§120/§124);
  over-refusal is a class-P failure too.
- **No drive-bys**: the backup workflow's security posture (env-only secrets, no `set -x`,
  encrypt-then-rm, fail-loud, `contents: read`) is verified-good — do not "improve" it
  beyond the two named lines (D-S items 5.7–5.8).
- Process law: Karpathy discipline; FF-only with same-session approval; § = tip+1 at
  Step 0; stop-and-report on any world-state mismatch.

## 3 · New decisions this plan sets — RATIFY BEFORE EXECUTING

- **D-S1 — THE BAND's current shipped text is ratified as THE LINE, and pinned.** The
  shipped `APOLITICAL_BAND` includes two clauses the §120 log summary doesn't name (the
  *"just tell me the facts / is Hong Kong a country"* framing; *named political figures or
  parties* on band topics). Ratifying D-S1 ratifies that full current text as the law.
  Step 0 establishes provenance (diff vs the §120 feature commit `f4491f9`): if the clauses
  were added in §124, the § entry records a **labelled correction** to §124 ("the extraction
  also amended THE LINE — content ratified retroactively as D-S1"); if they were §120-original,
  the entry says so. Either way a new test pins the **full string** — future amendments to
  THE LINE must consciously edit a test whose comment says a ratified decision is required.
- **D-S2 — The final-tip rule.** Encoded in CLAUDE.md #2: *the `origin/main` sha recorded in
  a § entry is the session's FINAL tip; nothing (board ticks, close-outs, session reports)
  lands after the recorded sha — fold close-out edits into the docs/log commit.* Step 0
  reconciles the historical chain once (`git log --oneline 821835d..0502d58`), names what
  each inter-§ close-out commit contained, and the § entry records that explanation —
  closing the five-gap pattern on the record.
- **D-S3 — A degenerate review lens is a FAILED lens.** Encoded in CLAUDE.md #5: a lens
  returning empty/placeholder output is re-run at high effort and its journal read before
  the review counts as clean (the §121/§123/§124 recurring flake, now a rule instead of
  vigilance).
- **D-S4 — Refusal visibility is part of the refusal.** The Lite-route band refusal must be
  *visible* to the student on all three routes. Structural gets the smallest-diff fix so its
  warm line has somewhere to render (call-site supplement referencing the boundary, per the
  §120 precedent; if making the line visible requires >10 lines of `src/` change,
  **stop-and-report** instead of expanding scope). Class P gains **P18** (structural band
  probe) and keeps P17's over-refusal control green.
- **D-S5 — Hash-pipeline parity is test-pinned.** One unmocked test proves the teacher
  pipeline (`src/teacher/regen.js`) and the student pipeline (`src/recovery/recovery.js`
  `regenerate()`) produce the identical 64-hex for the same code, using real WebCrypto,
  plus one known-vector assertion pinning the `upper(trim(code))` server contract. A future
  refactor that breaks parity must now break a test instead of a real child's handed-over
  recovery code.

## 4 · Steps

### Step 0 — verify the world (stop-and-report on ANY mismatch)

1. `git fetch`; worktree = `origin/main`; record the inherited tip. Expect `0502d58`
   (§125) or a later tip whose § entries touch none of: `SECURITY.md`, `DEPLOY.md`,
   `backup/`, `.github/workflows/backup.yml`, `CLAUDE.md`, `src/apolitical-rule.js`,
   `src/prompts.js`, `tests/` (teacher-regen / apolitical / redteam). Otherwise stop.
2. Confirm THIS file exists at `briefs/LYRA-BRIEF-SWEEP-doc-test-debts.md` (standing rule).
3. **Chain reconcile (D-S2):** `git log --oneline 821835d..0502d58`; map every commit to its
   § entry; name the contents of each inter-§ close-out commit (`f42675b`, `da9b282`,
   `226e2bb`, `ffd57ac`, `fbbfc82` are the expected orphans). Record for the § entry.
4. **Band provenance (D-S1):** `git show f4491f9:src/apolitical-rule.js` → diff the band
   text against HEAD; record verbatim-vs-amended.
5. Read the current: `SECURITY.md` (§121 Recovery paragraph), `DEPLOY.md` (line ~113 zombie;
   Backups section), `backup/RESTORE.md`, `backup/README.md`, `backup.yml`, `CLAUDE.md`
   #2/#5, `tests/…/teacher-regen.test.js`, `src/teacher/regen.js` + `src/recovery/recovery.js`
   (record each one's exact mint→normalize→hash call sequence), `buildStructuralPrompt`'s
   **full JSON output schema** + the structural panel's **render path** (which fields render
   when the suggestion array is empty), the proofread panel's render of `strengths`/`nextFocus`
   with empty arrays, and the 繁中 message-translate toggle's call site (assistant bubbles
   only, or student bubbles too?).
6. Confirm the vitest environment exposes real `crypto.subtle` (Node ≥ 19 / happy-dom);
   if not, plan the test on `node:crypto`'s `webcrypto` import.
7. Preflight: 673 green at the inherited tip; `vite build` clean.

### Step 1 — doc batch (one commit)

1. `SECURITY.md` §121 Recovery paragraph, final sentence → "…teacher-mediated regeneration
   landed as Lyra's first teacher WRITE in **§123** — see the Teacher-mediated recovery
   section above."
2. `DEPLOY.md` 0010 entry parenthetical → "(teacher-mediated regen landed as `0011`/§123)".
3. `backup/RESTORE.md` step 2d, BEFORE the restores, add:
   `psql -d lyra_restore_test -c "create role anon nologin; create role authenticated nologin; create role service_role nologin;"`
   with one comment line: *policies restore as `CREATE POLICY … TO <role>`; `--no-privileges`
   skips grants, not policies — a plain scratch Postgres needs the three roles or the drill
   fails its own "runs clean" criterion.*
4. `backup/RESTORE.md` §3 query: add `blobs`, `growth_profiles`, `classes`, `teachers`,
   `schools` union lines (blobs and growth_profiles are the point of the custodian).
5. `backup.yml` secrets comment + `DEPLOY.md` Backups section, one line each: **use the
   Supabase SESSION-pooler connection URI for `LYRA_DB_URL`** — GitHub-hosted runners have
   no IPv6 and the direct DB host is IPv6-only by default; the transaction pooler does not
   support `pg_dump`. Phrase as "verify the URI form at setup" (provider networking shifts).
6. `backup/README.md`: GitHub auto-disables scheduled workflows after ~60 days of repo
   inactivity — a disabled cron sends no failure emails; the disable-warning email is an
   action item (re-enable in the Actions tab).
7. `backup.yml`: pin `actions/checkout` to a full commit SHA (keep `# v4.x.x` comment) —
   this workflow holds DB-root-equivalent secrets.
8. `CLAUDE.md` #2: append the D-S2 final-tip rule verbatim.
9. `CLAUDE.md` #5: append the D-S3 failed-lens rule verbatim.

### Step 2 — test batch (one commit)

1. **Parity (D-S5)** — new unmocked test: compose each side's exact recorded pipeline
   (Step 0.5) over the same generated code → identical 64-char lowercase hex; plus the
   known-vector pin (compute the SHA-256 of the uppercased-trimmed sample once, hardcode
   with a comment naming the server contract `encode(digest(upper(trim(code)),'sha256'),'hex')`).
2. **teacher-regen.test.js hardenings (F5):** broaden the no-log spy over
   `log/info/warn/error/debug`; strengthen storage to `setItem` **never called** (local
   AND session storage — `lyra-fork-pending` in particular must stay untouched); comment-tie
   the hardcoded `'lyra-recovery-code'` to `RECOVERY_CODE_KEY`.
3. **Band pin (D-S1):** in the apolitical test file, pin `APOLITICAL_BAND` full-string,
   comment: *THE LINE is ratified law — editing this string requires a ratified decision
   and a § entry.*

### Step 3 — structural visibility + P18 (one commit)

1. Per Step 0.5's schema/renderer read: smallest-diff change so a band-subject draft
   through **structural** yields the warm neutral line visibly (preferred: a call-site
   supplement in `buildStructuralPrompt` directing the note into a field the panel already
   renders; the supplement *references* "the apolitical guard above", never restates the
   band). Same verification for proofread (`strengths`/`nextFocus` render on empty arrays)
   and translate (EN/ZH pair — expected native). Stop-and-report if >10 `src/` lines needed.
2. Message-translate call site: if the 繁中 toggle is assistant-bubbles-only, record the
   `file:line` in the § entry and change nothing; if student bubbles carry it, prepend
   `POLISH_BAND_GUARD` to `buildMessageTranslatePrompt` and say so.
3. Harness: add **P18** (band draft through the real structural route → refuse, note
   present, empty suggestions). Live run: `npm run redteam` (proxy on `:3001`) — class P
   **19/19 expected**, P17 still PASS-as-coached, A/B/C/E regression clean, non-advisory
   FAILs 0. A class-P FAIL triggers the pre-specified D-Q5 fast-follow flag — report it,
   do not build it.

### Step 4 — review + landing

Right-sized review, one adversarial pass: scope discipline (nothing beyond the named
items), the two CLAUDE.md rules actually encoded where claimed, the structural supplement
references-not-restates, no secret/plaintext regression in `backup.yml`. Apply D-S3 to this
review itself. Then: full suite green (expect ~677–679: parity + band-pin + hardenings) +
`vite build` clean → § entry (chain explanation, band provenance, render-path findings,
live class-P numbers, both shas) → CHECKPOINTS: add a ticked sweep row + strike the
retired ledger items → FF-land, docs/log commit is the FINAL tip (D-S2 applies to this
very landing, first).

## 5 · Manual verification (OPERATOR — 3 minutes at the next dev sitting)

Dev proxy on `:3001`, throwaway profile: one band-subject draft through **Proofread**,
**Structural**, and **Translate** panels → the warm line is *visible* in each, no blank
panel, no corrections/suggestions/translation produced; one benign smartphone draft through
Proofread → corrected normally. (Rides alongside A9/A10; needs no migrations.)

## 6 · Out of scope — name it, don't do it

The restore drill itself (operator, A10); BRIEF-116; the D-Q5 pre-classifier (report-only
trigger); any backup-workflow redesign; any brain/prompt edit beyond the D-S4 supplement;
HANDOFF §4/§8 (A8, operator); the erasure procedure (Lane D — though note in the § entry
that §125's retention commitment raised its priority).

## 7 · Karpathy close

This brief is deliberately a broom: many tiny diffs, each surgical, each traceable to a
named review finding — resist every temptation to widen one. Read before editing; commit
per batch; the planner's line numbers and mechanism claims are hypotheses that Step 0
re-verifies; stop-and-report beats improvising. Land fast-forward, record the FINAL tip,
and leave the ledger empty.

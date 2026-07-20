# LYRA-BRIEF-OPS — ops papers + doc debts + record hygiene (the executor's share of the remaining board)

**Kickoff line (fresh Claude Code session, nothing else):**
`Execute briefs/LYRA-BRIEF-OPS-papers.md. Ratified D-K1–K5.`
One brief = one cold session = one § entry = one FF landing; the docs/log commit is the
**FINAL tip** (CLAUDE.md #2). Do not begin without the ratification token.

> Written 17 July 2026 against §128 (701 green). Expect **§129**; **no migration, no AI
> call, no prompt contact, and NO PRODUCT CODE — this brief ships only documents and
> board/log edits.** `git diff --stat` at review time must show zero `src/` changes.
> Everything here is the executor-doable share of the open board; the console work
> (A4/A9/A10/C5), the CIP lane, and every signature stay with the operator by design.

---

## 1 · Context

Lane C is drained and the remaining board is operator-heavy — but three Lane-D ops papers
(DATA-MAP, the erasure procedure, the incident runbook), the A8 rewrite, the parked doc
debts, and four small record-hygiene items are repo work an executor does better than a
tired operator: they are documents whose every claim should be derived from the code and
the § log, with anything underivable tagged for live verification instead of asserted.
Two of the papers stopped being optional recently: §125's bucket retention made the
**erasure procedure load-bearing** (an erased student persists in backups until lifecycle
expiry — that commitment must be written down before any real data exists), and a pilot
in a school needs the **incident runbook** to exist before the incident does.

## 2 · Decisions — do NOT relitigate

- **Docs only.** No `src/`, no `api/`, no `tests/` product changes; no prompts, no
  migrations. (Board/log/docs + creating `docs/` files is the entire diff.)
- **No new factual claims.** Every statement in the new papers traces to code, a
  migration, the § log, DEPLOY/SECURITY/DATA-ARCHITECTURE, or is explicitly tagged
  `VERIFY at A4/A9/A10` — a runbook that guesses is worse than none.
- **Counts-only privacy** everywhere, including inside the erasure log format itself.
  No real student references anywhere; the protected student is never named beyond the
  existing redacted ids already in the log.
- Process law: Karpathy; FF-only + same-session approval + FINAL-TIP + D-S3;
  § = tip+1 at Step 0; stop-and-report beats improvising.

## 3 · New decisions — RATIFY BEFORE EXECUTING

- **D-K1 — Erasure procedure defaults (the policy spine; the paper elaborates, never
  contradicts).** Request path: parent/guardian or the student via her **teacher**, to the
  **operator** — one accountable human executes. Verification: the teacher confirms the
  enrolment link (roster identity), or device-in-hand; **possession of a recovery code
  alone is never sufficient** (a shoulder-surfed code must not become an erasure weapon).
  Execution order: student-side device clear (instructions page) → the §115 explicit
  path (the `students` row → subtree cascades by design → then the auth user) → done.
  Backups: **not purged** — they expire by the §125 lifecycle (30 daily / 12 monthly),
  and the procedure says this to the requester in plain language (the pre-ratified
  retention commitment). SLA: within **7 days** of a verified request. Record: one dated
  line in an erasure log — counts and dates only, zero personal data.
- **D-K2 — DATA-MAP.md.** One table of every store: localStorage keys (by name, from
  code) · Supabase tables (from migrations 0001–0011) · the backup bucket · what each
  holds, who can read it (RLS posture), retention, and the erasure touchpoint. Vercel
  logging posture and Gemini transit are stated from DEPLOY/SECURITY plus the ToS note,
  with deploy-dependent facts tagged `VERIFY at A4`.
- **D-K3 — Incident runbook.** Operator-facing, checklist-style, five named scenarios:
  Supabase outage (local-first degradation statement — what students actually experience);
  student data loss (the "restore student blobs" paragraph: custodian #2 PITR, else
  custodian #3 via `backup/RESTORE.md`); credential leak (rotation order:
  `GATE_PASS` → `GEMINI_API_KEY` → S3 keys → `LYRA_DB_URL` → the anon key posture note);
  wrong-identity attribution (the §109/§97.1 diagnosis path + the D8 interstitial);
  a political/press question about the apolitical rule (the counts-only, no-surveillance,
  symmetric-refusal statements, quotable). Each scenario ends with "what to tell the
  school" in two sentences.
- **D-K4 — The A8 rewrite + freshness pass.** HANDOFF §4/§8 **rewritten** (not appended)
  to §128-state. DEPLOY freshness ghosts: repo-resolvable ones fixed ("flag-OFF until
  §99" → the current staging-gated posture; "current production default" → stated
  against C5); deploy-dependent ones (the Hobby 60s cap) converted from claims into
  explicit `A4 checklist` tags. CLAUDE.md: the stale persistence line updated
  (localStorage + the flag-gated Supabase mirror) and the DEEPER DOCS list gains
  DATA-ARCHITECTURE.md, DATA-MAP.md, the runbook, and the erasure procedure.
- **D-K5 — Record hygiene.** (1) A labelled correction appended to **§127**
  ("CORRECTION (§128): enrichment pages to 25,000 rows, not 1,000; notice added") and
  the C4 board row's "1000 rows" fixed. (2) The **§128 cold-session question**: Step 0
  asks the maintainer directly via elicitation — did PRV run in the 116 session or cold?
  — and appends the labelled one-line answer to §128; if the maintainer prefers warm
  sessions for micro-briefs, record THAT as a ratified rule amendment instead. (3) The
  **allowlist-projection** line added to Lane D Phase B ("export composer → allowlist
  projection before any new teacher-only field lands"). (4) **A7 prepared as a
  drop-slot**: create `docs/decisions/` with a one-paragraph README naming the two
  materials the maintainer will drop (the identity-conversation transcript; the
  refreshed PLANNER-HANDOFF, which the planner writes) so A7 becomes drop + commit.

## 4 · Steps

**Step 0 — verify the world.** Inherited tip = §128's docs/log commit **exactly**
(FINAL-TIP check #3; anything after = stop-and-report). Confirm this file in `briefs/`.
Run the D-K5(2) elicitation FIRST (the answer lands in this landing). Read the sources:
migrations 0001–0011, the storage modules (key names for DATA-MAP), DEPLOY/SECURITY/
DATA-ARCHITECTURE, HANDOFF §4/§8, CLAUDE.md, the §115/§119/§125/§127/§128 entries,
`backup/RESTORE.md`. Preflight 701 green, build clean (and again at the end — docs
can't break it, prove it anyway).

**Step 1 — the three papers** (one commit each): `docs/ERASURE.md` (D-K1),
`docs/DATA-MAP.md` (D-K2), `docs/INCIDENT-RUNBOOK.md` (D-K3). Checklist formatting is
correct for the runbook; the other two stay prose+table.

**Step 2 — D-K4 freshness batch** (one commit): HANDOFF §4/§8, DEPLOY, CLAUDE.md.

**Step 3 — D-K5 hygiene batch** (one commit): the §127 correction + C4 row, the §128
line per the elicitation answer, the Phase-B allowlist line, `docs/decisions/README.md`.

**Step 4 — docs/log:** § entry (Step-0 findings, the elicitation answer verbatim, what
each paper derives from, every `VERIFY at` tag listed), CHECKPOINTS (tick A8; tick the
three ops-paper bullets in Lane D's list; C-row for OPS; A7 re-described as the
drop-slot). Docs/log commit = FINAL tip.

**Step 5 — review (D-S3 applies).** Lens 1 — **traceability**: sample every third claim
in each paper back to its source (`file:line` / § / migration) or its `VERIFY` tag; a
claim with neither is a finding. Lens 2 — **privacy**: no personal data anywhere,
erasure-log format is counts-only, the protected student appears nowhere new. Lens 3 —
**scope**: `git diff --stat` shows docs/board/log ONLY; zero `src/` lines; no drive-bys.

## 5 · Manual verification (OPERATOR — reading, not clicking)

You are the policy owner of the three papers: read ERASURE.md end-to-end and confirm the
D-K1 spine survived elaboration (the 7-day SLA, the teacher-verification rule, the
backup-expiry honesty are yours to own before any parent reads them); skim DATA-MAP for
anything that surprises you (surprise = finding); confirm the runbook's "what to tell
the school" lines sound like you. Then A7: drop the transcript + the refreshed
PLANNER-HANDOFF into `docs/decisions/` and commit — one commit, one § line, as specced.

## 6 · Out of scope

All console work (A4, A9, A10, C5 staging, bucket, SQL editor); Lane B entirely (B1–B4
are the operator's and the planner's); the allowlist-projection CODE (board line only);
any product code; D-Q5; the PLANNER-HANDOFF content itself (the planner writes it — the
executor only prepares its landing slot).

## 7 · Karpathy close

Documents are the product here, so the discipline inverts: the smallest diff is the one
with the fewest *unverified sentences*. Derive, tag, or delete — never assert. Land FF;
docs/log commit is the final tip; leave the operator a board where everything left
genuinely requires being Adam.

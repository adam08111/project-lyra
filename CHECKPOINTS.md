# CHECKPOINTS.md — the pending-work board (living; tick and date items here)

> **What this is.** The single operational list of everything not yet done, across all
> lanes. `DATA-ARCHITECTURE.md` stays the architecture law; `HANDOFF.md` stays the
> front door; the § log stays the history — on conflict, the log wins. This board is
> the *tactical* truth: tick items with a date; move nothing off silently.
> Last full sync: **17 July 2026 (§128) — BRIEF-PRV: the §126 proofread-visibility deferral closed (`strengths`/`nextFocus` now render, a band refusal's warm line visible + leading), a 25k truncation notice added to the take-home export, and the backup-credential audit verified SAFE (the recovery code was never in the "Backup (.json)" file); 701 green. Prior: §127 take-home export (custodian #4) landed; §126 doc+test sweep; migrations 0006–0009 live + 0010/0011 authored (operator-apply pending, A9); custodian #3 offsite-backup artifacts landed (restore-drill pending, A10).**
> Recently closed for orientation: §116 red-team capture · §117 report snapshots ·
> §118 enrolment · §119 the live sitting · §120 the apolitical rule. Four migrations
> (`0006–0009`) **applied + verified live (§119)**.

---

## LANE A — Operator, this week (Adam; nothing here is blocked on anyone)

- [x] **A1 · THE SITTING** — **DONE 2026-07-14 (§119):** 0006→0009 applied in order;
      §112 ledger, §115 crash-test (23503 witnessed + orphan cleaned), §117 regen,
      §118 phone enrol all live-verified. **Carried:** the training-chat hydration console
      check (R5, owed §101.1) was the ONE sub-item not run — carries forward. (Original spec:)
      (one session, ~30 min, SQL editor + two browser profiles;
      gates everything DB-side):
      apply `0006 → 0007 → 0008 → 0009` in order →
      §112 snapshot checks (proofread→row · edit→row · no-edit→dedup ·
      delete→tombstone · teacher denied · flag-off zero) →
      §115 crash-test (`delete from auth.users …` on the `c09dcf1e` auth id →
      **witness the `23503` error** → then the explicit path: students row → auth
      user → orphan cleaned) →
      §117 regen trajectory (regen → row; regen again → **another row — per-issuance,
      NOT a dedup no-op**; the band-trajectory SELECT; teacher denied) →
      the training-chat hydration console check (owed since §101.1 — 30 s) →
      §118 phone-in-hand enrol flow (wrong code → honest error → right code + name →
      class confirmed → **recovery code on screen** → roster shows you → re-enrol
      no-dup → hostile name renders inert) — *this is the pilot's first minute,
      rehearsed*.
- [x] **A2 · Live red-team re-run** — **DONE 2026-07-14 (§119):** 30 cases, 0 non-advisory
      FAILs; max reply 4369; all 4 Class-E replies <2000 (judge saw them in full). Caveat
      narrows to 9 A/C tails >2000 to skim. (`npm run redteam`, proxy on :3001; regenerated
      `last-run.json`; recorded max reply length — the human-skim asterisk stays for >2000.)
- [x] **A3 · The class-E read** — **DONE 2026-07-14 (§119):** four full transcripts read;
      Adam's verdict verbatim "E1-4 ACCEPTED"; §110.1 closed, CIP integrity gate cleared
      (a model verdict never substitutes).
- [ ] **A4 · Vercel** — register (GitHub sign-in, **MFA at signup**), import repo,
      `GEMINI_API_KEY` + `GATE_PASS` only (flag-OFF), deploy, phone test, the two
      §102 spot-checks (headers present; fresh browser challenged). `/teacher.html`
      showing not-configured is CORRECT. Hobby while synthetic; **Pro before any real
      human types** (model-training ToS).
- [x] **A5 · Two zombie line-edits** — **DONE 2026-07-14 (§119):** both applied — HANDOFF
      line 62 → "The harness now saves them in full (§116) — regenerate with a live run,
      then read." · DEPLOY "only need 0003 then 0004" → "the live project currently needs
      0006 → 0007 → 0008 → 0009, in order."
- [x] **A6 · Retention-posture check** — **DONE 2026-07-14 (§119):** anon sign-in limit is
      30/hr/IP (Supabase default); NO anon auto-cleanup setting exists → the §115 "summer-purge"
      threat isn't active, so RESTRICT is defense-in-depth. Pilot-gate **F-R6:** raise the
      30/hr/IP cap (Pro) before a pilot (a class of ~40 behind one NAT trips it).
- [ ] **A7 · Successor-package commit:** the identity-conversation transcript into
      `docs/decisions/` · confirm every brief canonical is in `briefs/` ·
      refreshed `PLANNER-HANDOFF.md` · this board. One commit, one §-line.
- [x] **A8 · HANDOFF §4/§8 rewrite** — **DONE 2026-07-20 (§129):** §4 (current state) +
      §8 (not-proven) rewritten to §128-state, not appended; the stale cross-refs folded in
      for coherence (§3 "through §110" → §128 + `CHECKPOINTS.md` added to the reading list,
      §5 "apply 0006+0007 next" → the §119-lived board pointer, §6 reserve stack → Lane-C-drained,
      §7's mocked-count anchor 589 → 701, the footer's §119–§128 refresh line); §1/§2 untouched.
      Independent fact-check: **22/22 claims CONFIRMED, 0 contradictions**; 701 green; doc-only.
      (Original spec:) at next refresh (they were frozen at §115-state; rewrite, don't append).
- [ ] **A9 · Apply the new migrations live** — `0010` (recovery, §121) then `0011`
      (teacher-regen, §123), **in order**, in the SQL editor, then the BRIEF-112 + BRIEF-TR
      manual checks (DEPLOY §3; synthetic data only, never the real protected student).
      Gates the student-recovery + teacher-regen flows going live.
- [ ] **A10 · Stand up custodian #3 (offsite backup, §125)** — GitHub MFA on + private repo;
      generate the age key (bank the identity OFFLINE, commit the `age1…` recipient); set `PG_MAJOR`
      + the five Actions secrets; `workflow_dispatch` a first run; **run the restore drill
      (`backup/RESTORE.md`) — paste the row counts into the § record** (this is what makes C3 DONE);
      set the bucket lifecycle rules (30 daily + 12 monthly); break-glass check. Full runbook: DEPLOY.md.

## LANE B — Operator, CIP critical path (deadline **3 Aug**; results ~Oct)

- [ ] **B1 · Incorporation** — longest lead; the 30-day post-deadline grace (verify on
      current Guides & Notes) makes 3 Aug a *filing* deadline.
- [ ] **B2 · LOIs, 1–3 headmasters** — plus the three intel questions: own phones for
      homework? in-class phone policy? identity stack (Google/MS/eClass)?
- [ ] **B3 · Skeleton TODO facts** — pricing band, pipeline schools, monthly
      financials, founder bio → then section-by-section drafting with the planner
      against the evidence ledger. Demo hygiene: witness row deleted before any
      screenshot; synthetic data only.
- [ ] **B4 · PDPO consent framework — START now** (legal lead time; gates Identity v2
      mid-pilot; not gating anything sooner).

## LANE C — Claude Code queue (one brief = one session; § and migration numbers
assigned at Step 0; every kickoff = "Execute `briefs/<file>`. Ratified <D-numbers>."
**All of Lane C queues BEHIND A1** — no further code lands until reality votes.
**A1 landed §119 (2026-07-14) — reality voted; Lane C is unblocked.**)

- [x] **C0 · BRIEF-POL — the apolitical rule** — **DONE 2026-07-14 (§120):** one shared
      `apolitical-rule.js` constant in both brains (HK national-security band, symmetric
      refusal, published-literature analysed, over-refusal guarded); red-team **class P**
      (15 cases) live-verified **15/15**, A/B/C/E regression clean, 642 product tests. The
      D-Q5 pre-classifier is the pre-specified fast-follow (auto-triggered by any class-P
      FAIL). Was top of Lane C, ahead of BRIEF-112; pre-pilot + pre-CIP BLOCKER — cleared.
- [x] **C1 · BRIEF-112 — recovery surface** — **DONE 2026-07-15 (§121):** migration `0010`
      (`regenerate_recovery_code`, hash-only) + `src/recovery/` lib + RecoveryModal (Your code /
      Use a code / D8 fork interstitial) + Sidebar trigger; D-G1–G5 ratified; 659 green. Teacher-
      mediated regen (D-G1 deferral) → **BRIEF-TR**, next in Lane C. Operator: apply `0010`.
- [x] **C2 · BRIEF-TR — teacher-mediated regen** — **DONE 2026-07-16 (§123):** Lyra's first
      teacher WRITE. Migration `0011` (`teacher_regen_code`, enrolment-scoped, hash-only, one
      non-oracle error, NO table grant) + `src/teacher/{regen.js,RegenControl.jsx}`; D-M1–M5
      ratified; the cross-surface/identity-interplay lens **institutionalized in CLAUDE.md #5**;
      3-lens review clean; 669 green. **Operator: apply `0011` (after `0010`).**
- [~] **C3 · BRIEF-115 — offsite encrypted dump** — **ARTIFACTS LANDED §125 (2026-07-16):** the
      GitHub Actions workflow (`.github/workflows/backup.yml`), the `backup/` folder (RESTORE drill +
      README + age-recipient placeholder), and the docs. D-N1–N5 ratified. **NOT done until the
      operator's restore drill (D-N4) passes** — OPERATOR owes: GitHub MFA on + private repo; generate
      the age key (bank the identity offline, commit the recipient); set `PG_MAJOR` + the five secrets;
      first `workflow_dispatch` run; the restore drill (paste row counts into the § record); the
      bucket lifecycle rules + the break-glass check. Tracked as **A10** in Lane A.
- [x] **C4 · BRIEF-116 — take-home export** — **DONE 2026-07-17 (§127):** one self-contained
      `.html` (custodian #4) — writing + learning history + growth report (`bandEstimate` stripped)
      + a `</script>`-safe JSON island; own-RLS snapshot enrichment when sync is on (first client
      SELECT, paged to 25,000 rows — §127's "1000" was a planning-era figure, corrected §130 D-K5);
      D-O3 render-surface escaping + the D-O4 exclusion list, both
      test-asserted; Sidebar action, flag-off, never-stuck; DataExport's "Export" relabeled
      "Backup (.json)". 694 green; no prompt/migration contact. Operator: the phone download
      check (the brief §5 — iOS-Safari). **Next in Lane C: PRV** (the §126 proofread-visibility
      micro-brief, tracked in Lane D).
- [ ] **C5 · Flag-ON via staging verification** (set `VITE_*` on a preview deploy →
      redeploy → one reload check) — before any deployed human data; pairs with
      Supabase **Pro** (+ verify PITR inclusion) and the **30/hr/IP anon cap raise**.
- [x] **C6 · BRIEF-SWEEP — doc + test debt sweep** — **DONE 2026-07-16 (§126):** retired the
      §123–§125 review-finding pile — two zombie doc lines, backup-runbook tripwires
      (roles-before-restore, the row-count tables, the `checkout` SHA-pin, the session-pooler
      note, the ~60-day auto-disable warning), the **D-S2 final-tip** + **D-S3 failed-lens**
      rules (CLAUDE.md #2/#5), a hash-pipeline parity pin + F5 hardenings, the **D-S1** band-string
      pin, and the **structural** Lite route's band refusal made *visible* (note field + render,
      **+P18** → live class-P **19/19**). 677 green; no migration, no shared-constant change.
      D-S4 scope A — proofread `strengths`/`nextFocus` visibility deferred (Lane D).
- [x] **C7 · BRIEF-PRV — proofread visibility + backup-credential audit** — **DONE 2026-07-17 (§128):**
      the §126 D-S4 deferral closed — the Lite proofread's `strengths`/`nextFocus` now render ("What's
      working" / "Next focus", `ProofreadPedagogy.jsx`), so a band-refused proofread's warm line is
      visible and leads and every proofread's discarded encouragement is recovered (D-P1/D-P2). Plus a
      25k truncation notice on the take-home export (D-P5) and a regression pin that the "Backup (.json)"
      file never carries the recovery code (**D-P4: verified it never did** — DataExport serialises
      `{projects, grammarLog}` from props only). 701 green; no prompt/brain/migration contact (class P
      clean by construction). Lane C is drained until the maintainer commissions more.

## LANE D — Pilot-term and parked (named so nothing vanishes)

- [ ] Identity v2 attach flow + the **§109 guard evolution** (exact rule: anonymous
      OR the permanent owner of THIS student row) — behind B4.
- [ ] Concurrent-load run (the biggest unproven thing) · outside human review of the
      data layer · localStorage loss root-cause — pre-pilot crash-tests, operator.
- [ ] Ops papers: DATA-MAP.md · **erasure procedure** (mechanism exists per §115;
      document it) · incident runbook (incl. "restore student blobs" paragraph) ·
      verify current Safari localStorage-eviction rules + the home-screen-install
      nudge (DATA-ARCHITECTURE §7.2).
- [ ] Doc debts: CLAUDE.md stale persistence line + deeper-docs list · DEPLOY
      freshness ghosts ("flag-OFF until §99", "current production default",
      Hobby 60s-vs-10s cap — verify at deploy).
- [ ] Phase B: dashboard progression view (may deliberately open `report_snapshots`
      to teachers) · exports/charts · `deriveRule` map expansion · 25,000-row cap ·
      teacher rename · un-enrolment · code-rotation UI ·
      **export composer → allowlist-projection before any new teacher-only field lands** (D-K5).
- [ ] Post-pilot: rung-2 versioned sync · `lyra.jsx` decomposition (§104 order) ·
      graduation semantics (first cohort summer 2027) · `blob-mirror.js:53` hash
      convergence.
- [x] **Proofread refusal visibility (§126 D-S4 deferral)** — **DONE 2026-07-17 (§128 / BRIEF-PRV):**
      the Lite proofread's `strengths`/`nextFocus` now render ("What's working" / "Next focus"), so a
      band-refused *proofread*'s warm line is visible and leads (no more false "✓ No issues" clean
      bill), and the encouragement generated on every proofread is no longer discarded. See C7.

---
*Rule of the board: an item leaves only by being ticked with a date + § pointer, or
by being explicitly moved to Lane D with a name. Silent disappearance is the enemy
this file exists to kill.*

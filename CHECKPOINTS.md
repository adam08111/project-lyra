# CHECKPOINTS.md — the pending-work board (living; tick and date items here)

> **What this is.** The single operational list of everything not yet done, across all
> lanes. `DATA-ARCHITECTURE.md` stays the architecture law; `HANDOFF.md` stays the
> front door; the § log stays the history — on conflict, the log wins. This board is
> the *tactical* truth: tick items with a date; move nothing off silently.
> Last full sync: **16 July 2026 (§123) — migrations 0006–0009 applied + verified live; 0010+0011 authored (recovery + teacher-regen, operator-apply pending); the apolitical rule, recovery surface, brief canonicals, and the first teacher WRITE landed; 669 green.**
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
- [ ] **A8 · HANDOFF §4/§8 rewrite** at next refresh (they're frozen at §115-state;
      rewrite, don't append).
- [ ] **A9 · Apply the new migrations live** — `0010` (recovery, §121) then `0011`
      (teacher-regen, §123), **in order**, in the SQL editor, then the BRIEF-112 + BRIEF-TR
      manual checks (DEPLOY §3; synthetic data only, never the real protected student).
      Gates the student-recovery + teacher-regen flows going live.

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
- [ ] **C3 · BRIEF-115 — offsite encrypted dump** (no migration; GH Actions + object
      storage). Ratify D-N1–N5. Prerequisite: GitHub MFA (A4's habit, applied here).
      **Not done until the restore drill passes.**
- [ ] **C4 · BRIEF-116 — take-home export** (no migration; client-side). Ratify
      D-O1–O5. May land mid-term; completes custodian #4.
- [ ] **C5 · Flag-ON via staging verification** (set `VITE_*` on a preview deploy →
      redeploy → one reload check) — before any deployed human data; pairs with
      Supabase **Pro** (+ verify PITR inclusion) and the **30/hr/IP anon cap raise**.

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
      to teachers) · exports/charts · `deriveRule` map expansion · 1000-row cap ·
      teacher rename · un-enrolment · code-rotation UI.
- [ ] Post-pilot: rung-2 versioned sync · `lyra.jsx` decomposition (§104 order) ·
      graduation semantics (first cohort summer 2027) · `blob-mirror.js:53` hash
      convergence.

---
*Rule of the board: an item leaves only by being ticked with a date + § pointer, or
by being explicitly moved to Lane D with a name. Silent disappearance is the enemy
this file exists to kill.*

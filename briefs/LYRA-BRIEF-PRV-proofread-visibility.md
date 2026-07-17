# LYRA-BRIEF-PRV — Proofread visibility (the §126 D-S4 deferral) + the backup-credential audit

**Kickoff line (fresh Claude Code session, nothing else):**
`Execute briefs/LYRA-BRIEF-PRV-proofread-visibility.md. Ratified D-P1–P5.`
One brief = one cold session = one § entry = one FF landing; the docs/log commit is the
**FINAL tip** (CLAUDE.md #2). Do not begin without the ratification token.

> Written 17 July 2026 against §127 (694 green per the log; the board's 692 is the stale
> number — see D-P5). Expect **§128**; **no migration, no AI call, NO prompt contact** —
> the §124 guard already puts the warm line in `strengths`/`nextFocus`; this brief only
> makes those fields exist on screen. Micro-brief: two small components of work, each
> named, nothing else rides.

---

## 1 · Context

**Component 1 — the deferral.** §126 established (file-verified) that the Lite proofread
computes `strengths` and `nextFocus` but the proofread results panel renders **neither**.
Two consequences: a band-refused proofread shows three "✓ No issues" tabs — a *false clean
bill* on the highest-traffic route — and, larger, **every normal proofread discards
paid-for pedagogy**: the encouragement and next-step lines are generated on every call and
no student has ever seen one. This brief renders both fields for every proofread; the
refusal note becomes visible through the exact same path, with zero guard changes.

**Component 2 — the audit the §127 review surfaced.** `DataExport.jsx` (now "Backup
(.json)") round-trips localStorage and predates the §121 recovery surface. If it
serializes storage wholesale, then since §121 every backup file has silently carried
`lyra-recovery-code` — a **claim-capable bearer credential** inside a casually named file
kids will share, upload to Drive, or hand to a friend to "fix my Lyra". Nobody reviewed
that, because no brief touched DataExport when §121 changed what lives in storage —
regression by accretion. Step 0 answers it with a grep; D-P4 sets the default if the
answer is bad.

## 2 · Decisions — do NOT relitigate

- **No prompt/brain contact** — the §124 `POLISH_BAND_GUARD` and every builder are
  byte-untouched; class P is therefore regression-clean **by construction** (state it in
  the § entry; no live run required).
- **#9 MOBILE-FIRST + PRESERVE OVERLAYS is the law of this brief** — the render lands in
  the proofread *results* area; ghost-text alignment, highlights, keyboard/caret, and the
  §61 writing-frame must be byte-equivalent in behaviour. 430px checked.
- **§87/§88/§121** — the recovery code never travels routinely; counts-only logging.
- Never-stuck (#7); single source of truth (#3); Karpathy; FF-only + FINAL-TIP + D-S3;
  § = tip+1 at Step 0; stop-and-report beats improvising.

## 3 · New decisions — RATIFY BEFORE EXECUTING

- **D-P1 — Render the pedagogy, always.** `strengths` ("What's working") and `nextFocus`
  ("Next focus") render as plain sections/cards in the proofread results for **every**
  proofread — not refusal-only. Student-plain labels, React-default escaping, absent
  fields render nothing. This is the smallest change that both recovers the discarded
  pedagogy and makes the §124 warm line visible.
- **D-P2 — Refusal presentation leads with the note.** When every result array is empty
  AND `strengths`/`nextFocus` carry text, the panel leads with that text so the empty
  tabs read as context, not verdict. No tab redesign, no copy changes to the tabs
  themselves. If achieving D-P1+D-P2 exceeds **~25 lines** in EditorTab or touches any
  overlay/measurement/scroll code path: **stop-and-report** with options.
- **D-P3 — Verification is render-level.** Tests: both fields render with hostile text
  inert; refusal fixture (empty arrays + note) → note visible and leading; absent fields
  → no empty chrome; plus the operator's phone check (§5) finally *sees* P15's refusal
  in the real UI.
- **D-P4 — The backup must not carry the credential (default-safe).** Step 0 greps
  `DataExport.jsx`'s serialization for `RECOVERY_CODE_KEY` / wildcard `lyra-*` capture.
  **If the code is included:** exclude it from backup composition, add an exclusion test,
  and one SECURITY.md line naming the consequence — *a restored backup does not restore
  the recovery code; "Your code" / regeneration (§121) covers it* — consistent with "a
  secret that routinely travels degrades". If Import round-trip code structurally expects
  the key: stop-and-report before changing Import. **If not included:** record the
  clearing `file:line` in the § entry and change nothing.
- **D-P5 — Bookkeeping riders (this landing's docs commit).** CHECKPOINTS C4 count
  692 → **694** (log wins). Verify the §127 truncation-notice behaviour: if the 1000-row
  page cap is HIT, the export's contents line must say "most recent 1000 entries" — if
  that line/test is absent, add both here (one line + one test); if present, record
  `file:line`.

## 4 · Steps

**Step 0 — verify the world.** Inherited tip must be §127's docs/log commit **exactly**
(FINAL-TIP steady-state check #2; anything after = stop-and-report). Confirm this file in
`briefs/`. Read: the proofread results component(s) and where cards render (record
`file:line`; confirm the render area is outside overlay/measurement paths), the proofread
response parse (where `strengths`/`nextFocus` land client-side), `DataExport.jsx`
serialization (the D-P4 grep), `gather.js`'s cap behaviour (D-P5), CHECKPOINTS' C4 line.
Preflight 694 green, build clean.

**Step 1 — D-P1/D-P2 render** (one commit): sections + refusal-leads ordering; nothing
outside the results area.

**Step 2 — D-P4 outcome** (one commit if a change is needed): exclusion + test + the
SECURITY line, or the recorded clearing.

**Step 3 — tests** (with Step 1/2 or separate): the D-P3 set + D-P4 exclusion + D-P5
truncation (if added). Expect ~5–8 new; full suite green; build clean.

**Step 4 — docs/log:** § entry (Step-0 findings incl. the FINAL-TIP check and the D-P4
verdict with `file:line`), CHECKPOINTS (tick the Lane-D deferral item + C-row for PRV;
the 692→694 fix), SECURITY line if D-P4 fired. Docs/log commit = FINAL tip.

**Step 5 — review (D-S3 applies):** lens 1 — **#9 overlay/mobile**: diff-level proof the
editor surface, highlights, keyboard, writing-frame are untouched; lens 2 —
**never-stuck/render**: every proofread path (results / refusal / absent fields / error)
resolves visibly; lens 3 — **scope + credential**: no prompt bytes changed, D-P4's answer
adversarially re-verified (try to get the code into a composed backup), no drive-bys.

## 5 · Manual verification (OPERATOR — phone, dev proxy, synthetic only)

Band draft → Proofread: the warm line **visible**, leading; tabs read as context. Benign
smartphone draft → corrected normally, "What's working"/"Next focus" visible. 430px +
keyboard + highlight overlay sanity (type, proofread, tap a highlight). Backup (.json)
export → text-search the file for the device's recovery code → **absent** (or D-P4
recorded it was never there). Take-home export unaffected.

## 6 · Out of scope

Any prompt/guard/brain edit; tab redesign; teacher export; import changes beyond D-P4's
stop-and-report gate; PDF; the erasure procedure; D-Q5.

## 7 · Karpathy close

Two small components, both named — the moment either grows, stop and report. Read the
render path before believing this brief's account of it; the #9 checklist is the law of
the one file you touch. Land FF; docs/log commit is the final tip; leave the deferral
ticked and the credential question answered on the record.

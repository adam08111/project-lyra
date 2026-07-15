# BRIEF-116 — Take-home export: her record, in her hands, in formats that outlive us

> Self-contained executor brief (1–2 sessions; **no migration** — client-side only).
> Implements DATA-ARCHITECTURE §4 custodian 4: a per-student downloadable bundle —
> essays as Markdown, reports as human-readable documents, the full history as
> JSON with a readable summary. Once this file is on her machine, her record
> survives Supabase, incorporation, subscriptions, and us. Deliberately **not CSV**
> (sidesteps the deferred formula-injection class entirely).
> One structural elegance to state up front: **teacher bulk-export is impossible by
> posture** — teachers cannot read essays, so they cannot export them. The export
> is student-side only, and that is the design, not a gap. The term-end "ritual" is
> the teacher saying "everyone, download your record today."
> **Named brief:** § = tip+1 at landing.

## Context

Sources, by custody: current writings from the local store (authoritative), draft
history from `writing_snapshots` (own-RLS), current profile + as-issued report
history from `growth_profiles` / `report_snapshots` (own-RLS), learning events from
`learning_events` (own-RLS — the hydration path proves the student SELECT exists).
**Flag-off exports local-only content** — still valuable, honestly labelled inside
the bundle.

## Decisions — do NOT relitigate

- Student-side, own-data-only, via existing RLS — no new policies, no server code.
- Open formats only: `.md`, `.json`, `.txt`. No CSV/XLSX. Codes and secrets never
  in the bundle (`lyra-recovery-code` is explicitly excluded — the bundle may be
  shared with a parent or tutor; the credential must not ride along).
- CLAUDE.md in full (#9 for any UI; the mount follows the D-L5 leaf precedent if
  `lyra.jsx` must be touched at all — prefer mounting inside an existing surface).

## New decisions this brief sets — RATIFY before executing

- **D-O1 Packaging = one `.zip`, built client-side.** Dependency: **JSZip**
  (ratify the dependency — Step 0 first checks whether any zip capability already
  exists in the tree; if the maintainer prefers zero-dependency, the fallback is a
  single self-contained `.html` record + a `.json` sidecar, but the zip-of-files is
  the recommended, more durable shape).
- **D-O2 The manifest:**
  `README.txt` (what this is, whose it is by display-name-if-enrolled, the date,
  "these files are yours forever — Markdown and JSON open everywhere, no app
  required", and the flag-off honesty line when applicable) ·
  `writings/<slug>.md` (title + latest content, one file per writing) ·
  `history/writing_snapshots.json` (the full draft ledger, verbatim rows) ·
  `reports/report-<date>.md` (each as-issued report rendered human-readable from
  the `report_snapshots` JSON — a small template over the `report-card-brain.js`
  schema: level + band estimate labelled as an estimate, strengths, the weakness
  lifecycle, in student-facing language per CLAUDE.md #4) ·
  `reports/report_snapshots.json` ·
  `learning/events.json` + `learning/summary.md` (counts by named rule — the
  record card a future teacher or tutor can read in one minute).
- **D-O3 Filename safety.** Writing titles are student-typed → **hostile in
  filenames**: slugify to `[a-z0-9-]`, cap 60 chars, dedupe with suffixes, never a
  path separator or leading dot — the zip must be inert on every OS (no zip-slip,
  no device-name collisions).
- **D-O4 The trigger.** A "Download my record" action mounted in the same low-risk
  surface family as BRIEF-112/ENROL chose (Step 0 confirms the landed mount point
  and reuses it; a new `lyra.jsx` leaf only if none exists, D-L5-bounded). Progress
  + honest failure states; large-bundle guard (warn past ~20MB, proceed on
  confirm); never-stuck.
- **D-O5 Size + privacy rails.** Remote fetches are own-RLS reads, chunked
  (respect the 1000-row PostgREST bound — page by `ts`); nothing fetched is ever
  logged (counts only); the recovery code is asserted absent from the bundle by a
  test.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md` §4, § tip; the local writings store shape (the §112 parse);
the student-SELECT reality on all four remote sources (policies as landed); the
`report-card-brain.js` schema for the D-O2 renderer; BRIEF-112/ENROL's landed
mount point; the dependency tree for D-O1.

**Step 1 — `src/export/`**: pure builders first — `manifest.js` (gathers sources,
flag-aware), `render-report-md.js`, `slug.js` — then the zip assembly and the
download trigger.

**Step 2 — UI** per D-O4.

**Step 3 — tests (the builders are pure — test them hard).** Manifest completeness
per source, flag-off local-only path with the honesty line, the report renderer
against a fixture profile (incl. band labelled as estimate; no scaffolding tokens),
**slug hostility** (`../../evil`, `<img onerror>`, 200-char titles, duplicates →
all inert), pagination past 1000 rows, recovery-code-absent assertion, no content
in logs, never-stuck failure paths. Suite: baseline + new, green.

**Step 4 — docs + landing.** DEPLOY.md two lines; `DATA-ARCHITECTURE.md` §4
custodian 4 status flip; CHECKPOINTS C4; SECURITY.md one sentence (own-data-only,
open formats, credential excluded by test); § entry; land per CLAUDE.md #2.

## Manual verification (Adam — phone + laptop)

1. As your enrolled dev student: Download → open the zip on a machine with no Lyra
   anywhere → every `.md` opens in Notepad; the report reads like a report card;
   `summary.md` names real rules.
2. Search the extracted bundle for your recovery code → **absent**.
3. Flag-off build → the bundle contains writings + the honesty line, no remote
   sections.
4. A hostile-titled writing → its file lands as an inert slug.

## Out of scope

Teacher/bulk export (impossible by posture — stated, not deferred). CSV/XLSX.
Scheduled/automatic export. Import/restore-from-bundle. Any server code or policy.

## Karpathy close

Pure builders, one zip, one button. The README.txt sentence — "these files are
yours forever" — is the product promise this whole architecture exists to make
true; the bundle must deserve it. Land FF with approval; record the shas. Repo
wins, always.

---
## PRE-RATIFIED AMENDMENTS (planner audit, 12 July — fold these at Step 0; the fifth D-number becomes D-O6)
1. **D-O1 gains "lazy-loaded":** JSZip arrives via dynamic import only when the export
   button is pressed — zero cost to the 430px student bundle.
2. **NEW D-O6 — the exclusion made explicit:** Style Lab state and training-chat
   history are NOT in the v1 bundle (bulky, coach-heavy; revisit at graduation export).
   The bundle README says so in one honest line — the omission is defensible, the
   silence is not.
3. **Teacher-export nuance (one sentence):** teachers cannot export essays, drafts, or
   report history — true by posture; they CAN read events and current profiles, so a
   teacher-side rule-frequency export remains a deferred Phase-B decision, not an
   impossibility.
4. **Non-Latin titles:** HK students title writings in Chinese; when the slug empties,
   fall back to `writing-<n>` (the real title survives inside the `.md`). Add a UTF-8
   round-trip test for 繁中 essay content — the bundle's promise is that it opens
   correctly forever.
5. **Manual verification gains the phone half:** trigger the download at 430px on
   mobile Safari/Chrome (the blob-download path), not only on a laptop — the record
   lives where the phone is.

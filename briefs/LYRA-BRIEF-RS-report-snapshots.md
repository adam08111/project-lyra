# BRIEF-RS — Report-card snapshots: take the growth report off the glass

> Self-contained executor micro-brief (~half session). Closes the D-I5 finding
> (§112): the Continuous Growth Report — the product's commercial centrepiece — is
> LWW-mutable in `growth_profiles` (overwritten on every regen at
> `growth-report.js:71`), NOT archived as-issued. Same disease BRIEF-114 cured for
> essays; same cure: an append-only snapshot stream. Bonus it quietly creates: the
> student's **band-estimate trajectory over time**, since each archived profile
> carries its bandEstimate.
> **Named brief:** § number = tip+1 at landing; migration number = next free in
> `supabase/migrations/` at execution (expected 0009 per the documented queue —
> Step 0 assigns and records the renumber, §113-style).

## Context

§112's pattern, applied to the report: capture at the data layer where the regen
already flows, zero `lyra.jsx` contact, teachers excluded, flag-gated, server-side
dedup. History starts at landing — no backfill (stated honestly; the current
profile becomes snapshot #1 at its next regen).

## Decisions — do NOT relitigate

- `growth_profiles` and `upsert_growth_profile` (0002) unchanged — the LWW current
  view stays; snapshots are a parallel archive, not a replacement.
- Teachers keep reading the CURRENT profile only (0005 policy). CLAUDE.md in full;
  landing per amended #2; flag-off = byte-identical.

## New decisions this brief sets — RATIFY before executing

- **D-K1 Schema + dedup.** `report_snapshots(student_id uuid references
  students(id) on delete cascade, report jsonb, content_hash text, trigger text,
  ts timestamptz default now())`, `unique(student_id, content_hash)`,
  insert on-conflict-do-nothing (a regen that produces an identical report adds no
  row). Index `(student_id, ts)`. **The hash is computed over the exact serialized
  string sent to the upsert RPC** — not a re-stringify, so key-order drift can't
  fork hashes. The child cascade from `students` is deliberate (§115's kept-segment
  design: erasure and claim-cleanup flow through `students`).
- **D-K2 Capture point = the regen/upsert seam** — the same call site that invokes
  `upsert_growth_profile` (D-I5 located it at `growth-report.js:71`; Step 0
  confirms). One emitter call, transported via the existing outbox (reuse §112's
  enqueue/hash helpers — single source of truth; a new outbox kind, not a new
  pipeline). Zero `lyra.jsx` contact.
- **D-K3 Teachers excluded in v1.** No policy, no grant path — consistent with
  BRIEF-114's conservative posture. A Phase-B "progression view" may add a
  deliberate teacher-read later, as its own decision.
- **D-K4 No backfill.** History begins at landing; the § entry says so.
- **D-K5 Size guard:** report > 64KB → skip, counts-only log (sanity rail).

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md` §3, § tip. Read `growth-report.js` around line 71 (the regen
completion + upsert call — confirm the serialized payload is available at that
seam), §112's emitter/outbox modules (what's reusable), 0002 (the RPC's parameter
shape), and the migration directory for the next free number. Confirm
`report-card-brain.js`'s schema — the snapshot stores what the RPC receives,
whole, no field selection.

**Step 1 — migration** per D-K1 (RLS: student INSERT+SELECT own via
`current_student_id()`; grants per the 0004 pattern; anon revoked).

**Step 2 — the emitter call** at the D-K2 seam: hash → enqueue → outbox flush path
handles the rest. Never-stuck: emitter failure is a counts-only warn; it must never
block the regen or the profile upsert.

**Step 3 — tests (mocked client).** Regen emits exactly one snapshot; identical
regen dedups (no second row); the hash covers the exact upsert string; >64KB
skipped counts-only; flag-off emits nothing; no report content in any log
(spy-console). Suite: current baseline + new, green.

**Step 4 — docs + landing.** DEPLOY.md migration list; `DATA-ARCHITECTURE.md` §3's
"growth report on the glass" line flips to FIXED with the § pointer; SECURITY.md
one sentence (append-only, student-only, teachers excluded). § entry; land per
CLAUDE.md #2.

## Manual verification (Adam — rides the next sitting)

1. Apply the migration. Trigger a report regen live → one row; `select
   report->>'bandEstimate', ts from report_snapshots …` shows the archived band.
2. Regen with no new practice → no new row (dedup held).
3. Teacher session: `select count(*) from report_snapshots` → denied/zero (report
   which).
4. Flag-off build: zero trace.

## Out of scope

Any change to the current-profile path or RPC. Backfill. Teacher access. A
progression UI. Retention/compaction. Masterclass cards (already append-only).

## Karpathy close

One table, one emitter call, four tests. If the regen seam doesn't expose the
serialized payload cleanly — stop and report, don't restructure the regen. Land FF
with approval; record the shas. Repo wins, always.

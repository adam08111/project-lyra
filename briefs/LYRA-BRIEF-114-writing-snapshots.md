# BRIEF-114 — Writing snapshots: extend the ledger to cover the glass (Tier 1)

> Self-contained executor brief (1–2 sessions). Implements DATA-ARCHITECTURE.md §3:
> essays currently live as mutable whole-blobs (deletes propagate, last sweep wins —
> §101, LIVE-VERIFIED); this brief adds an **append-only `writing_snapshots` ledger**
> so a draft, once written, can never be silently destroyed — not by a vandal, not by
> a clobber, not by the unexplained-loss class. It also captures the product's most
> valuable object: draft evolution over time.
> **Brief ID ≠ § number:** this lands as tip+1 whatever the tip is (queue position:
> immediately after §111, before BRIEF-112/113) — Step 0 renumbers.

## Context

Layer 2 learning events are append-only and dedup'd (`LIVE-VERIFIED`); Layer 1 blobs
are not. The snapshot table is Layer 2's discipline applied to essay content. Design
constraint that shapes everything: **the capture happens in the sync layer, not the
editor** — `lyra.jsx` is untouched, mobile overlays are untouched, and the whole
brief is a data-layer change.

## Decisions — do NOT relitigate

- Local-first unchanged; blobs and their semantics unchanged (snapshots are a NEW
  parallel record, not a blob replacement). §113's characterization targets stay
  true.
- **Teachers never read snapshots.** They are essay content; the SELECT-only,
  no-essays teacher posture (SECURITY.md) extends to this table: no teacher policy,
  no teacher grant path. Dashboard queries are unaffected.
- Flag-gated like all sync: with `VITE_SUPABASE_*` unset, zero behavior change.
- Additive migration only; 0001–0006 untouched. CLAUDE.md in full; landing per
  amended #2.

## New decisions this brief sets — RATIFY before executing

- **D-I1 Schema + server-side dedup.** New table
  `writing_snapshots(student_id uuid references students(id), writing_id text,
  content text, content_hash text, trigger text, deleted boolean default false,
  ts timestamptz default now())`, with
  `unique(student_id, writing_id, content_hash)` and inserts as
  on-conflict-do-nothing — the learning_events content-key pattern applied here, so
  reload/multi-trigger dedup is server-enforced (CLAUDE.md #8). Index
  `(student_id, writing_id, ts)`. RLS: student INSERT + SELECT on own rows via
  `current_student_id()`; **no teacher policy**; grants per the 0004 pattern
  (authenticated only, anon revoked). Migration `0007_writing_snapshots.sql`.
- **D-I2 Capture points — sync layer only.** Two seams, both existing:
  (a) **proofread/coaching completion** — the same module that already emits grammar
  learning-events additionally emits a snapshot of the current writing
  (`trigger:'proofread'`); (b) **the blob sweep** — when the sweep detects
  `lyra-projects` changed, it diffs the parsed writings against the last-sent parse
  and emits one snapshot per writing whose content hash changed
  (`trigger:'sweep'`). Transport: the existing async outbox. Zero new timers, zero
  editor hooks.
- **D-I3 Deletion is an event.** A writing present in the previous parse and absent
  in the current one emits `{deleted:true, trigger:'delete'}` with the last-known
  hash. In-app deletion thereby becomes recorded history, not destruction; the blob
  tombstone behavior itself is unchanged.
- **D-I4 Size guard.** Content > 64KB: skip the snapshot, log counts-only
  (never content). Essays are ~3KB; this is a sanity rail, not a feature.
- **D-I5 Rides along in Step 0:** verify the standing claim that generated report
  cards already archive **as-issued** in the event mirror (the §95 schema implies
  it; DATA-ARCHITECTURE.md §3 depends on it). Report CONFIRMED or CORRECTED with
  file:line — do not fix anything either way in this brief.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`DATA-ARCHITECTURE.md`, § tip (this is tip+1). Read: the module where proofread
completion emits grammar events (expected `learning-sync.js` territory); the blob
sweep and its last-sent bookkeeping (`sync-outbox.js` / §101 paths); the parsed
shape of the `lyra-projects` blob (writing ids, titles, content fields — the diff in
D-I2b depends on it); migrations 0001–0006 for the RLS/grant patterns and the
`current_student_id()` helper. Perform the D-I5 verify. If the blob shape or the
emission seam differs materially from this brief's assumptions, stop and report —
the repo wins.

**Step 1 — migration `0007_writing_snapshots.sql`** per D-I1, authored in-repo,
applied by the maintainer in the SQL editor (record that in DEPLOY.md's migration
list).

**Step 2 — capture:** the snapshot emitter (hash, dedup-key, outbox enqueue) as one
small module; wire seam (a) at proofread emission and seam (b) in the sweep diff,
including D-I3 deletion detection. Never-stuck: emitter failures are counts-only
warnings; they must never block the proofread path or the sweep.

**Step 3 — tests.** Mocked-client throughout: proofread emits exactly one snapshot;
unchanged sweep emits none (hash dedup); changed writing emits one per changed
writing; deletion emits the tombstone event; >64KB skipped with counts-only log;
flag-off emits nothing anywhere (the D-gate pin); outbox payload shape matches the
migration. No console path ever contains essay content (spy-console assertion).
Suite: current baseline + new, green.

**Step 4 — docs + landing.** DEPLOY.md: apply-0007 line. SECURITY.md: one sentence —
snapshots exist, append-only, student-read-only, teachers excluded.
DATA-ARCHITECTURE.md §3: flip status to BUILT-UNVERIFIED with the § pointer.
§ entry (tip+1) including the D-I5 verdict; land per CLAUDE.md #2.

## Manual verification (Adam)

1. Apply 0007. Write → proofread → `select writing_id, trigger, left(content,40),
   ts from writing_snapshots order by ts;` shows one `proofread` row.
2. Edit the essay, wait a sweep → a second row, different hash. Sweep again with no
   edit → no third row (dedup held).
3. Delete the writing in-app → a `delete` tombstone row appears; the history rows
   remain.
4. Teacher session: `select count(*) from writing_snapshots` → denied/zero (report
   which, as in §106's check).
5. Flag-off build: zero trace.

## Out of scope

Any blob-semantics change. Restore/rollback UI (operator SQL restores for now;
a surface is post-pilot). Teacher access of any kind. Retention/compaction policy.
The take-home export (BRIEF-116 reads this table later). Any `lyra.jsx` change.

## Karpathy close

One migration, one emitter module, two wire points, tests, docs. The emitter must
be invisible when it fails and silent when nothing changed. If the blob-parse diff
turns expensive or the seams aren't where expected — stop and report, don't
improvise into the editor. Land FF with approval; record the shas. Repo wins,
always.

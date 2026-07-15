# BRIEF §113 — Identity-semantics characterization tests: pin the clobber in code

> Self-contained executor micro-brief (~half session, tests only, zero behavior change).
> Purpose: the architectural decision "no shared accounts / no multi-device identity
> before a sync-semantics redesign" currently lives in prose (§101, HANDOFF §8, the
> planner record). This brief converts it into executable documentation: tests that
> PASS today by demonstrating the exact behavior that makes shared identities unsafe.
> Anyone who later adds accounts without redesigning sync will break these tests —
> which is the point. They are a tripwire, not a bug report.

## Context

§101's landed design (verified in its entry): blob flush reads the live value and
whole-blob upserts on `(student_id, key)`; the sweep compares local hash against
**last-sent**, never against server recency; boot re-seeds last-sent from remote and a
locally-different blob then pushes; hydration is fill-empty-only. Consequence: two live
devices on ONE student silently clobber each other — last sweep wins, not last edit.
Safe today only because identity is per-device. These tests state that in `expect()`.

## Decisions — do NOT relitigate

- **Zero production-code change.** If writing a test reveals the semantics differ from
  the §101 description, STOP-AND-REPORT — that is a major finding, not a test tweak.
- Mocked Supabase client throughout (the §96 pattern); no live DB, no env vars.
- CLAUDE.md in full; landing per amended #2.

## New decisions this brief sets — RATIFY before executing

- **D-H1** Tests live at `tests/characterization/identity-semantics.test.js`, opening
  with a comment block that names the guarded decision verbatim: *"These tests document
  why one student identity must not be live on two devices. They are expected to PASS.
  If you are adding shared accounts / multi-device identity: these must not merely be
  updated — the sync layer must first be redesigned (recency or merge), and these tests
  replaced by ones proving the new semantics. See §101, §113, HANDOFF §8."*
- **D-H2** Three tests, no more: (1) **last-sweep-wins** — device A upserts a 3-part
  blob for student S; device B, holding an older-but-different blob for the same S with
  a re-seeded last-sent, sweeps; assert the mock server's final blob equals B's older
  content. (2) **fill-empty-only** — a device with non-empty local hydrates against a
  differing remote; assert local is untouched and last-sent re-seeded to remote.
  (3) **the re-seed push** — after (2), the very next sweep pushes the local (older)
  content over remote; assert the upsert fired with local content. Use the real
  sync/blob modules with only the client mocked — these must exercise shipped code
  paths, or they document nothing.

## Steps

**Step 0 — verify reality.** Read `CLAUDE.md`, § tip (expected §110.1 or later —
renumber to tip+1; §111/§112 may land first). Read the blob sweep / outbox / hydrate
modules and the §101 entry; confirm the mechanism names above match the code
(STOP-AND-REPORT if not). Reuse the existing mocked-client harness from the §96/§101
test suites rather than inventing one.

**Step 1 — the three tests** per D-H2, with the D-H1 header comment.

**Step 2 — § entry + land.** Suite: current baseline + 3, green. Entry notes these are
characterization (documenting present behavior), links the decision they guard.

## Manual verification (Adam)

None beyond the suite — pure mocked-path work. Optional 60 seconds: read the three
test names and the header comment; they should read as the argument, in code.

## Out of scope

Any sync change, any fix, any recency/merge design, any account work, live-DB anything.

## Karpathy close

Three tests and a comment. If it wants to be more, stop and report. Land FF with
approval; record the shas. Repo wins, always.

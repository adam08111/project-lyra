# docs/decisions/ — the successor-package decision records

This folder holds the long-form decision records that a cold planning session cannot reconstruct
from the code or the `§` log alone — the "why" behind choices that were made in conversation. It was
created at **§130 (D-K5)** as a **drop-slot** so that CHECKPOINTS **A7** becomes a simple *drop + one
commit + one §-line*, not a from-scratch task.

**Two materials belong here (A7):**

1. **`identity-conversation.md`** — the identity-model conversation transcript (per-device anonymous
   identity, fork semantics, the recovery/regen decisions, Identity v2 thinking). **The maintainer
   drops this** — it is his conversation record; the executor cannot author it. Scrub any live recovery
   code before committing (the §98 / §122 standard — recovery codes never land in committed docs).

2. **`PLANNER-HANDOFF.md` (refreshed)** — the planner-seat front door. The repo copy at the root is
   frozen at §116–§118 state (tip `ead61cf`, 628 green); it needs the same rewrite-don't-append refresh
   HANDOFF §4/§8 got in §129. **The planner writes this content** (it is not executor-doable — the
   executor only prepared this slot); when refreshed it can live here or stay at the root, the
   maintainer's call.

**When both are in hand:** drop them, `git add`, one commit, one §-line — A7 done.

*Privacy: nothing in this folder carries a student's name, a recovery code, or a raw UUID beyond the
redacted ids already in the `§` log (the counts-only rule, `SECURITY.md`).*

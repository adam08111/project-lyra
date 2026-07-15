# TASK BRIEF — `lyra.jsx` decomposition: investigation + first extraction (Phase D0/D1)

> Executor: Claude Code. Planning brain: Fable 5 (final planning session before rotation). This brief is **written to be executed by any successor model** and is deliberately **investigation-first**: the planner has read `lyra.jsx` but is NOT presuming the seam boundaries — Step 0 is a real analysis the executor performs against CURRENT source, and its output GATES whether any extraction proceeds. This is a **refactor**, the highest-risk class of change in the codebase, so it is governed by one non-negotiable rule: **behaviour is frozen; only structure moves.**

---

## Context

`lyra.jsx` is ~1,347 lines with ~50 `useState` hooks in a single component. The P0 data work (§95–§101) deliberately routed *around* it (dual-path capture, persist-effect hooks) to keep blast radius zero while shipping infrastructure — correct then, but it means the component has kept accreting and some architectural rationale now lives in the §-log rather than the source. The next wave of work (teacher dashboard, Scriptorium redesign, pilot identity UX) lives IN the components, where this fragility bites. The grammar-log three-producer problem (§96) is the canonical symptom: one piece of state, multiple writers, easy to add a fourth that forgets an invariant.

**This is a strangler-fig on your own component** — the same pattern May16 used against Shopline, turned inward. NOT a rewrite. The goal of THIS brief is modest and safe: (D0) produce a verified seam map + a characterization-test safety net, then (D1) extract exactly ONE low-risk seam to prove the pattern and the tests. Further seams are follow-up briefs, one per session. **If D0's analysis shows the component is more entangled than the state-cluster hypothesis suggests (shared state across every domain, effects that cross all seams), the correct output is "extraction is not safe yet, here is why" — reporting that is SUCCESS, not failure.** A refactor that isn't clearly safe must not ship.

## The non-negotiable rule

**Zero behaviour change. Zero.** No feature added, removed, or altered; no UX difference; no prompt change; no storage-key or event change; no network-call change. The ONLY thing that moves is where code lives. Every existing test passes **unmodified** — that is the definition of done for structure-only work (contrast the P0 briefs, where tests occasionally changed because a contract changed; here NOTHING changes contract). If a "cleaner" structure would require changing behaviour, DO NOT — note it as a separate future improvement and preserve current behaviour exactly, warts included.

## The state-cluster hypothesis (planner's read — to be VERIFIED, not assumed)

From a read of the hook declarations, `lyra.jsx` state appears to cluster into these domains. **Step 0 must confirm or correct this against current source before anything is extracted:**
- **source-setup / onboarding:** `screen`, `topic`, `type`, `wordCount`, `purpose`, `sourceText`, `sourceAnalysis`, `extractedSkills`, `targetVoice`, genre-cue state
- **chat/coaching:** `messages`, `chatLoading`, `typingMsg`, abort refs, welcome/streaming refs
- **editor:** `draft`, `title`, `suggestions`, `proofread`, `proofTab`, `appliedSuggestions`, save timer
- **grammar-log:** `grammarLog`, `showGrammarLog`, `miniLesson` (the 3-producer seam — likely the LAST to extract, not the first, precisely because it's the entangled one)
- **style-lab:** `showStyleLab`, `appliedSkill`, `writingTechniques`, technique-enriching state
- **training:** `trainingSkill`, `trainingStartTech`
- **projects/sidebar:** `projects`, `activeWritingId`, `sidebarOpen`, project-edit state
- **cross-cutting (the risk):** `tab`, `userName`, `apiCalls`/`apiCallRef`, `homeKey` — these likely touch MANY domains and are what make extraction hard

## Steps

**Step 0 — SEAM ANALYSIS (the real work; output gates everything after).** Read `lyra.jsx` IN FULL (all ~1,347 lines, not a sample), plus `CLAUDE.md` and the `PROGRESS-REPORT.md` tail (**tip must be §103 → this lands as §104**; if §103 hasn't landed yet, this can proceed independently but say which § it takes and confirm the green baseline). Produce, as the primary deliverable of this session, a written **seam map**:
  - Confirm/correct the domain clusters above; list each domain with the exact state + functions + effects it owns.
  - **Build the coupling matrix:** for each piece of state, which domains READ it and which WRITE it. The domains that share the least state are the safe first extractions; anything touched by many is deferred.
  - Identify the **cross-cutting state** explicitly (the `tab`/`userName`/`apiCalls` class) — these do NOT get extracted; they either stay in the parent or become explicit props/context. Name which.
  - Flag every place where the §-log's rationale should become an inline code comment (e.g. WHY `recordGrammarLogDelta` sits in the persist effect not the producers) — the refactor is the moment to move that knowledge from log to source.
  - **Recommend the single safest first extraction** with the reason (fewest shared-state edges, clearest boundary). The planner's *prior* is that a leaf-ish domain like **style-lab** or **training** or the **projects/sidebar** is safer than grammar-log or the editor; the coupling matrix decides, not this prior.
  - **Gate:** if the matrix shows the safest candidate STILL shares mutable state across the boundary in a way that can't be cleanly passed as props/context without behaviour risk, STOP and report "not safe to extract yet, here's the entanglement" + a recommended smaller intermediate step (e.g. "first consolidate these two effects," or "first lift this shared state to a context"). **Do not extract on a marginal case.**

**Step 1 — CHARACTERIZATION TESTS FIRST (the safety net, before any code moves).** For the seam Step 0 recommends, write characterization tests that capture CURRENT behaviour of that surface — the render output, the state transitions, the storage interactions — as they are TODAY (bugs and all; characterization tests document reality, not intent). These must pass against the UN-refactored component. This is the ratchet: the extraction is only allowed to proceed if these tests exist and pass first, and must still pass byte-for-byte after. If the seam can't be characterized with tests (too entangled to isolate its behaviour), that is itself a STOP signal — report it.

**Step 2 — EXTRACT THE ONE SEAM.** Move the recommended domain into its own component/hook file (`src/components/<Domain>.jsx` or `src/hooks/use<Domain>.js`, matching the repo's existing convention — check what §-history established). Cross-cutting state passes as explicit props or a small context (whichever the repo already uses; do NOT introduce a new state-management library). The parent `lyra.jsx` shrinks by exactly that domain; nothing else changes. Move the relevant §-rationale comments INTO the new file so the knowledge travels with the code.

**Step 3 — PROVE ZERO DRIFT.** The full existing suite passes **unmodified** (report the count — expected 523, or whatever §103 left). The Step-1 characterization tests pass unchanged. `vite build` clean. Manually confirm in dev that the extracted surface behaves identically (the domain's happy path + one edge). `git diff` shows: new file(s) + a SHRUNK `lyra.jsx` + the new characterization tests — and **no change to any other component, proxy, prompt, migration, or storage key.**

**Step 4 — CLOSE OUT.** Append **§104** with: the full seam map + coupling matrix (this is a durable artifact — future extraction briefs read it), which seam was extracted and why it was safest, the characterization-test approach, the before/after line count of `lyra.jsx`, and a **recommended ORDER for the remaining extractions** (so each future session is a small, pre-analysed brief, not a fresh improvisation). Push; FF-land on `origin/main`; **report shas incl. the new origin/main sha.**

## Manual verification (Adam)

- The extracted domain works identically in dev — walk its main flow + one edge case; nothing visibly changed (that's the point — a successful structural refactor is invisible to the user).
- `git diff --stat` shows `lyra.jsx` smaller and no unrelated file touched.
- The seam map in §104 reads as a real map you could hand to the next session to extract seam #2 without re-analysing.

## Explicitly OUT OF SCOPE

Extracting more than one seam (one per session — each future seam is its own brief informed by §104's map/order). ANY behaviour/feature/UX change. Introducing a state-management library (Redux/Zustand/etc — use the repo's existing prop/context patterns only). Touching the other god components (they get their own briefs later; this establishes the pattern on the highest-value one). Any prompt/router/proxy/migration/storage change. Fixing bugs found during analysis (characterize them as-is; a found bug is a separate ticket, and "fixing" it during a refactor is exactly how refactors introduce regressions). Doing this before the CIP demo if it competes for time — this is post-demo, pre-next-feature-wave work.

## Karpathy close

Read the ENTIRE `lyra.jsx` first — a seam map from a partial read is worthless and dangerous. Behaviour is frozen; only structure moves; every existing test passes unmodified or the extraction is wrong. Characterization tests come BEFORE the code moves, not after. One seam only. The coupling matrix decides the seam, not any prior — including the planner's. **Extraction on a marginal-safety case is forbidden; reporting "not safe yet, here's why" is a fully successful outcome.** Stop-and-report triggers: the safest candidate still shares mutable state unsafely, a seam can't be characterized by tests, §-tip unexpected, a state-library would be needed, or ANY behaviour would have to change to make the structure clean. Existing suite green at its count and UNMODIFIED, characterization tests green, build clean, only `lyra.jsx` + new files touched, push AND land on `origin/main`, report shas incl. origin/main. The seam map + extraction order are required deliverables — they are what make this a *program* of safe refactors rather than one risky cut. Branch hygiene report-only.

# TASK BRIEF — P0 Phase 1: Layer 2 event mirror (lands as §96)

> Executor: Claude Code, one session. Planning brain: Fable 5. Builds on §95 (Supabase foundation, landed at `d3e43fe`). Decisions D1–D6 ratified 3 Jul 2026; design details below finalized against a full source read of `lyra.jsx`, `backup.js`, `main.jsx`-as-of-§95, and the learning modules.
> The Supabase project is LIVE (`ap-southeast-1`, migration 0001 applied, anonymous auth on, one dev student row exists). Flag-on verification runs **in-session**.

---

## Context

Phase 1 makes the moat real: every learning identity (grammar, growth, skill deployment, structure, vocabulary, report) mirrors into `learning_events`, and the growth profile mirrors into `growth_profiles`, via an async, retrying, capped outbox. localStorage remains authoritative for all reads; sync failure never blocks a student; the server's `unique(student_id, type, content_key)` makes every replay idempotent. When this lands, `select * from student_rule_frequency;` over real coaching data is the Cyberport CIP demo artifact.

**Authoritative write-surface inventory** (from full source; verify in Step 0, stop-and-report on any divergence):

| Event type | Producer(s) | Canonical write | Phase 1 hook |
|---|---|---|---|
| `grammar` | (a) `syncLearningData` coaching path in `learning-sync.js`; (b) `runProofread` direct `setGrammarLog` prepend in `lyra.jsx` (**no dedup vs existing log**); (c) `onSaveCorrections` §70 path in `lyra.jsx` (inline dedup, duplicated key literals) | React state → the grammar **save effect** in `lyra.jsx` → `window.storage.set("grammar-log", …)` | **Persist-effect delta hook** in `lyra.jsx` (one line) — covers all three producers. The `syncLearningData` grammar branch does **NOT** enqueue (would double-enqueue). |
| `growth` | `syncLearningData` growth block (authentic-growth gated) | raw `localStorage` `lyra-growth-log` | inside `learning-sync.js`, post-dedup |
| `skill_deployed` | `syncLearningData` deployments block | raw `lyra-skill-deployments` | inside `learning-sync.js`, post-dedup |
| `structure` | `syncLearningData` structures block | raw `lyra-structures` | inside `learning-sync.js`, post-dedup |
| `vocabulary` | `syncLearningData` vocabulary block | raw `lyra-vocabulary` | inside `learning-sync.js`, post-dedup |
| `report` | structured learningData path, `maybeSaveVisibleReport` fallback, and the `onSaveAchievement` manual backstop in `lyra.jsx` — **all funnel through `saveMasterclassReport`** | raw `lyra-masterclass-reports` | inside `saveMasterclassReport`, post-dedup — one hook covers all three callers |
| profile | `saveProfile` in `growth-report.js` | raw `lyra-growth-profile` | inside `saveProfile` → guarded-upsert RPC |

`lyra-growth-pending` is a staging queue, not an event store — no enqueue. Local grammar-log may contain duplicate phrase|correction rows (producer (b) never dedups); the mirror is a **deduplicated identity set, not a row-count copy** — this is correct per D5 and is tested below. Local deletions (Grammar Log UI) do not propagate: `learning_events` is append-only by design — the moat keeps the record.

## Decisions — DO NOT RELITIGATE

D1–D6 as ratified (local-first; own SG project; anon auth + recovery code; Layer 2 first; D5 schema with content keys **exactly** as computed by `src/content-keys.js`; anon key client-side). Inherited: proxies / `ai-router.js` / `lyra-brain.js` / `judgment-rules.js` untouched; CLAUDE.md #3 single source of truth for dedup keys (this brief REMOVES a duplicate, never adds one); #7 never-stuck — enqueue is synchronous-cheap, flush is async, no user-visible failure states; §87/§88 — sync logging is counts/status only, never student content (payloads go to the RLS-protected database, which is the product; they never go to logs). Amendment to the umbrella plan, settled by the source read: `lyra.jsx` receives **exactly four enumerated line-touches** (Step 4), not one — reality overrode the estimate; nothing else in that file changes.

## Steps

**Step 0 — Read first; verify; stop-and-report on mismatch.**
Read: `CLAUDE.md`, `PROGRESS-REPORT.md` tail, `src/learning-sync.js`, `src/growth-report.js`, `src/content-keys.js`, `src/supabase-client.js`, `src/sync-init.js`, `src/lyra.jsx` (the grammar effects + `onSaveCorrections` + `onSaveAchievement` sites), `src/backup.js`, `src/main.jsx`, `src/report-utils.js` (locate `tsOf` or equivalent timestamp helper), `supabase/migrations/0001_init.sql`.
Confirm: §-log tip is **§95** (else take next number and say so); the producer inventory table above is complete (grep for every `setGrammarLog` caller and every `localStorage.setItem` on the six learning keys — **any producer not listed above → STOP**); `autoRestoreFromBackup()` returns `{ restored, ts }` and is called in `main.jsx` pre-mount with its return currently unused; the outbox key name `lyra-sync-outbox` collides with nothing.

**Step 1 — Migration `supabase/migrations/0002_profile_upsert.sql`** (authored in-repo; Adam applies via SQL editor):
`upsert_growth_profile(p_profile jsonb, p_last_regen_at timestamptz) returns void`, `security definer`, `set search_path = public`, grant execute to `authenticated`: insert `(current_student_id(), p_profile, p_last_regen_at, now())` on conflict `(student_id)` do update set `profile/last_regen_at/updated_at` **only where** `growth_profiles.last_regen_at is null or excluded.last_regen_at > growth_profiles.last_regen_at` — server-enforced LWW per D5. Refuse (no-op) when `current_student_id()` is null. Commit.

**Step 2 — `src/sync-outbox.js`.** Pure module, no imports from React.
- Queue persisted under `localStorage["lyra-sync-outbox"]`; entries `{ kind: "event" | "profile", payload, qts }`. Cap 500, drop-oldest with one counts-only `console.warn`.
- `enqueue(item)`: no-op unless sync enabled (`getSupabase()` truthy check is cheap/memoized); push + persist + schedule a debounced (3s) flush. Never throws.
- `flush()`: single-flight guard; requires `ensureStudent()`; events batched (50/chunk) via `.upsert(rows, { onConflict: "student_id,type,content_key", ignoreDuplicates: true })` (maps to ON CONFLICT DO NOTHING — replays vanish server-side); profile entries via `rpc("upsert_growth_profile", …)`, keeping only the newest queued profile per flush. Success → remove flushed items, reset backoff. Failure → keep items, exponential backoff 30s → 2m → 10m (cap), counts-only log line.
- Triggers: after `initSync()` identity, `window` `online` event, debounced post-enqueue. No flush on `beforeunload` (unreliable; the queue persists — next boot flushes).
Commit with tests: enqueue/no-op-when-disabled, cap + drop-oldest, batch chunking, ignore-duplicates params, backoff schedule, persistence round-trip, single-flight. Supabase client fully mocked; **no network in tests**.

**Step 3 — `src/data-layer.js`.** The mapping layer, pure and unit-tested:
- `eventTs(entry)`: prefer the numeric prefix of `entry.id` (`Date.now()_rand` shape) → else parse `entry.date`/existing `tsOf` helper (reuse/export the existing one — single source; do not write a second date parser) → else `Date.now()`. Returns ISO string.
- `toEvent(type, entry, contentKey)`: `{ type, content_key, rule, technique, topic, ts, payload }` with promoted columns per type (`rule` for grammar, `technique` for skill/report where present, `topic` from the entry) and the **full entry as `payload`**. `student_id` attached at flush time from the cached identity.
- Guard: skip (return null, counts-only debug) when `contentKey` is empty-ish — both sides blank (e.g. `"|"` from a blank proofread instance). Local behavior untouched; garbage identities simply don't mirror. This does not change any key definition.
- `recordGrammarLogDelta(logArray)`: module-level `Set` baseline; **first call initializes the baseline from the given array and enqueues nothing** (that call carries the loaded/healed log); subsequent calls enqueue `toEvent("grammar", e, grammarKey(e))` for keys not in the baseline, then add them. Deletions are inert.
- `recordLearningEvents(type, entries, keyFn)` for the learning-sync hooks; `saveProfileRemote(profile, lastRegenAt)` for growth-report.
Commit with tests: mapping fixtures per type (real entry shapes), `eventTs` fallback chain, empty-key guard, delta baseline-then-diff behavior (including "first call with populated log enqueues nothing").

**Step 4 — Producer hooks.** Smallest diffs:
- `learning-sync.js`: after each of the five non-grammar dedup blocks writes its store, enqueue the *newly added* entries via `recordLearningEvents` (growth → `growthKey`, skill\_deployed → `skillKey`, structure → `structureKey`, vocabulary → `vocabKey`); inside `saveMasterclassReport` post-dedup, enqueue `report` via `reportKey`. The grammar branch: **no enqueue** (covered by the effect hook).
- `growth-report.js`: inside `saveProfile`, additionally `saveProfileRemote(profile, last_regen_at)`.
- `lyra.jsx` — exactly four line-touches, nothing else: (1) import `recordGrammarLogDelta` (+ `grammarKey`); (2) one call `recordGrammarLogDelta(grammarLog)` inside the existing grammar **save** effect, after the `window.storage.set`; (3)+(4) in `onSaveCorrections`, replace the two inline `` `${(e.phrase||"").toLowerCase()}|${…}` `` literals with `grammarKey(e)` (CLAUDE.md #3 — removes the duplicated key definition).
Commit. Existing behavior tests must pass unmodified.

**Step 5 — Backfill (one-time + restore-forced sweep).**
- `backfillIfNeeded({ force })` in `data-layer.js`: sweeps the six local stores + profile through the same mapping/enqueue path (server dedup absorbs everything), then sets `localStorage["lyra-sync-backfill-v1"]`. Runs when the flag is absent **or** `force` is true. Same idempotent-flag pattern as `purgeInauthenticGrowthV1`.
- `main.jsx`: capture `const { restored } = autoRestoreFromBackup()` (currently discarded) and pass to `initSync({ restoredKeys: restored })`. `sync-init.js`: after identity, call `backfillIfNeeded({ force: restoredKeys.some(k => LEARNING_KEYS.includes(k)) })` — a heal-restore of any learning key forces a re-sweep, closing the "healed rows the server never saw" gap; the unique constraint absorbs the duplicates. `LEARNING_KEYS` defined once in `data-layer.js` (grammar-log, lyra-growth-log, lyra-skill-deployments, lyra-structures, lyra-vocabulary, lyra-masterclass-reports, lyra-growth-profile).
Commit with tests: flag-gated once; force path re-runs; sweep maps every store; no enqueue when sync disabled.

**Step 6 — Close out.** Append **§96** to `PROGRESS-REPORT.md` (what/why, the producer-inventory finding, verification incl. test count). Full suite green; `vite build` clean. Push branch; land on `origin/main` per CLAUDE.md #2 (merge-base guard, FF only, never force). Report commits, `origin/main` sha, final test count.

## Manual verification

**Env unset (regression):** full suite green (**435 + new**, report exact), build clean, app boots clean, `localStorage` gains no `lyra-sync-outbox` key (enqueue no-ops when disabled).

**Env set, in-session (the point of the phase):**
1. Coaching turn containing a deliberate grammar slip → `learning_events` row, `type='grammar'`, `rule` promoted, payload complete. `student_rule_frequency` returns it — **screenshot this; it is the CIP artifact.**
2. Proofread the same draft **twice** → local Grammar Log may grow; remote grammar row count for those identities **unchanged** (identity mirror, not row copy).
3. "Save corrections" (§70 chat path) and an `onSaveAchievement` manual save → `grammar` and `report` rows appear (proves the effect hook + shared-writer hook).
4. DevTools offline → one coaching turn → rows queue in `lyra-sync-outbox`; back online → queue drains, rows appear, queue empties.
5. Hammer-reload during/after a turn ×5 → remote counts stable (constraint + local dedup both hold).
6. First run on Adam's existing dev profile: backfill sweeps months of real local history into events — dashboard shows the moat materialize in one flush; `lyra-sync-backfill-v1` set; second reload does not re-sweep.
7. Profile regen → `growth_profiles` updates; SQL-call `upsert_growth_profile` with an **older** `last_regen_at` → row unchanged (LWW proven).

## Out of scope

Hydration and `claim()` (Phase 2); `storage-shim.js` write-through / blobs (Phase 3 — note for that brief: `grammar-log` flows through the shim and must be **deny-listed** there, Layer 2 owns it); teacher tables; any UI; deletion propagation (append-only is the design); changing any content-key definition; proxies, router, brain, judgment-rules; applying migrations (Adam applies 0002 via SQL editor before the flag-on checks).

## Karpathy close

Read every touched file first. Smallest diff; commit per unit (0002 → outbox → data-layer → hooks → backfill → § entry). `lyra.jsx` gets the four enumerated lines and nothing else; no drive-by refactors anywhere. Stop-and-report triggers: any grammar/learning producer beyond the inventory table, `tsOf` absent or shaped differently, outbox key collision, §-tip ≠ 95, `autoRestoreFromBackup` signature differs, or anything contradicting this brief. Tests green with count named, build clean, push AND land on `origin/main`, report shas. Branch hygiene report-only.

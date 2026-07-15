# TASK BRIEF — P0 Phase 3: Layer 1 blob durability (lands as §101)

> Executor: Claude Code, one session. Planning brain: Fable 5. Builds on §95–§100. D1–D8 ratified earlier; **D9–D11 ratified 5 Jul** (capture architecture, hydration fold-in + tombstones, size guard — see Decisions). The Supabase project is live; the `blobs` table, its RLS, and its `authenticated` grants have existed since 0001 — **this phase applies NO new migration**.

---

## Context

Layer 2 made the learning identities durable. Layer 1 makes the *blobs* durable — above all `lyra-projects` (every writing and its coaching chats), the largest and most irreplaceable data in the app, which today still dies with a cache-clear. Design: the established local-first outbox pattern, extended with a `blob` item kind; capture is dual-path (shim write-listener + interval sweep) so no component writer ever needs touching; recovery reuses the proven §99 hydration flow — one fetch, one materialize, one guarded reload. When this lands, the §98 recovery story completes: cache-clear → `claim(code)` → **writings, skills, training history, and the Grammar Log all return**.

## Decisions — DO NOT RELITIGATE

D1–D8 as ratified. Inherited: proxies / router / brain / judgment-rules untouched; `lyra.jsx` untouched this phase (capture lives entirely in the sync layer); shim caller-API byte-compatible (locked #8); #7 never-stuck; §87/§88 counts-only logging (blob *values* go to the RLS-protected database — that is the product; they never go to logs).

- **D9 — Dual-path capture, marker-only queueing.** `storage-shim.js` gains a registerable post-write listener (2s per-key debounce) covering shim-carried keys; a 60s interval sweep inside the sync layer covers raw-written allow-list keys, so component writers are irrelevant to correctness. The outbox queues `{kind:"blob", key}` markers only; the flush reads the **live** value at send time (freshest wins; no multi-hundred-KB values duplicated into localStorage — quota protection).
- **D10 — Hydration fold-in, fill-empty-only, tombstones.** Blob recovery extends §99's `hydrateIfNeeded` (same fetch pass, same materialize map, same sessionStorage guard, same single reload). Only locally empty/absent allow-list keys hydrate; empty-string remote values are tombstones and never hydrate. Local deletion/emptying mirrors as a `""` upsert — no DELETE policy, no migration. Concurrent multi-device editing is explicitly out of scope (fill-empty-only is the whole arbitration).
- **D11 — Size guard.** Values > 2MB skip with a counts-only warn naming key + byte size only.

## The classification baseline (Step 0 verifies and completes it)

**ALLOW (blob-mirrored):** `lyra-projects`, `lyra-user-name`, `lyra-style-skills`, `lyra-training-chats`, `lyra-training-progress`, `lyra-saved-concepts`.
**DENY — Layer 2 owns (mirroring twice = two sources of truth):** `grammar-log` (note: flows THROUGH the shim — the listener must consult the deny-list), `lyra-growth-log`, `lyra-skill-deployments`, `lyra-structures`, `lyra-vocabulary`, `lyra-masterclass-reports`, `lyra-growth-profile`.
**DENY — device-local machinery:** `lyra-backup-v1` (duplicates every critical key), `sb-*` auth tokens, `lyra-sync-outbox`, `lyra-sync-backfill-v1`, `lyra-sync-import-pending`, `lyra-recovery-code`, `lyra-sb-student-id`, and every one-time flag (`lyra-growth-purge-v1`, title-migration flag, etc. — flags describe *this device's* store lifecycle and must not travel).
Classification rules for anything found beyond this table: Layer-2-owned → deny; sync/auth/backup/flags → deny; derived caches → deny (report); irreplaceable student/app content → allow. Genuinely ambiguous → STOP and ask.

## Steps

**Step 0 — Read first; build the definitive inventory; stop-and-report on mismatch.** Read `CLAUDE.md`; `PROGRESS-REPORT.md` tail (**tip must be §100 → this lands as §101**; else take next and say so; also report the current green-test baseline — expected 485 unless §100 moved it); `src/storage-shim.js`, `src/sync-outbox.js`, `src/data-layer.js`, `src/hydrate.js`, `src/sync-init.js`, `src/supabase-client.js`, `src/backup.js`, the storage touchpoints in `src/lyra.jsx`, `supabase/migrations/0001–0004`. Then the inventory: grep ALL of `src/` for every `localStorage.` and `window.storage.` reference; produce the full key table (key → writers → reader(s) → classification per the rules) — **this table ships in the § entry as the phase artifact**. Confirm the `blobs` grants/RLS from 0001 (+0004's anon revoke) match what the flush needs (`authenticated`: select/insert/update on `(student_id, key)`).

**Step 1 — Shim listener.** `storage-shim.js`: add `registerStorageListener(fn)`; `set`/`delete` invoke it post-write inside try/catch (a listener failure must NEVER throw into callers — #7). Caller-facing API and semantics byte-identical, including get-throws-on-missing; any existing shim tests pass unmodified. The shim gains no imports (the sync layer registers into it — no dependency cycle).

**Step 2 — `src/blob-mirror.js`.** Exports `ALLOW_KEYS` / `DENY_KEYS` (single source — hydrate imports ALLOW from here); in-memory `lastSent` value-hash map; `noteWrite(key)` — deny-list check → 2s per-key debounce → enqueue marker; `sweep()` — for each ALLOW key, live value vs `lastSent` → changed → enqueue marker; `seedLastSent(map)` for hydration to call (prevents the first sweep re-upserting just-hydrated values); tombstone semantics (absent/empty local → marker; flush sends `""`); D11 size guard at marker-creation time; counts-only logs throughout. No React imports; fully unit-testable.

**Step 3 — Outbox `blob` kind.** At flush: coalesce markers per key (one send per key per flush), read the live value, `upsert({ student_id, key, value, updated_at: now }, { onConflict: "student_id,key" })`; tombstones send `""`. Failure → marker stays, existing backoff applies; success clears `lastSent` staleness. Enqueue remains a no-op when sync is disabled.

**Step 4 — Hydration fold-in.** `hydrate.js`: the existing fetch pass additionally pulls this student's `blobs` rows; `materialize` adds ALLOW-listed keys **fill-empty-only**, skipping tombstones; on completion call `seedLastSent` with what was fetched (hydrated AND already-present-locally keys alike). Same single guard, same single reload — a claim on a fresh device now returns writings and learning history in one cycle.

**Step 5 — Wiring.** `initSync()` after identity: register the shim listener, start the 60s sweep interval, flush on `online` and on `visibilitychange → hidden` (best-effort). Ordering with §99 preserved: hydrate (now incl. blobs) → early-return on reload → backfill/import-pending as-is.

**Step 6 — Tests** (no network; client mocked): classification rules incl. deny-through-shim (`grammar-log` write triggers NO marker); debounce and interval paths; marker coalescing; flush-reads-live-value (enqueue stale → flush sends current); tombstone round-trip (local delete → `""` upsert; `""` remote never hydrates); fill-empty-only (non-empty local untouched); `seedLastSent` prevents first-sweep churn; size guard; listener exception containment. Existing suite stays green.

**Step 7 — Close-out.** Append **§101**: the full classification table, design notes (D9–D11), verification results, **and the landing record — commit shas + the new `origin/main` sha (restore the §95–§98 convention; §99/§99.1 omitted it)**. Suite green with count; build clean; push; FF-land on `origin/main`; report shas.

## Manual verification

**Env unset:** suite green, build clean, zero behavior change, no `lyra-sync-outbox` writes.
**Live on `:3000` (`e9798498`):**
1. Edit a writing → within ~3s the `lyra-projects` row appears/updates in `blobs` (`updated_at` moves). Report its byte size while you're there (real-world D11 headroom check).
2. Complete a training turn (raw-written keys) → within ≤60s `lyra-training-*` blobs appear via the sweep.
3. Deny proof: after a coaching turn with a grammar slip, `blobs` holds NO `grammar-log` row and NO `lyra-backup-v1` row.
4. Tombstone: empty a mirrored store the app can empty → row value becomes `""`; a later hydrate on a fresh device does NOT resurrect it.
5. Churn proof: hammer reload ×5 → no blob upserts fire without local changes (`seedLastSent` doing its job — watch the network tab).
6. **The crown test:** second Chrome profile → `lyraSync.claim('XXXX-XXXX-XXXX-XXXX')` → one auto-reload → **writings, Style Lab skills, training history, AND the Grammar Log all present**. This simultaneously closes §99.1's un-evidenced cross-device gap. SQL census: still exactly one student.
7. The headline: clear site data on the second profile → reload → claim again → everything returns. Screenshot-worthy for CIP: full-device recovery including the writings.

## Out of scope

Multi-device concurrent editing / merge (fill-empty-only is the v1 contract); DELETE policies or any migration; compression; quota management beyond D11; Supabase Realtime; teacher tables; recovery UI; production Vercel enablement; any proxy/router/brain/judgment change; component write-site refactors (the dual-path capture exists precisely so those files stay untouched).

## Karpathy close

Read every touched file first; the inventory grep is the phase's real Step 0 — the design is only as good as the classification table. Smallest diffs; commit per unit (shim listener → blob-mirror → outbox kind → hydrate fold-in → wiring → tests → §). `lyra.jsx` and every component: zero changes. Stop-and-report: ambiguous key classification, shim semantics drift, §-tip ≠ 100, `lyra-projects` real size near the guard, anything contradicting this brief. Tests green with count named, build clean, push AND land on `origin/main`, report shas incl. the landing record. Branch hygiene report-only.

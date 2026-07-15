# TASK BRIEF — P0 Phase 2: hydration + recovery (lands as §99)

> Executor: Claude Code, one session. Planning brain: Fable 5. Builds on §95–§98.1 (foundation, event mirror, log redaction, claim fix + reunification). D1–D6 ratified 3 Jul; **D7–D8 ratified 4 Jul** (below). The Supabase project is live; the dev browser (`:3000`) is session-bound to student `e9798498`, which holds **15 remote grammar events while local stores are empty** — that standing state is this phase's acceptance test.

---

## Context

Phase 1 made the mirror one-way: local → remote. Phase 2 makes it heal in the other direction. When a device is authenticated but its local learning stores are empty and the mirror holds history, the app materializes that history back into the exact localStorage shapes and reloads once — the student opens their Grammar Log and their record is simply *there*. Combined with `claim()` (fixed in §98), this completes D3's story: cache-clear or device change → enter recovery code → history returns. Phase 2 also closes the two known one-way gaps (DataExport import bypasses the enqueue hooks; identity resets fork silently) and hosts the deferred Phase-1 verification (runbook items 2–5, checks 6–7) — deferred precisely so the profile regen would run on real hydrated history instead of minting a thin profile.

## Decisions — DO NOT RELITIGATE

D1–D6 as ratified. Inherited: proxies / router / brain / judgment-rules untouched; content-keys single source; #7 never-stuck; §87/§88 counts-only logging; append-only events.

- **D7 — Hydration = materialize-then-reload, per-key conservative.** Fetch this student's events + profile; for each learning key whose local value is empty/absent AND whose remote type has rows, write the payload array back in the store's native shape/order, then fire **one** `location.reload()` guarded by a `sessionStorage` marker. Precedent: `DataExport.jsx` import (write keys → reload) — the established in-repo pattern for "storage changed underneath React." No merging of divergent non-empty locals in v1 (union-by-content-key is a later phase). Never blocks first paint: hydration runs inside the un-awaited `initSync()`.
- **D8 — Identity change is surfaced, not blocked.** A stored student hint that mismatches the freshly-resolved identity produces a counts-only warn and an `identityChanged` field in `lyraSync.status()`. v1 does not pause sync or prompt; `claim()` is the recovery path. Fork-prevention UX is explicitly v2.

## Steps

**Step 0 — Read first; stop-and-report on mismatch.** `CLAUDE.md`; `PROGRESS-REPORT.md` tail (**tip must be §98.1 → this lands as §99**; else take next and say so); `src/sync-init.js`, `src/data-layer.js`, `src/sync-outbox.js`, `src/supabase-client.js`, `src/learning-sync.js`, `src/growth-report.js`, `src/backup.js`, `src/main.jsx`, `src/lyra.jsx` (grammar load/save effects), `src/components/DataExport.jsx`, migrations 0001–0004.
Verify and record before coding: **each learning store's native array order and shape** (grammar/growth prepend newest-first; confirm structures/vocabulary/skill-deployments/reports conventions from the write sites — hydrated arrays must be indistinguishable from locally-built ones); the event `payload` column holds the full original entry (Phase 1's `toEvent`); the `purgeInauthenticGrowthV1` flag is already set on this profile (hydrated growth re-entering is clean by construction — §96's backfill swept post-purge stores — note it in the § entry); `DataExport.jsx` import writes `grammar-log` then reloads (§97.1 finding).

**Step 1 — `src/hydrate.js`.** Pure logic + one orchestrator:
- `fetchRemote(studentId)`: page through `learning_events` (order `ts` ascending, 500/page) + the `growth_profiles` row. RLS-scoped via the session; failures → `null`, counts-only log, never throws.
- `materialize(events, profile, localReader)`: group events by type → the seven keys; for each key where local is empty/absent and remote has rows, produce the payload array in the store's verified native order; profile row → `lyra-growth-profile` (only if locally absent). Returns `{ key: value }` map. Pure; unit-tested against fixtures built from real §96 event shapes.
- `hydrateIfNeeded()`: skip when sync disabled, when `sessionStorage["lyra-hydrated-v1"]` is set, or when nothing qualifies. Otherwise write the map (raw `localStorage.setItem` — pre-reload writes; the app re-reads through its normal paths after reload, and the grammar effect's baseline then initializes from the hydrated log, so nothing re-enqueues), set the sessionStorage guard, `location.reload()`. Counts-only log: `[sync] hydrated N keys`.

**Step 2 — Wire into `initSync()`** after identity resolution and before `backfillIfNeeded` (a hydrated device must not immediately re-sweep what it just pulled — after hydration, local ≡ remote identities, and the backfill flag state is respected as-is). Confirm ordering renders correctly in the code, not just the comment.

**Step 3 — `window.lyraSync.claim(code)`.** Console-only (precedent: `backup.js`, `lyraSync.code()`): normalize input (`trim().toUpperCase()`), `rpc("claim_student", { p_code })`; on `true` → remove `lyra-sb-student-id`, set `lyra-recovery-code` to the normalized code, clear the hydration sessionStorage guard, `location.reload()` (ensureStudent re-points → hydration fires naturally → the claimed history materializes — one call, full recovery). On `false` → return `false`, counts-only log, no state change. Extend `status()` per D8: `{ enabled, studentId, identityChanged? }`.

**Step 4 — Import sweep.** In `DataExport.jsx`, one line before its existing reload: `localStorage.setItem("lyra-sync-import-pending", "1")`. In `initSync()`: consume the flag → `backfillIfNeeded({ force: true })` → remove it. Imported history now mirrors on the next boot; the unique constraint absorbs every replay. (This is the file's first appearance in a brief — read it fully before the one-line diff.)

**Step 5 — Identity-change surfacing (D8).** In the boot path, when a pre-existing `lyra-sb-student-id` hint mismatches the freshly resolved id: `console.warn("[sync] identity changed", { hadHint: true })` (ids are fine to log — they're opaque UUIDs, not content; keep student *content* out) and set the `identityChanged` flag consumed by `status()`. The hint self-correction behavior from §95 stays as-is.

**Step 6 — Tests** (no network; client mocked): materialize shape-fidelity per store (fixture event → byte-identical store row), per-key conservatism (non-empty local key untouched), ascending-fetch → native-order output, loop-guard (second call no-ops), claim util true/false paths, import-pending consumed exactly once, identityChanged detection. Existing **457 stay green**.

**Step 7 — Docs + close-out.** DEPLOY.md: fix the stale **Production Branch** line (`claude/jovial-kilby-124f12` → `main`); add one paragraph: production `VITE_SUPABASE_*` stays unset until §99 is verified, and setting it requires a redeploy (build-time vars). Append **§99** (design, D7/D8, verification incl. the deferred Phase-1 closures). Suite green with count; build clean; push; FF-land on `origin/main`; report shas.

## Manual verification

**The acceptance test (staged by reality):** on `:3000` — empty local, session on `e9798498` — reload once. Expect: `[sync] hydrated 1 keys` → one automatic reload → **Grammar Log renders the 15 entries** matching the §97.1 CIP table; `grammar-log` length 15; no reload loop (sessionStorage guard); no re-enqueue (outbox stays empty).
**Deferred Phase-1 closures, now meaningful:** items 2–5 (proofread ×2 → remote identity count stable; §70 save + manual achievement → new rows under `e9798498`; offline turn → outbox queues then drains; hammer reload ×5 → counts stable). Check 6: regenerate the growth profile — now fed by real hydrated history — → `growth_profiles` row with `last_regen_at`. Check 7: the non-destructive LWW probe (current payload + **older** timestamp → row unchanged). **Phase 1 fully closed here.**
**Cross-device claim:** second Chrome profile (not incognito) → app mints a throwaway → `lyraSync.claim('XXXX-XXXX-XXXX-XXXX')` → auto-reload → the 15 hydrate there too; SQL census: still exactly one student. **Import:** export from the primary profile, import elsewhere → `import-pending` consumed → force-sweep fires → constraint absorbs (remote counts unchanged).

## Out of scope

Recovery/claim UI for students (console-only this phase); merging non-empty divergent locals; fork *prevention* (D8 surfaces only); teacher tables; Phase 3 blobs/shim write-through (reminder held there: `grammar-log` deny-listed); Supabase Realtime; production Vercel enablement; any proxy/router/brain/judgment change.

## Karpathy close

Read every touched file first — especially the store write-sites whose ordering conventions Step 1 must reproduce. Smallest diffs; commit per unit (hydrate module → wiring → claim → import → surfacing → docs → §). `DataExport.jsx` gets one line; `lyra.jsx` gets zero. Stop-and-report: store shape/order ambiguity, `DataExport` surface differing from §97.1's description, §-tip ≠ 98.1, any reload loop observed in dev, anything contradicting this brief. Tests green with the count named, build clean, push AND land on `origin/main`, report shas. Branch hygiene report-only.

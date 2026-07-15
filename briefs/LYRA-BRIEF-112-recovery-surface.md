# BRIEF §112 — Recovery surface: the student-facing half of "student login"

> Self-contained executor brief (1–2 sessions). Productizes the proven identity
> machinery: `claimStudent` (live-proven §101.1/§110), `lyraSync.code()`, the §99 D8
> `identityChanged` signal. What's missing is everything a human touches: a screen to
> SEE the code, a screen to USE a code, self-service regeneration when it's lost
> (migration 0006), and D8 promoted from a console line to a visible choice. Pilot-gate
> work ⟦HANDOFF §5⟧; not CIP-demo-blocking (the demo uses the seeded class).

## Context

Real history is the spec: §97.1 proved a fork event *destroys the device's stored code
at exactly the moment it's needed* — so regenerate-and-write-down is first-class, not
polish. §109 killed teacher-caused forks; cache-clears, new devices, and wiped shared
machines remain. Recovery today is a console incantation no 14-year-old will type.

## Decisions — do NOT relitigate

- Students stay anonymous; no accounts, no email, no names in the identity model.
- `claim_student` semantics untouched. Migrations additive only (0006 next).
- **ZERO `src/lyra.jsx` structural change** — the surface is an overlay/modal (§104:
  `screen` is cross-cutting and not touched). CLAUDE.md #9: the modal must not break
  ghost-text, keyboard/caret, or the writing-frame on 430px.
- **The recovery code is NEVER logged** (counts/status only) and never leaves the
  device in plaintext except the existing `claim_student(p_code)` call.
- Teachers remain SELECT-only. CLAUDE.md #4: student-facing copy, no scaffolding.

## New decisions this brief sets — RATIFY before executing

- **D-G1 Scope = student self-service only.** Teacher-mediated regeneration is now
  structurally possible (rosters exist) but introduces the **first teacher WRITE** —
  a security-posture change that gets its own brief, review, and SECURITY.md update.
  Explicitly deferred, named in the § entry.
- **D-G2 Regen RPC takes a hash, never a code.** Migration `0006_regen_code.sql`:
  `regenerate_recovery_code(p_new_hash text)` — security definer, `search_path =
  public`, updates the caller's own row via `current_student_id()` (guard: not null),
  returns void; revoke public/anon, grant execute to authenticated. The client
  generates the new code + SHA-256 hash locally (same WebCrypto path as §95 minting —
  parity with the server's `extensions.digest` is already live-proven, §110 R3). The
  server never sees the new plaintext.
- **D-G3 One `RecoveryModal`, two views, three entries.** Views: *Your code* (show
  from `lyra-recovery-code`, monospace groups, "write this on paper" framing, a
  Regenerate button with a confirm step — "your old code will stop working") and
  *Use a code* (input → normalize → `claimStudent` → the existing §99 post-claim
  reload flow). Entries: (a) a trigger in an existing menu/settings surface —
  **Step 0 proposes the mount point and STOP-AND-REPORTS if every candidate touches a
  fragile zone** (editor overlays, header seam); (b) the D8 interstitial: when
  `status().identityChanged`, auto-open in claim mode with "This device was used by a
  different student — use your code, or continue as new"; (c) the *Use a code* view is
  reachable on a brand-new device ("Have a code from another device?").
- **D-G4 Flag-off = invisible.** When `getSupabaseConfig().isConfigured` is false, no
  trigger, no modal, no code path — byte-consistent with the localStorage-only build.
- **D-G5 Copy discipline.** 14-year-old-appropriate, English-primary (match the app's
  existing language convention — Step 0 checks whether UI chrome carries 繁中);
  honest failure copy ("That code wasn't recognised") with no oracle detail; the
  deferred "show code after first save" nudge is out of scope (v1.1).

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`,
`HANDOFF.md`, § tip (renumber to tip+1 if not §112). Read `supabase-client.js`
(`claimStudent`, `lyraSync.code()`, the §95 mint/hash path, the id-hint mechanism D8
compares), `sync-init.js` (where `identityChanged` surfaces), migration `0001` (the
students row shape + how §95 computes the stored hash — the client hash MUST match
that expression). Survey the UI for mount candidates; propose one.

**Step 1 — `0006_regen_code.sql`** per D-G2. In-repo; Adam applies via SQL editor.

**Step 2 — recovery lib** (`src/recovery.js` or per repo convention): `regenerate()` =
generate code (existing generator) → hash → RPC → on success persist to
`lyra-recovery-code` → return the code for display; `claim(code)` = thin wrapper on
the existing `claimStudent` + reload flow. Never-stuck on both.

**Step 3 — `RecoveryModal`** per D-G3 + the D8 interstitial wiring. Mobile-safe per
CLAUDE.md #9 (test on the 430px viewport with keyboard open).

**Step 4 — mount trigger** per the Step-0 decision.

**Step 5 — tests.** Views render (code shown from mocked storage; empty/error
states); regen flow (mocked RPC: new code persisted, old not logged — spy console and
assert no code string appears in any log call); claim flow success/failure; interstitial
opens on `identityChanged`; **flag-off renders nothing** (the D-G4 pin); copy contains
no scaffolding tokens. Suite: current baseline + new, green.

**Step 6 — docs + landing.** DEPLOY.md: apply 0006 line. SECURITY.md: one paragraph —
self-service regeneration, hash-only transport for new codes, teachers still
SELECT-only. § entry with D-G1's deferral named; land per CLAUDE.md #2.

## Manual verification (Adam)

**Rule: destructive tests NEVER against `e9798498`.** Use the tooling orphan
(`c09dcf1e`) or a fresh scratch mint in a throwaway profile.
1. *Your code* shows exactly what's on your paper (non-destructive, any profile).
2. On the scratch student: Regenerate → new code displayed → old code fails a claim
   ("not recognised"), new code succeeds and materializes the scratch data after
   reload.
3. Fork simulation (Step 0 documents the mechanism — the §99 id-hint mismatch):
   interstitial appears, claim path from inside it works.
4. Flag-off build (`VITE_SUPABASE_*` unset locally): zero trace of the feature.
5. 430px + keyboard open: writing-frame, ghost text, caret all intact.

## Out of scope

Teacher-mediated regen (fast-follow brief — first teacher write). Enrolment UX.
The after-first-save nudge. Real accounts. Any RLS change beyond 0006's own grants.
Any `lyra.jsx` structural change.

## Karpathy close

One migration, one lib, one modal, one trigger, tests, docs — commit per unit. If the
mount point fight gets expensive, stop and report rather than improvising into the
§104 seams. Land FF with approval; record the shas. Repo wins, always.

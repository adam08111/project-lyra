# Lyra — Deep Logic Analysis

**Branch:** `claude/deep-logic-analysis-DESuG`
**Baseline:** snapshot of `claude/continue-lyra-ufYB2` @ 790499a (8 Mar 2026)
**Scope:** Full audit of state machines, async control flow, AI prompt routing,
storage interactions, and test alignment. Excludes pure visual/styling concerns.
**Method:** Static read-through of every src file + dependency-graph tracing +
test suite execution. No runtime instrumentation.

---

## 0. Executive Summary

The codebase is feature-rich (~4,300 LOC, 24 source files, 7 prompt templates,
a Gemini proxy, anti-bias anonymisation, learning-sync, training mode, style
lab) but is showing structural strain. The single most expensive symptom is
**`src/lyra.jsx` is a 34-state-hook orchestrator** where most async flows read
critical context through closures rather than reducer arguments; combined with
silent error swallowing and a forked storage layer, this produces a cluster of
small races and a few load-bearing bugs.

| Severity | Count | Tag |
| --- | --- | --- |
| **CRITICAL** | 3 | breaks a shipped feature outright |
| **HIGH** | 7 | silent data loss / wrong-context AI / quota |
| **MEDIUM** | 14 | race conditions, edge cases, UX glitches |
| **LOW** | 9 | future-risk, style, micro-optimisation |
| Tests | 5 failing | stale Anthropic-API tests vs Gemini code |

The most urgent fixes are: (1) repair the photo-OCR transport, (2) fix the
`Writer` ID collision past 26 skills, (3) wire `sourceContext` into the
structural + proofread prompts, and (4) replace the stale `tests/api.test.js`.

---

## 1. CRITICAL — Production Features Broken

### C1. Photo OCR transport is broken end-to-end
**Files:** `src/api-patch.js`, `src/components/SourceSetup.jsx:59,96`,
`src/components/Onboarding.jsx` (photo upload), `vite.config.js`, `server/proxy.js`

**Chain of failure:**

1. `SourceSetup.jsx` calls `https://api.anthropic.com/v1/messages` with
   `claude-sonnet-4-6` for both source-photo OCR and topic-photo OCR.
2. `src/api-patch.js` (loaded globally from `main.jsx`) rewrites any fetch to
   `api.anthropic.com/v1/messages` → `/api/anthropic`.
3. `vite.config.js` only proxies `/api/gemini` and `/api/rate-limit-status`.
   `/api/anthropic` falls through to Vite's SPA fallback (returns `index.html`).
4. `server/proxy.js` has no `/api/anthropic` route either; it would 404 if
   reached.
5. The fetch in SourceSetup catches the error with `catch (err) { /* silent */
   }` — the user sees the scanner spinner stop and nothing else happens.

**Impact:** Both "📷 Upload photo" entry points (source text & topic OCR) are
non-functional in dev and prod. No telemetry, no user warning.

**Fix options:**
- Replace the Anthropic call with a Gemini vision call routed through
  `/api/gemini` (add `parts: [{inline_data:{mime_type, data}}, {text:"..."}]`
  to the Gemini request). This is the minimum change.
- Or stand up an `/api/anthropic` proxy route + add `vite.config.js` proxy. But
  that introduces a second AI vendor on the critical path; not worth it.
- At minimum, `catch (err)` should call `console.error` *and* surface a toast
  so silent breakage stops happening.

---

### C2. `tests/api.test.js` tests an API that no longer exists
**Files:** `tests/api.test.js`, `src/api.js`

The file was authored against the original Anthropic transport
(`api.anthropic.com/v1/messages`, `model: "claude-sonnet-4-6"`, request shape
`{system, messages:[{role,content}]}`). The implementation in `src/api.js`
has been rewritten to call `/api/gemini` with `{system, message, maxTokens}`,
SSE streaming, and grounding sources. **5/120 tests fail.**

**Impact:** CI is red. Worse, it normalises ignoring the suite — a future
real regression in `api.js` will not be noticed because devs learn to expect
red.

**Fix:** Rewrite `tests/api.test.js` to mock `/api/gemini` and assert the new
contract (body shape, `stream:false` toggle, streaming SSE parser, optional
`responseSchema`, `sources` passthrough).

---

### C3. `anonymiseSkillsForAI` collides Writer IDs past 26 saved skills
**File:** `src/utils.js:14-83`

```js
const writerLabel = `Writer ${String.fromCharCode(65 + (index % 26))}`;
```

The 27th skill becomes "Writer A" again, identical to the 0th skill's label.
The mapping array still has two entries but `restoreAuthorNames` does
`result.replace(new RegExp(writerLabel, 'g'), realName)` — both replace
passes apply globally, and the LAST mapping entry wins everywhere.

**Impact:** A power user with ≥27 style skills will see the wrong author's
name appear in coaching messages, and the anonymisation guarantee is broken
for the colliding pair (the AI sees the same label for two distinct writers
and may merge their techniques).

**Fix:** Use `Writer ${index + 1}` (numeric IDs scale indefinitely) or
double-letter encoding past 25 (`Writer AA`, `Writer AB`, …). Numeric is
simpler and equally opaque to the model.

---

## 2. HIGH — Silent Data Loss / Wrong-Context AI

### H1. `restoreAuthorNames` regex is unescaped
**File:** `src/utils.js:14-83, 92-101`

The replacement patterns in `replaceAuthor` are built directly into
`new RegExp(pattern, 'gi')`. For authors with regex metacharacters in their
name ("C.S. Lewis", "Carl Sagan, Jr.", "Ann (Annie) Proulx"), the `.`, `(`,
`)`, etc. become wildcards. "C.S." would also match "CES", "CASE", "C-S-",
etc. anywhere in the original AI response.

**Fix:** Escape user-controlled strings before passing to `RegExp`:

```js
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
new RegExp(esc(pattern), 'gi');
```

Applies to both `replaceAuthor` (anonymise) and `restoreAuthorNames`
(restore).

---

### H2. `buildStructuralPrompt` and `buildProofreadPrompt` are never given
`sourceContext`
**Files:** `src/prompts.js:115, 162`, `src/lyra.jsx:396, 629`

Both prompt builders accept a `sourceContext` parameter (last positional arg)
and embed a "SOURCE TEXT: The student studied a reference text (…). Suggestions
should align with the N techniques they extracted." block when it is non-null.
Both call sites in `lyra.jsx` pass `undefined` (the slot is missing in the
argument list), so the block is always omitted.

**Impact:** Structural style suggestions and proofread feedback are made
**without knowledge of the source text the student analysed**, even when one
exists. This is silently wrong — the student gets generic advice instead of
craft-aligned advice. It also undermines the project's central pedagogical
claim (everything grounds in the studied source).

**Fix:** Build a `sourceCtxObj` once in `lyra.jsx` (same shape as the chat
sendChat already does — author, voice, technique count) and pass it as the
final argument to both prompts.

---

### H3. Anti-bias coverage is asymmetric between coach and other prompts
**Files:** `src/lyra.jsx:464-465, 614-625, 380-395`, `src/prompts.js`

- `sendChat` prepends `ANTI_BIAS_BLOCK` to the coach prompt when skills are
  present (correct).
- `runProofread` builds an `activeSkillCtx` from `anonymiseSkillsForAI([appliedSkill])`
  (correct anonymisation), but does NOT prepend `ANTI_BIAS_BLOCK` to the
  proofread prompt. The model receives "Writer A" labels but no instruction
  not to identify them.
- Structural suggestions effect (line 380) is identical: anonymises into
  `activeSkillCtx` but never appends `ANTI_BIAS_BLOCK`.

**Impact:** A diligent Gemini may still apply training-data knowledge of the
author when "Writer A" is the only identity given. Mitigated by anonymisation
but not as strong as the coach path.

**Fix:** Have `buildStructuralPrompt` / `buildProofreadPrompt` append
`ANTI_BIAS_BLOCK` (imported from utils) when `activeSkillCtx` is truthy.
Single source of truth for the rule.

---

### H4. `learning-sync.js` writes 4 unbounded localStorage keys with no quota guard
**File:** `src/learning-sync.js:64-141`

Each AI coaching message can append entries to:
- `lyra-skill-deployments`
- `lyra-growth-log`
- `lyra-structures`
- `lyra-vocabulary`

Vocabulary and structures deduplicate by `strong` / `name` (good), but
deployments and growth do not. A heavy user produces unbounded growth.
`localStorage.setItem` throws `QuotaExceededError` at ~5–10 MB; the catch
swallows it. Future writes silently no-op, and the user has no idea their
learning data has stopped persisting.

**Fix:** Cap each list to a rolling window (e.g. last 500 entries) inside
each `setItem` block, and surface quota errors as a visible toast.

---

### H5. `saveStyleSkill` dedup is by `authorName` only — concurrent saves
race
**File:** `src/components/XRayView.jsx` (`saveStyleSkill`, called from
`SourceSetup.jsx:177` AND `StyleLab.jsx:688`)

Two analysis paths can land on the same key (`lyra-style-skills`) in the same
session. Both read the array, mutate, and write. The classic last-write-wins
race: the second save will lose any skill added between its read and write.

**Impact:** Rare today (analysing two passages in parallel is awkward) but
real once Style Lab and the source-setup flow share a session.

**Fix:** Centralise into a single `addOrUpdateSkill(skill)` helper that
reads-then-writes atomically, dedupes by stable `id` (the existing
`String(Date.now())` id already there), and either replaces or appends. Or
debounce + last-write-wins is acceptable if explicitly documented.

---

### H6. `localStorage` vs `window.storage` are not interchangeable
**Files:** `src/storage-shim.js`, `src/lyra.jsx:436, 775`, several components

`storage-shim.js` defines `window.storage` over `localStorage` for the
Claude-artifact compatibility shim. The codebase mostly uses
`window.storage.get / set`. BUT several read paths use `localStorage`
directly:

- `lyra.jsx:436` — `localStorage.getItem("lyra-style-skills")` inside
  `sendChat`
- `lyra.jsx:775` — same key, in `onDeploySkills`
- `lyra.jsx:462-465` — same key, again
- `learning-sync.js` — all four learning keys
- `StyleLab.jsx`, `XRayView.jsx` — saved-skills, saved-concepts

If `window.storage` is ever re-routed (e.g. to remote, encrypted, or
namespaced storage), the direct `localStorage` callers will silently see
**stale or empty** data, while the user thinks they're saved.

**Fix:** Either drop the shim (commit to localStorage everywhere) or extend
the shim with synchronous read-cache and re-route every direct call through
it. The current half-and-half is the worst of both worlds.

---

### H7. OCR exceptions are silently swallowed
**Files:** `SourceSetup.jsx:77,114`, multiple `catch (e) { /* silent */ }`
patterns through `lyra.jsx`

Counted **9 silent catches** across `src/lyra.jsx` and components. Categories:
- Storage failures (load/save projects, grammar log, user name)
- AI failures inside auto-triggered effects (structural suggest, mini-lesson)
- OCR network failures
- localStorage JSON parse failures

The existing `IMPROVEMENTS-REPORT.md` already flagged this and proposed a
`logError(context, error)` helper — that proposal stands. The most damaging
of the 9 (OCR + structural-suggest) hide bugs that would otherwise have
been caught months ago.

---

## 3. MEDIUM — Races, Edge Cases, UX Glitches

### M1. Structural-suggestions effect has stale closures + concurrent races
**File:** `src/lyra.jsx:371-406`

Dependency array is `[draft, appliedSkill]` but the effect body reads `topic`,
`typeLabel`, `examRules`, `trackCall`, `sugRoute` from closure. While draft
churns frequently in practice (keeping closures fresh), there are two real
issues:

1. **Concurrent in-flight requests.** When the user pauses, fires a 2.5 s
   timer, then types again to set a new timer, the *old* `setTimeout`'s
   `clearTimeout` cleans up only the *pending* timer; if the timer already
   fired and `callAI` is in flight, that request is not aborted. Two
   suggestions requests can resolve out-of-order: the late one overwrites
   `setSuggestions` with stale data, and `lastAnalysed.current` gets
   "rewound" to an older paragraph.
2. `lastAnalysed.current = lastPara` is set inside the async callback. If
   request A resolves *after* B, `lastAnalysed.current` ends up pointing
   to A's older paragraph, defeating the dedup guard.

**Fix:** Issue an `AbortController` per timer fire; in the callback, abort
the previous controller before starting a new request. Only set
`lastAnalysed.current` when the request "wins" (signal not aborted).

---

### M2. `stopChat` can double-add the message under a precise race
**File:** `src/lyra.jsx:505-516`, `TypewriterBubble.jsx`

If the user clicks "stop" in the *exact same React event-loop tick* in which
the typewriter naturally completes, both paths can run:
- `handleTypewriterDone` (fired by the bubble's `useEffect` when
  `done && !calledDone.current`) appends the message and nulls `typingMsg`.
- `stopChat` reads `typingMsg` from its stale `useCallback` closure (deps
  `[typingMsg]` recreated at most once per render), sees it as truthy,
  appends again.

The bubble's `calledDone` ref prevents that side from re-entering, but does
not prevent `stopChat`'s closure from seeing a stale value.

**Reproduces:** Long Lyra response, user holds the stop button as the
typewriter ends. Visible duplicate of the final message in the chat history.

**Fix:** Inside `stopChat`, do not trust the captured `typingMsg`. Use the
functional form: `setTypingMsg(prev => { if (prev) setMessages(...); return
null; })`. Single source of truth.

---

### M3. `loadWriting` resets some context but not all
**File:** `src/lyra.jsx:202-224`

Loading a saved writing clears `messages`, `suggestions`, `proofread`,
`appliedSuggestions`, `apiCalls` — but does NOT clear:

- `appliedSkill`
- `writingTechniques`
- `techsEnriching`
- `targetVoice`
- `extractedSkills`
- `proofTab`, `proofLoading`, `chatLoading`, `tab`, `sugBadge`

So switching from Writing A (with a deployed skill) into Writing B (saved
without one) leaves Skill A "deployed" in the UI and contaminates Writing
B's coaching with skill context that doesn't belong to it.

**Fix:** `loadWriting` should reset every writing-scoped piece of context
to either the loaded value or null. Easiest: extract a `freshWritingState()`
function used by both `loadWriting` and `resetToNew`.

---

### M4. `resetToNew` does not reset proof/chat UI flags
**File:** `src/lyra.jsx:268-292`

Same family as M3 but for the "New" button. Misses `proofTab`, `proofLoading`,
`sugBadge`, `chatLoading`, `tab`, `pendingSkillsOpen`, `showStyleLab`,
`showGrammarLog`. In practice you get into the new writing flow with
`tab === "preview"` or with a leftover proofread spinner.

---

### M5. The `setTimeout(..., 500)` in `onStart` is fragile timing
**File:** `src/lyra.jsx:692, 716`

```js
setScreen("app"); setTimeout(() => saveNewWriting("default", autoTitle), 500);
```

The 500 ms delay exists to let other state settle before persisting. But:
- If the user types within those 500 ms, the new writing is saved with
  `draft: ""` (because `saveNewWriting`'s closure captures the snapshot taken
  at onStart). 2 s later, autosave runs and overwrites with the latest draft.
  No final data loss but produces a momentary "empty draft" in the persisted
  store, which is visible if a crash/reload happens in that window.
- If the user clicks "New" again in <500 ms, the timer fires after the reset,
  saving the *old* writing into a *new* session.

**Fix:** Replace the timer with an explicit synchronous flow: call
`saveNewWriting` immediately, then `setScreen("app")`. The whole purpose of
the delay was to wait for state to settle but state propagates synchronously
within an event handler in React 18.

---

### M6. Welcome message useEffect has empty-but-effective deps
**File:** `src/lyra.jsx:346-359`

Dependency array is `[screen]`. The body reads `userName`, `sourceAnalysis`,
`appliedSkill`, `extractedSkills`, `writingTechniques`, `typeLabel`, `topic`,
`wcLabel`, `purpose`. The `typedWelcome.current` ref guards against
re-firing, so in practice it's idempotent — *but* if the screen-change effect
fires before async-loaded state (e.g. `userName` from
`window.storage.get("lyra-user-name")`) has resolved, the welcome will read
`""` and miss the greeting.

The current load path `setUserNameLoaded(true)` is decoupled from the screen
transition; `setScreen("app")` only happens after `onStart`, which only
happens after the user clicks Start. By then `userNameLoaded` is almost
certainly true. But "almost" is the bug-shape — on a slow first paint with
storage promise still pending, the user gets "Hello!" instead of "Hey
Foo!".

**Fix:** Guard the welcome effect on `userNameLoaded && projectsLoaded`, or
move the message construction inline into the entry path rather than into
an effect.

---

### M7. `applySkillWithEnrichment` overrides user-dismissed techniques
**File:** `src/lyra.jsx:527-590`

The function fires a follow-up "enrich" request 2-3 seconds after the user
applies a skill. If the user dismisses the technique strip during enrichment
(`× → setWritingTechniques(null)`), the enrich callback runs `prev ? [...prev,
...enriched] : enriched`. With `prev === null` it short-circuits to
`enriched`, so techniques *reappear* against the user's wishes.

**Fix:** Track whether the user has dismissed (`dismissedByUser` ref);
short-circuit the enrich `setWritingTechniques` when dismissed. Or pass an
AbortController through `applySkillWithEnrichment` and abort it on dismiss.

---

### M8. PEEL classification is called *before* `setAppliedSkill` is reflected
**File:** `src/lyra.jsx:527-558`

`applySkillWithEnrichment` does:
1. Build `techList` from the freshly passed `skill` (good).
2. `await callAI(...)` for role classification.
3. After the await, `setAppliedSkill(skill)` and
   `setWritingTechniques(techniquesWithRoles)`.

If the user clicks "Write with this skill" twice in rapid succession (or
applies skill A then B before the first await resolves), the second call's
classification will land second and **its `setWritingTechniques` overwrites
the first**, but the React state for `appliedSkill` ends up as whichever's
`setAppliedSkill` ran last — possibly a different one than the techniques
shown. Mismatched header label vs. techniques is visible to the user.

**Fix:** Increment a "request seq" ref; in the resolver, bail if the seq
no longer matches.

---

### M9. `parseProfileSections` runs on every partial during streaming, with
no early-exit
**File:** `src/components/SourceSetup.jsx:148-164`, also StyleLab

The streaming callback throttles to 400 ms but the parse itself is O(n) on
the entire accumulated text. As the analysis grows past 8 KB, each parse
re-walks all of it; combined with `setProfileSections(sections)` triggering
a re-render with all section cards, the UI gets janky on long analyses.

**Fix:** Parse incrementally (track byte offset of last fully-parsed section,
parse only the tail). Or memoise per-section content. Not urgent but easy
win when analyses scale up.

---

### M10. `parseTechniques` `slice(0, 5)` truncates enrichment silently
**File:** `src/utils.js:224`

`return techniques.length >= 1 ? techniques.slice(0, 5) : null;`

The enrichment request asks for exactly `missingRoles.length` techniques
(could be 1-4). The parser caps at 5. Today this is wider than the ask, so
no truncation occurs in practice. But if a future caller passes a larger
batch (e.g. 6 techniques), the 6th is silently dropped.

**Fix:** Drop the hardcoded 5 cap or pass the expected count as a parameter.

---

### M11. The mini-lesson ID `proof_${i}` collides across runs
**File:** `src/components/EditorTab.jsx:315`

`const fakeEntry = { id: "proof_" + i, ... };` — `i` is the React map index
of the grammar issue inside a single proofread. If the user runs proofread
twice, the second run uses the same indices 0..N-1, so the per-index
`miniLesson["proof_0"]` cached entry from the first proofread is reused
(stale content) for what is now a different grammar rule.

**Fix:** Use the persistent ID from the grammar log entry (`g.id`) or
salt with a per-run counter.

---

### M12. The structural-suggestion `lastAnalysed.current` comparison is
fragile
**File:** `src/lyra.jsx:377`

`if (lastPara === lastAnalysed.current) return;` — this is a strict string
compare. Any whitespace edit at the end of the paragraph re-triggers the
expensive call, including punctuation changes that don't merit re-analysis.

**Fix:** Normalise (collapse whitespace + lowercase) before comparing, or
hash to a stable digest.

---

### M13. `proxy.js` retry counter is off-by-one vs. documentation
**File:** `server/proxy.js:178-185, 232-242, 244-253, 309, 312`

Each retry path uses `if (attempt < 2) { ... callX(attempt + 1); }`. That
yields **2 total attempts** (initial + 1 retry). Docstrings in
`PROGRESS-REPORT.md` and `IMPROVEMENTS-REPORT.md` say "retries up to 4 times
with exponential backoff" (the elsewhere-described git push policy).
Production-facing comments in proxy say "retry with backoff" but no backoff
delay is applied — retries are immediate.

**Fix:** Either align the docs to "max 2 attempts, no backoff" or implement
a real backoff and bump the attempt cap to 3+. Don't ship with the
mismatch.

---

### M14. `learning-sync` deduplication is by leaf string only
**File:** `src/learning-sync.js:113-117, 135-139`

`names.has(s.name)` for structures and `words.has(v.strong)` for vocabulary
deduplicate on a single field. If the AI returns the same `strong` word but
a different `chinese` translation or `collocation`, the second entry is
dropped silently — the student loses the new context for an already-known
word.

**Fix:** Use a composite key (`strong + category` or `strong + collocation`)
or merge into the existing record rather than discarding.

---

## 4. LOW — Future-Risk & Style

### L1. `chatAbortRef` is never reset on component re-render
**File:** `src/lyra.jsx:42, 417, 493, 497, 506-508`

If a chat fetch is in flight and the user reloads the page (via
ErrorBoundary's reload, or navigates away), the AbortController is dropped
without aborting. Modern browsers will GC the in-flight request anyway, but
the proxy still sees the request and may rate-limit you for a no-op response.
Calling `chatAbortRef.current?.abort()` in a `useEffect` cleanup on the
top-level component would be defensive.

### L2. Stop/send button conflates loading vs. typing
**File:** `src/components/ChatTab.jsx:184-188`

Button is rendered as "stop" when `chatLoading || typingMsg`. But during
typewriter playback the underlying request is *done* — there's nothing to
abort. The visual still makes sense (the user is "stopping" the animation)
but the abort signal is a no-op past that point.

### L3. `TypewriterBubble` re-creates `useTypewriter` per message
**File:** `src/components/TypewriterBubble.jsx`, `ChatTab.jsx:121`

A new bubble (new key, fresh useTypewriter) starts for every typing message.
Fine in practice but it means the welcome typewriter and the response
typewriter cannot share progress — if you ever animate two streams at once
they'll drift.

### L4. `useTypewriter`'s `setInterval` ignores text changes mid-stream
**File:** `src/hooks.js:7-17`

The effect re-runs when `text` changes, but the existing interval is cleared
and a new one starts from `i = 0`. If the parent ever calls with an extended
text (streaming append), the typewriter restarts from the beginning. The
hook is only ever called with one final string, so this is dormant, but if
someone wires it to streaming partials it will be visibly broken.

### L5. `keyframes` is rendered as `<style>` tag inside the component tree
**File:** `src/lyra.jsx:729`

`<style>{keyframes}</style>` works but injects the same global CSS on every
render. React skips DOM updates if `dangerouslySetInnerHTML` value is
identical, but parsing/dedup still costs. Hoist to a one-time CSS injection
at module load.

### L6. `apiCalls` counter uses both ref and state without invariant
**File:** `src/lyra.jsx:31-36, 221-222, 289-290`

`apiCallRef.current` is the source of truth, `apiCalls` is a derived state
just for the header label. Multiple resets (`loadWriting`, `resetToNew`)
manually re-sync them. A single setter would be cleaner.

### L7. `parseProfileSections` parse is repeatedly run by both
SourceSetup.jsx and StyleLab.jsx
Same code path, called twice from independent components. Worth extracting
to a shared parsed cache.

### L8. `Onboarding` flow is dormant but still imported & rendered conditionally
**File:** `src/lyra.jsx:705-723`

`screen === "onboarding"` is set nowhere — `resetToNew` goes to
`"source-setup"`, fresh users go to `"source-setup"`, `loadWriting` goes to
`"app"`. The Onboarding branch is dead code, and yet the Onboarding component
is imported (cost in bundle and in mental load).

**Fix:** Delete the legacy onboarding branch and the corresponding component
unless there's a deferred plan to bring it back.

### L9. `addToDraft` doesn't track per-message state correctly for the
"✓ Added" badge
**File:** `src/components/ChatTab.jsx:104-113`

Badge state is stored on the message object via `setMessages(prev =>
prev.map(msg => idx === i ? { ...msg, addedToEssay: true } : msg))`. This
works, but the badge resets on `loadWriting` (which replaces messages from
disk where `addedToEssay` is not necessarily persisted). If the user wants
to re-add the same sentence, they get the badge for the second add. Minor.

---

## 5. Test Suite Findings

| File | Status | Notes |
| --- | --- | --- |
| `tests/api.test.js` | 5 fail / 7 total | Tests Anthropic API; code is Gemini. Replace entirely. |
| `tests/constants.test.js` | 22 pass | Healthy. |
| `tests/learning-sync.test.js` | 11 pass | Healthy. |
| `tests/prompts.test.js` | 37 pass | Healthy, but does NOT assert that `sourceContext` makes it into the prompt (relevant to H2). |
| `tests/lyra-brain.test.js` | 12 pass | Healthy. |
| `tests/translation.test.js` | 16 pass | Healthy. |
| `tests/titleGenerator.test.js` | 14 pass | Healthy. |

**Component coverage is zero.** Every async flow flagged above is invisible
to the suite. Adding tests for `applySkillWithEnrichment`, `sendChat` (with
mocked `callAI`), `stopChat` race, and the auto-save useEffect would catch
the medium-severity races in CI. `@testing-library/react` is not yet in
`package.json`; the `IMPROVEMENTS-REPORT.md` proposes adding it. That stands.

---

## 6. Proposed Fix Priority (Sprint-Sized)

A pragmatic sequence that yields the most safety per hour:

1. **(C1, 30 min)** Switch OCR to Gemini Vision via `/api/gemini`. Smallest
   blast-radius fix. Adds one prompt template, removes `api-patch.js`
   altogether if no other code path uses Anthropic.
2. **(C3 + H1, 20 min)** Numeric Writer IDs + escape regex metachars in
   `utils.js`. Two small functions; high payoff for the anti-bias
   guarantee.
3. **(H2, 1 h)** Wire `sourceContext` into structural + proofread. Add
   tests in `prompts.test.js` that assert the source block appears when
   `sourceContext` is passed. Move `ANTI_BIAS_BLOCK` into the same path
   (resolves H3).
4. **(C2, 1 h)** Rewrite `tests/api.test.js` against the Gemini contract.
   Now we have a non-red CI to land further changes against.
5. **(M3 + M4, 30 min)** Extract `freshWritingState()` and fix `loadWriting`
   / `resetToNew` to share it.
6. **(M2, 15 min)** Functional-form `setTypingMsg` in `stopChat`.
7. **(M5, 15 min)** Remove the `setTimeout(..., 500)` in `onStart`.
8. **(M1 + M7 + M8, 1.5 h)** Introduce a `requestSeq` ref pattern and apply
   it to the three concurrent-AI hotspots: structural, applySkill, enrich.
9. **(H4, 30 min)** Bound the four learning-log keys to N=500 entries each
   and surface quota errors.
10. **(H6, 1 h)** Pick one storage strategy and migrate all direct
    `localStorage` callers through it.
11. **(L8, 5 min)** Delete the unreachable Onboarding branch.

Everything else can ride future PRs.

---

## 7. Structural Recommendations

Reinforcing what `IMPROVEMENTS-REPORT.md` already proposed, with one
addition specifically motivated by this audit:

### 7.1 `lyra.jsx` needs a reducer
34 `useState` hooks → 5 reducers (editor, chat, proof, project, ui). The
reducer makes the resets in `loadWriting` / `resetToNew` literally a
single dispatch instead of 15 manual setters — eliminates M3 and M4
permanently.

### 7.2 Add a `useAIRequest` hook
Wrap `callAI` + AbortController + request-sequence + error logging once,
then use it from every async path. The current hotspots
(`sendChat`, `runProofread`, `applySkillWithEnrichment`,
`fetchMiniLesson`, structural-suggest effect) all roll their own
abort/race/error handling inconsistently. A shared hook fixes M1, M2,
M7, M8 in one stroke and adds testable seams.

### 7.3 Move all `ANTI_BIAS_BLOCK` injection into the prompt builders
Today the chat flow adds it via string concatenation in `sendChat`; the
proof and structural flows don't add it at all. Have each prompt builder
decide whether to include the block based on whether `activeSkillCtx`
(or similar) is non-null. Single point of policy.

### 7.4 Define a storage gateway and forbid direct `localStorage` from
components
ESLint rule: `no-restricted-globals: ["error", "localStorage"]` outside
of `src/storage-shim.js`. Removes the H6 class of bugs by construction.

---

## 8. Findings Not Reproduced / Not Confirmed

Items the Explore audit flagged that I could not fully verify in this pass
and that deserve a second look before being acted on:

- **TrainingSession line refs** (M-grade): I read only enough of
  `TrainingSession.jsx` to know it exists; the missing-dependency and
  cleanup concerns came from secondary analysis and need a direct read
  before fix. Treat the relevant items in §3 as "high-confidence
  hypotheses, verify before implementing."
- **DataExport JSON null handling**: similarly inferred; verify the
  defensive checks once before patching.

---

## 9. What This Audit Did Not Cover

- Accessibility / ARIA / keyboard navigation (called out as P2 in the
  existing reports; not a "logic" concern).
- Bundle size, code splitting.
- Visual regression / styling consistency.
- Cross-browser behaviour of the SSE streaming path (works in Chromium-
  family; iOS Safari is anecdotally flakier with long-running SSE).
- Privacy / PII handling beyond the anti-bias system. Source text and
  draft are sent to a third-party model in cleartext.
- The actual quality of the Gemini coaching responses (subjective).
- Server-side hardening of `proxy.js` (no auth, no abuse protections
  beyond rate limit, key loaded from `.env` without rotation).

---

*End of analysis. Next step: open issues / PRs against the items in §6.*

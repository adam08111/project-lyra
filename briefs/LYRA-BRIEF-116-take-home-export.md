# LYRA-BRIEF-116 — Take-home export (custodian #4, the student's own copy)

**Kickoff line (the maintainer types this into a fresh Claude Code session, nothing else):**
`Execute briefs/LYRA-BRIEF-116-take-home-export.md. Ratified D-O1–O5.`
Do not begin without the ratification token. One brief = one cold session = one § entry =
one FF landing; the docs/log commit is the **FINAL tip** (CLAUDE.md #2, D-S2).

> Written 16 July 2026 against §126 (677 green; landed origin/main sha per the maintainer's
> hand-off report). Expect **§127**; **no migration, no AI call, client-side only.** This
> file **supersedes** the §122-era BRIEF-116 canonical in `briefs/` (it predates §121–§126:
> the recovery surface, the FINAL-TIP and failed-lens rules, and the export-posture
> decisions below). Step 0 handles the replacement.

---

## 1 · Context — read before touching anything

**Custodian #4 closes the durability story from the student's side.** #1 is her device
(localStorage, authoritative), #2 is the Supabase mirror (+ PITR on Pro), #3 is the §125
offsite encrypted dump. #4 is the copy that answers a different failure mode entirely:
*Lyra itself* going away — the unpaid-invoice future, a lost account, the end of a school
year. A 14-year-old should be able to press one button and walk away with her essays and
her growth story in a file that opens on any computer, forever, with no Lyra, no account,
no internet. That is also, quietly, the PDPO data-portability story and the natural
companion to the future erasure procedure (export, then erase).

**Why it's a real brief and not a utility function:** an export is a **render surface**.
Everything the student ever typed gets interpolated into a document that a browser will
parse — her own `<script>` joke in an essay about coding must come out as inert text
(self-XSS is still XSS). And an export is a **leak surface**: it must contain her work and
nothing else — never the recovery code, never an identifier she doesn't already see.
SECURITY.md's standing line — *CSV/XLSX export is deferred until spreadsheet
formula-injection neutralization ships* — is a constraint this brief routes around rather
than solves (D-O2): no spreadsheet formats in v1, so Class D item 2 stays parked with the
future teacher export where it belongs.

## 2 · Decisions — do NOT relitigate

- **Local-first is law** (DATA-ARCHITECTURE): localStorage is authoritative; sync is a
  mirror. The export must work in the flag-OFF build.
- **Counts-only logging; the recovery code never travels** (§87/§88/§121): nothing in this
  brief logs, renders, or embeds the code, its hash, or `RECOVERY_CODE_KEY`'s content.
- **Never-stuck** (#7): export always resolves — a file, an honest empty state, or a
  visible error. No spinner, no silent nothing.
- **Mobile-first** (#9): the trigger lives in the Sidebar at 430px; EditorTab and every
  overlay are untouched (this brief has no business in the editor).
- **Pedagogy is law** (#10): no brain/prompt contact of any kind.
- **Process law**: Karpathy discipline; FF-only, same-session approval, FINAL-TIP (D-S2);
  a degenerate review lens is a failed lens (D-S3); § = tip+1 at Step 0; stop-and-report
  beats improvising.

## 3 · New decisions this plan sets — RATIFY BEFORE EXECUTING

- **D-O1 — Scope: what the student already sees, from the device, enriched when sync is on.**
  The export composes client-side from the on-device corpus — her drafts/essays, learning
  history, and her growth report **as shown to her in-app**. When sync is ON, it *adds* her
  `writing_snapshots` + `report_snapshots` history via her existing RLS reads; when OFF or
  unreachable, the export still succeeds and **states what it contains**. Teacher-only
  derived fields (`bandEstimate`) are **excluded** — the export mirrors the in-app boundary;
  a formal PDPO access request is a documented future procedure, not this button. **No
  import/restore in v1.**
- **D-O2 — Format: ONE self-contained `.html` file.** Human-readable, printable, zero
  external resources (opens offline forever), filename `lyra-my-work-YYYY-MM-DD.html`, with
  an embedded machine-readable JSON island (`<script type="application/json">`) so a future
  import brief has something honest to read. **No CSV/XLSX in v1** — spreadsheet
  formula-injection (Class D item 2) stays entirely off this surface.
- **D-O3 — The export is a render surface.** Every interpolated string — essay text,
  titles, rule labels, feedback, display name — is HTML-escaped at composition; zero inline
  event handlers; zero remote fetches. A characterization test injects `<script>`,
  `<img onerror>`, and `javascript:` through essay/label/name fields and asserts the
  composed document contains only inert text (and that the JSON island can't break out —
  escape `</script` sequences inside it).
- **D-O4 — Exclusion list, asserted by test.** The composed output NEVER contains: the
  recovery code or its hash, `RECOVERY_CODE_KEY` storage content, auth/student UUIDs,
  class codes, Supabase URL/keys, or any other student's anything. Her display name and
  her content only.
- **D-O5 — Placement + availability.** One Sidebar action ("Take your work home"),
  available flag-OFF (custodian #4 must not depend on custodian #2), synchronous
  generation via Blob + anchor download, honest empty state when the corpus is empty.
  iOS-Safari download behaviour is an explicit **operator** manual check (known quirk
  territory), with open-in-new-tab as the documented fallback if Step 0 finds `download`
  unsupported in the target browsers.

## 4 · Steps

### Step 0 — verify the world (stop-and-report on ANY mismatch)

1. `git fetch`; worktree = `origin/main`; record the inherited tip. **First steady-state
   test of the FINAL-TIP rule:** the inherited tip must be §126's docs/log commit exactly —
   if anything sits after it, stop-and-report (that's a rule breach, not a nuisance).
   Later-tip tolerance: only §s touching none of Sidebar, storage modules, `briefs/`, docs.
2. Confirm THIS file exists at `briefs/LYRA-BRIEF-116-take-home-export.md`; the §122-era
   116 canonical is **replaced by this file** in the landing commit (record the
   supersession in the § entry; stop-and-report if it contains a *ratified* D-number this
   brief contradicts).
3. Read and record: the localStorage schema (which keys hold drafts/essays, learning
   history, growth profile — names and shapes, `file:line`), the Sidebar component and its
   §121 recovery trigger (placement precedent), the flag-on read paths for the two snapshot
   ledgers (RLS SELECTs the client already performs), `RECOVERY_CODE_KEY` and every
   identifier the exclusion test must assert against, and any existing download/Blob
   utility (single source of truth — don't write a second one).
4. Confirm the student-visible growth-report shape vs the teacher-only fields (where
   `bandEstimate` lives) so D-O1's exclusion is mechanical, not guessed.
5. Preflight: 677 green at the inherited tip; `vite build` clean (both entries).

### Step 1 — the composer (pure, testable)

`src/export/compose.js` (or per repo convention): `(corpus) → htmlString`. Pure function,
no DOM, no globals: sections for essays/drafts (each with date + title), the learning
story (rule-frequency summary in student-plain language), the growth report as shown
in-app, and — when present — the snapshot histories with dates. An escape helper applied
to **every** interpolation (reuse an existing one if Step 0 found it; SSoT). The JSON
island carries the same corpus, `</script`-safe. A visible header: what this file is,
the export date, and what it contains/omits (honest-contents line, D-O1).

### Step 2 — gathering (local + graceful enrichment)

`src/export/gather.js`: read the local corpus; if sync is on, attempt the two ledger
reads with a short timeout and **fold failures into "not included" honestly** — the export
never fails because the network did. Returns `{corpus, included, omitted}` for the
composer's contents line. Never touches teacher storage keys; runs entirely under the
device's own session (the D-M5 lens statement in the review names these bindings).

### Step 3 — the Sidebar action

"Take your work home" → generates synchronously → Blob + anchor download with the D-O2
filename → success confirmation naming the file; empty corpus → the honest empty state;
any thrown composition error → visible error + retry (never-stuck). 430px checked.

### Step 4 — tests (expect ~8–12 new)

Composer: determinism on a fixture corpus; the D-O3 injection characterization (all three
payloads, all interpolated fields, JSON-island breakout); the D-O4 exclusion assertions
(seed a fake recovery code/UUIDs/class code into storage-shaped fixtures → absent from
output); the honest-contents line reflects `included/omitted`; empty-corpus path. Gather:
flag-off skips cleanly; simulated read failure → `omitted`, no throw. UI: action renders,
empty state, error state.

### Step 5 — docs (same landing)

`DATA-ARCHITECTURE.md` §4: custodian #4 → BUILT §127 (wording mirrors #3's §125 flip).
`SECURITY.md`: a short take-home-export paragraph — render-surface posture (D-O3), the
exclusion list (D-O4), why no CSV/XLSX (Class D item 2 stays with the future teacher
export). `CHECKPOINTS`: tick C4; note PRV as next in Lane C. `PROGRESS-REPORT` §127 with
both shas; the docs/log commit is the FINAL tip.

### Step 6 — review (before landing; D-S3 applies)

Three lenses, verify-before-fix: **(1) injection/leak adversarial** — actively try to get
live markup or any D-O4 item into the composed file (including via the JSON island);
**(2) cross-surface/identity (D-M5)** — state the session and storage bindings of every
new read path; confirm nothing reads or writes teacher keys and the export can never
include another identity's rows; **(3) scope/never-stuck/docs** — no editor contact, no
drive-bys, every UI path resolves, docs match code.

## 5 · Manual verification (OPERATOR — phone in hand, synthetic corpus only)

iPhone Safari + Android Chrome: export → file downloads (or documented fallback) → opens
offline → readable, printable; a hostile-text essay (`<img onerror>` typed as content)
renders as literal text in the exported file; flag-OFF build exports; flag-ON export's
contents line names the snapshot histories; text-search the file for the device's actual
recovery code and student UUID → absent; empty fresh profile → honest empty state.

## 6 · Out of scope — name it, don't do it

Import/restore (future brief; the JSON island is its down-payment); CSV/XLSX anywhere;
the teacher export (Phase B, still gated on formula-injection neutralization); PDF;
auto/scheduled export; the erasure procedure (Lane D — but the § entry notes the pairing);
the proofread-visibility micro-brief (PRV — next in Lane C); any prompt or editor change.

## 7 · Karpathy close

Read the storage modules before believing this brief's names for them. Smallest diff;
one commit per batch; the composer stays pure so the tests stay honest. The planner's
claims are hypotheses — Step 0's reading wins, and stop-and-report beats improvising.
Land fast-forward; the docs/log commit is the final tip; leave the § entry more useful
than this brief.

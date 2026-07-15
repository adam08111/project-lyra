# BRIEF §107 — Teacher dashboard v1: read-only roster → rules → growth

> Self-contained executor brief. Requires §106 landed (migration 0005 applied, teacher
> sign-in working, synthetic class seeded). One session, one § entry, one FF landing.

## Context

§106 gave teachers identity and read-rights. This brief gives them the view — the CIP
demo artifact: sign in → class roster → per-student detail (rule frequency, growth
profile, activity counts). **Read-only. Synthetic data only.** This is the first surface
in Lyra where one person's typed text renders inside a *different, more privileged*
person's session — §103's Class D checklist exists precisely for it and is consumed here
in full.

## Decisions — do NOT relitigate

Everything in §106's list, plus: teachers read `learning_events` + `growth_profiles`
only (no `blobs`, no `students`); display names come from `enrolments.display_name`;
separate Vite entry; no student-app UI change.

## New decisions this brief sets — RATIFY before executing

- **D-B1 `bandEstimate` renders, teacher-side only, labelled "estimate".** It was stored
  dual-audience from day one and its display was gated *awaiting exactly this surface*
  (§-log, Report-tab arc). `report-card-brain.js` is authoritative for the profile
  schema — read it in Step 0; render what it defines, invent nothing.
- **D-B2 Rule labels render as stored.** Until the rule-label brief (§108) lands, cells
  may read the §70 fallback ("Grammar fix"). Do not relabel in the view — the fix is
  prompt-side, not display-side.
- **D-B3 Desktop-first.** Teachers are on staff machines; the 430px mobile constraint is
  a student-app rule and does not bind here. Keep it responsive-sane, nothing more.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).** Read `CLAUDE.md`, § tip
(expected §106 → this is §107), the §103 log entry's **Class D field inventory and
checklist** (in `PROGRESS-REPORT.md` — it lists exactly which event/profile fields carry
raw student text), `report-card-brain.js` (profile schema), the `student_rule_frequency`
view definition in 0001, and §106's actual landed shapes.

**Step 1 — data layer (`src/teacher/queries.js`).** Three read functions on the existing
client: `myClasses()` (classes + enrolment counts), `roster(classId)` (enrolments with
display_name + per-student event counts by type), `studentDetail(studentId)` (rule
frequency — via the view or a grouped query, whichever Step 0 finds cleaner under
teacher RLS; growth profile row; recent-activity counts by week). All failure paths
resolve to an honest empty/error state (#7) — never a spinner.

**Step 2 — views.** `Roster.jsx` (class picker if >1, table of display_name + counts) →
`StudentDetail.jsx` (rule-frequency table, growth-profile card incl. bandEstimate
labelled "estimate", activity summary). Plain tables; no charts in v1.

**Step 3 — Class D, enforced not assumed.**
- Every field renders through React default escaping. `dangerouslySetInnerHTML` and any
  `innerHTML` are FORBIDDEN in `src/teacher/` — add a test that greps the directory for
  both and fails on a hit.
- Treat `payload` jsonb as hostile at any depth; render only whitelisted fields the
  Step-0 inventory names, as text.
- URLs in any field render as plain text (no anchor) in v1.
- No CSV/XLSX export in v1 (formula-injection handling is the documented reason —
  Class D item 2 — deferred with a note in the § entry).
- Characterization test: seed a hostile string (`<img src=x onerror=alert(1)>` and a
  `javascript:` URL) into a mock event's rule/topic/payload; render with the §104
  happy-dom harness; assert the DOM contains the *escaped* text and no `img`/script
  node materialized.

**Step 4 — tests.** The Class D tests above + query-shape tests (mocked client) + empty
states (no classes / empty class / student with no profile). Full suite green.

**Step 5 — docs + landing.** § entry (§107) — include a "Class D consumed" line item —
tip sha stated, commits listed, FF-land, record the sha. `SECURITY.md`: one paragraph —
the dashboard exists, is read-only, escapes everything, export deferred. Re-run
`npm run redteam -- --dry-run` (free) to confirm the harness still assembles; a live
red-team re-run remains required before the CIP demo per SECURITY.md — note it, don't
run it here.

## Manual verification (Adam)

1. Sign in → roster shows the 8 synthetic students → open one → rules, growth card with
   band estimate, activity counts all render.
2. Poison probe: insert one synthetic `learning_events` row whose `rule` is
   `<b>bold?</b><script>x</script>` via SQL editor → reload detail → renders as literal
   text, no formatting, no script.
3. Second teacher account sees an empty state, not an error, not data.
4. Student app: open, write, proofread — unchanged; suite count reported.

## Out of scope

Everything §106 excluded, plus: charts, exports, filters/search, write actions,
multi-teacher class sharing, headmaster/aggregate rollups (Phase B+).

## Karpathy close

Smallest diff. Commit per unit (queries / roster / detail / Class D tests / docs). The
Class D checklist is the law of this surface: if a field isn't on the Step-0 inventory
as safe-to-render, it doesn't render. Land FF, record the sha. Repo wins.

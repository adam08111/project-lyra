# BRIEF §106 — Teacher foundation: migration 0005 + teacher sign-in + synthetic seed

> Self-contained executor brief. Cold Claude Code session with repo access can run this.
> One session, one § entry, one FF landing on `origin/main`, sha recorded.

## Context

Lyra's P0 student data platform is complete and live-proven (§95–§105, §101.1): anonymous
per-device student identity, RLS from migration zero, Layer-2 learning-event mirror,
Layer-1 blob durability, recovery via `claim_student`. Migrations `0001`–`0004` exist and
are applied. **529 tests green.** Students never log in and that does not change here.

This brief lands the first **teacher** surface's foundation: the additive schema
(schools / teachers / classes / enrolments), teacher-read RLS, a minimal teacher sign-in
entry, and an operator seed script for a synthetic demo class. The dashboard *view* is the
next brief (§107). Purpose: the CIP demo artifact (deadline 3 Aug 2026).

## Decisions — do NOT relitigate

- Local-first student model, anonymous student auth, and `claim_student` are untouched.
- Migrations are additive only; `0001`–`0004` are never edited.
- **ZERO `src/lyra.jsx` contact.** No proxy / router / brain / judgment change.
- No `service_role` in anything committed or bundled (operator seed script reads it from
  local env only — see Step 5).
- Demo data is synthetic only. Never real minors' data in application materials.
- CLAUDE.md non-negotiables apply in full (Karpathy, push discipline, single source of
  truth, never-stuck, sha recorded in § entry and close-out).

## New decisions this brief sets — RATIFY before executing

- **D-A1 Teacher auth = Supabase email + password, operator-provisioned.** No self-serve
  sign-up page, no invite flow (Phase B). Adam creates the teacher's auth user (dashboard
  or the seed script's admin call); a `teachers` row maps it. Not magic-link in v1:
  school mail filtering and shared staff machines make links flaky.
- **D-A2 Schema shape.** `schools` (tenant reservation — one table now, painful retrofit
  later), `teachers(auth_user_id unique → auth.users)`, `classes(teacher_id, school_id
  nullable, name)`, `enrolments(class_id, student_id, display_name, unique(class_id,
  student_id))`. **Roster display names live on the enrolment row** (teacher/seed-entered)
  — teachers never read the `students` table and never read student-typed blobs.
- **D-A3 Teacher-read RLS = SELECT-only on `learning_events` + `growth_profiles`** via an
  EXISTS join through enrolments→classes→teachers on `auth.uid()`. Policies are
  permissive (OR'd), so adding these does NOT weaken student isolation. **No teacher
  access to `blobs`** — teachers see learning identities and growth, never raw writings.
  `student_rule_frequency` is `security_invoker=on`, so it works for teachers
  automatically once the table policies exist.
- **D-A4 Surface = separate Vite entry** (`teacher.html` → `src/teacher/`), same origin,
  behind the existing Basic-Auth gate and CORS posture. The student app's bundle and
  routing are untouched.
- **D-A5 Enrolment UX deferred.** Phase A rosters are seeded. The class-code vs
  link-code decision (and the verify-without-repointing `enrol_student` RPC — never
  `claim_student`, which is identity transfer) is Phase B.

## Steps

**Step 0 — verify reality (STOP-AND-REPORT if it differs).**
Read `CLAUDE.md`, the `PROGRESS-REPORT.md` tip (expected §105 + §101.1 — this entry is
tip+1, expected §106), `SECURITY.md`, `DEPLOY.md`. Read `supabase/migrations/0001`–`0004`
in full and confirm against this brief's assumptions: `students(id, auth_user_id,
recovery_code_hash, …)`; `learning_events(student_id, type, content_key, rule, technique,
topic, payload, ts …)`; `growth_profiles` keyed by student with `last_regen_at`;
`current_student_id()` security-definer pattern; the `0003` lesson (pgcrypto lives in the
`extensions` schema — pin `search_path = public, extensions` or schema-qualify) and the
`0004` anon-revoke pattern. Confirm `vercel.json` + Vite config tolerate a second HTML
entry. If any column name or policy shape differs from the SQL below, STOP and report —
the repo wins.

**Step 1 — `supabase/migrations/0005_teachers.sql`** (authored in-repo; Adam applies via
SQL editor, same as 0001–0004). Draft below — Step 0 adapts names to reality:

```sql
-- 0005: teacher foundation (additive). schools reserved as tenant.
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id),
  display_name text not null,
  school_id uuid references schools(id),
  created_at timestamptz not null default now()
);
create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id),
  school_id uuid references schools(id),
  name text not null,
  created_at timestamptz not null default now()
);
create table enrolments (
  class_id uuid not null references classes(id),
  student_id uuid not null references students(id),
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index enrolments_student_idx on enrolments(student_id);
create index classes_teacher_idx on classes(teacher_id);

alter table schools enable row level security;
alter table teachers enable row level security;
alter table classes enable row level security;
alter table enrolments enable row level security;

create or replace function current_teacher_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select id from teachers where auth_user_id = auth.uid() $$;

create policy teacher_self on teachers for select to authenticated
  using (auth_user_id = auth.uid());
create policy teacher_own_classes on classes for select to authenticated
  using (teacher_id = current_teacher_id());
create policy teacher_own_enrolments on enrolments for select to authenticated
  using (exists (select 1 from classes c
                 where c.id = enrolments.class_id
                   and c.teacher_id = current_teacher_id()));
create policy teacher_school on schools for select to authenticated
  using (exists (select 1 from teachers t
                 where t.school_id = schools.id
                   and t.auth_user_id = auth.uid()));

-- teacher READ on student learning data (SELECT only; blobs deliberately excluded)
create policy teacher_read_events on learning_events for select to authenticated
  using (exists (select 1 from enrolments e join classes c on c.id = e.class_id
                 where e.student_id = learning_events.student_id
                   and c.teacher_id = current_teacher_id()));
create policy teacher_read_profiles on growth_profiles for select to authenticated
  using (exists (select 1 from enrolments e join classes c on c.id = e.class_id
                 where e.student_id = growth_profiles.student_id
                   and c.teacher_id = current_teacher_id()));

-- 0004 lesson: explicit least-privilege grants; then re-assert anon revoke
grant select on schools, teachers, classes, enrolments to authenticated;
revoke all on schools, teachers, classes, enrolments from anon;
revoke all on function current_teacher_id() from anon, public;
grant execute on function current_teacher_id() to authenticated;
```

**Step 2 — `src/teacher/` entry.** `teacher.html` at repo root; `src/teacher/main.jsx` +
`TeacherApp.jsx`: email+password sign-in via the existing Supabase client module
(`getSupabase()` reused — Step 0 confirms its export), signed-in state showing "signed in
as {display_name} — roster loads in §107", sign-out. Never-stuck (#7): every auth call
resolves to content, an honest error, or retry. No student-app import beyond
`supabase-client.js`.

**Step 3 — Vite/Vercel wiring.** Add the second input to `vite.config` rollup options;
verify `vercel.json` serves it; the Basic-Auth `middleware.js` already covers all paths —
confirm, don't assume.

**Step 4 — tests.** Mocked-client tests for the teacher auth module (sign-in success /
failure / signed-out states). A migration-shape test is not possible offline — the RLS
proof is Manual verification below. Full suite must stay green (529 + new).

**Step 5 — `scripts/seed-synthetic-class.mjs`** (operator-run, never bundled): reads
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from local env only; refuses to run unless
`LYRA_SEED_CONFIRM=SYNTHETIC`. Creates 1 school, 1 teacher auth user (prints credentials
once), 1 class, N=8 synthetic students (admin-created anon users → `students` rows), and
realistic `learning_events` / `growth_profiles` rows across several rules and dates.
Idempotent by name-keys. `.gitignore` check: no key can land in git.

**Step 6 — docs + landing.** § entry (§106) with the sha convention: state the tip sha
Step 0 found, list commit shas, land FF on `origin/main`, record the new sha in the
close-out. `DEPLOY.md` gains a short "Teacher panel (Phase A)" section (apply 0005; run
seed; teacher URL). `SECURITY.md` gains one line: new privileged surface, Class D applies
(§107 consumes the checklist).

## Manual verification (Adam, sub-5-min each)

1. Apply 0005 in the SQL editor; re-run the §95-era smoke: student app still boots,
   `lyraSync.status()` unchanged, one coaching turn still mirrors.
2. Run the seed; sign in at `/teacher.html`; signed-in state renders.
3. RLS proof: as the teacher, `select count(*) from learning_events` returns only the
   synthetic class's rows; a second teacher account (no classes) returns zero; a student
   browser session is completely unaffected.
4. Confirm teachers cannot select from `blobs` (should error / zero rows by policy
   absence + grant absence — check which, report).

## Out of scope

The dashboard view (§107). Enrolment UX and `enrol_student` RPC (Phase B). Invite /
self-signup. Any write path for teachers. CSV export. Student accounts. Recovery screen.
Any `lyra.jsx` change. Real student data anywhere.

## Karpathy close

Read first. Smallest diff that lands the foundation. Commit per unit (migration / entry /
wiring / tests / seed / docs). Push, FF-land, record the sha in the § entry and the
close-out. If reality disagrees with this brief at any point: stop and report — the repo
wins, always.

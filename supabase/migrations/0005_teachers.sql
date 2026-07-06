-- Lyra — migration 0005: teacher foundation (§106). ADDITIVE only.
--
-- Lands the first TEACHER surface's data layer: schools / teachers / classes /
-- enrolments, plus SELECT-only teacher-read RLS on the existing learning_events +
-- growth_profiles. The student data model (0001–0004) is UNTOUCHED — this only ADDS
-- tables, one helper function, and permissive (OR'd) read policies, so student
-- isolation is not weakened. Authored in-repo as the schema's SINGLE SOURCE OF TRUTH;
-- APPLY MANUALLY via the Supabase SQL editor AFTER 0004 (no CLI/network assumed).
--
-- Security model (mirrors 0001): teachers sign in with email+password → the
-- `authenticated` role (same role students reach via signInAnonymously), so RLS is the
-- authority. A teacher has NO students row → current_student_id() is null → the student
-- self-policies never match for them; a student has NO teachers row → current_teacher_id()
-- is null → the teacher-read policies never match for them. The two identities are cleanly
-- separated by which id-resolver returns non-null. service_role is never used client-side.
--
-- Deliberately EXCLUDED: teachers get NO access to `blobs` (raw student writings) — not
-- granted, not policied. Teachers see learning identities + growth, never the raw drafts.

-- ── tenant + roster tables ───────────────────────────────────────────────────
-- `schools` is reserved as the tenant now (one table today; a painful retrofit later).
create table schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- One row per teacher, mapped 1:1 to a Supabase auth user (operator-provisioned; D-A1).
create table teachers (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  school_id    uuid references schools(id),
  created_at   timestamptz not null default now()
);

create table classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  school_id  uuid references schools(id),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Roster display names live on the ENROLMENT row (teacher/seed-entered), so teachers
-- never read the `students` table and never see student-typed identity. PK doubles as
-- the unique(class_id, student_id) guard (a student enrols in a class at most once).
create table enrolments (
  class_id     uuid not null references classes(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index enrolments_student_idx on enrolments (student_id);
create index classes_teacher_idx    on classes (teacher_id);

-- ── caller → teacher id (mirror of current_student_id) ───────────────────────
-- SECURITY DEFINER so the read policies below can call it WITHOUT recursing into
-- teachers' own RLS; search_path pinned to public (touches only the public teachers
-- table — no pgcrypto/extensions dependency, unlike claim_student per the 0003 lesson).
create function current_teacher_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from teachers where auth_user_id = auth.uid()
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table schools    enable row level security;
alter table teachers   enable row level security;
alter table classes    enable row level security;
alter table enrolments enable row level security;

-- Teachers see only their own graph. All SELECT-only (no teacher write path in Phase A).
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

-- Teacher READ on the student learning data. PERMISSIVE policies are OR'd with the
-- existing student self-policies from 0001, so adding these grants teachers a read path
-- WITHOUT widening what any student can see. SELECT only; blobs intentionally absent.
create policy teacher_read_events on learning_events for select to authenticated
  using (exists (select 1 from enrolments e join classes c on c.id = e.class_id
                 where e.student_id = learning_events.student_id
                   and c.teacher_id = current_teacher_id()));
create policy teacher_read_profiles on growth_profiles for select to authenticated
  using (exists (select 1 from enrolments e join classes c on c.id = e.class_id
                 where e.student_id = growth_profiles.student_id
                   and c.teacher_id = current_teacher_id()));
-- NOTE: student_rule_frequency (0001) is security_invoker=on, so it runs under the
-- querying teacher's RLS and starts returning their students' rows the moment
-- teacher_read_events exists — no view change, and 0001 already granted it to
-- authenticated. learning_events + growth_profiles already carry SELECT grants from
-- 0001, so teacher-read needs only the new policies above, no new table grants there.

-- ── Table privileges (0001-style: RLS picks rows, GRANT permits touching the table) ──
grant select on schools, teachers, classes, enrolments to authenticated;

-- ── Re-assert the 0004 anon lockout for the objects 0005 adds ─────────────────
-- 0004 already revoked default privileges from anon, so new objects inherit no anon
-- grant — but state it explicitly, matching 0004's belt-and-suspenders least-privilege.
revoke all     on schools, teachers, classes, enrolments from anon;
revoke all     on function current_teacher_id()           from anon, public;
grant  execute on function current_teacher_id()           to authenticated;

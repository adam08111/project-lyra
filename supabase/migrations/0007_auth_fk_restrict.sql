-- Lyra — migration 0007: sever the auth.users kill-chain (BRIEF-FK). CONSTRAINT SWAP ONLY.
--
-- THE DEFECT (CONFIRMED P0, from the DATA-ARCHITECTURE review). Two tables reference auth.users
-- with ON DELETE CASCADE, and students(id)/teachers(id) are themselves CASCADE parents of every
-- learning/roster table. So deleting ONE auth user — Supabase's published cleanup of anonymous
-- users inactive >30 days (a Hong Kong summer exceeds that), or an operator slip — silently
-- destroyed a whole subtree:
--   students.auth_user_id  -> auth.users  CASCADE (0001:20)  => learning_events (0001:38) +
--                                                               growth_profiles (0001:55) +
--                                                               blobs/essays (0001:63) +
--                                                               writing_snapshots (0006:23) +
--                                                               enrolments (0005:50)
--   teachers.auth_user_id  -> auth.users  CASCADE (0005:31)  => classes (0005:39) => enrolments (0005:49)
--
-- THE FIX — sever the FIRST link only; flip BOTH auth.users edges to ON DELETE RESTRICT. The
-- dangerous deletion now FAILS LOUDLY (the correct failure mode) instead of silently destroying
-- data. RESTRICT, not SET NULL: auth_user_id is a MANDATORY identity link (NOT NULL stays — no
-- null-auth orphans, RLS predicate `auth_user_id = auth.uid()` untouched); RESTRICT makes the
-- dangerous op impossible rather than merely survivable. (Supersedes the SET NULL draft of this
-- migration per BRIEF-FK's ratified D-J1; see §115.)
--
-- SEGMENT TWO — the students/teachers CHILD cascades (learning_events, growth_profiles, blobs,
-- writing_snapshots, enrolments; classes->teachers, enrolments->classes) are BY DESIGN and KEPT:
-- claim_student's empty-caller cleanup (`delete from students where id = v_mine`) relies on the
-- subtree cascading, and the future PDPO erasure procedure will too. To legitimately delete an
-- identity now, delete the child (students/teachers) row FIRST (subtree cascades), THEN the auth
-- user. No rows touched, no app-code change, no policy/grant change. Apply AFTER 0006.

-- students.auth_user_id: CASCADE → RESTRICT. Look the FK up by column (robust to the auto-name).
do $$
declare fk_name text;
begin
  select con.conname into fk_name from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
   where con.conrelid = 'public.students'::regclass and con.contype = 'f' and att.attname = 'auth_user_id';
  if fk_name is null then raise exception 'students.auth_user_id foreign key not found'; end if;
  execute format('alter table students drop constraint %I', fk_name);
end $$;
alter table students
  add constraint students_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete restrict;

-- teachers.auth_user_id: same swap. Teachers are email users (not anon-pruned), but an operator
-- deleting a teacher's auth user would cascade away their classes + enrolments — restrict it too.
do $$
declare fk_name text;
begin
  select con.conname into fk_name from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
   where con.conrelid = 'public.teachers'::regclass and con.contype = 'f' and att.attname = 'auth_user_id';
  if fk_name is null then raise exception 'teachers.auth_user_id foreign key not found'; end if;
  execute format('alter table teachers drop constraint %I', fk_name);
end $$;
alter table teachers
  add constraint teachers_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete restrict;

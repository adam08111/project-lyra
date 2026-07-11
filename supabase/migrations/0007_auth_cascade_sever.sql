-- Lyra — migration 0007: sever the auth.users → students cascade (P0 data-loss fix).
--
-- THE DEFECT. students.auth_user_id was `references auth.users(id) ON DELETE CASCADE` (0001:20).
-- Deleting the auth.users row — e.g. Supabase's automatic cleanup of anonymous users inactive
-- for >30 days, and a Hong Kong summer holiday exceeds 30 days — cascade-deleted the students
-- row AND, transitively (students(id) is the CASCADE parent of every learning table), every
-- learning_event / growth_profile / blob (the essays) / enrolment for that student. A single
-- auth deletion silently annihilated a student's entire record. This is the exact durability
-- failure the platform exists to prevent (confirmed in code; DATA-ARCHITECTURE.md §7.1 P0).
--
-- THE FIX — sever the FIRST edge only. Flip students.auth_user_id's on-delete from CASCADE to
-- SET NULL: a purged/deleted auth user DETACHES the student row (auth_user_id → NULL) instead
-- of destroying it. The data survives, orphaned-but-recoverable via the written-down recovery
-- code (claim_student re-points auth_user_id by recovery_code_hash). The CHILD cascades
-- (students → learning_events / growth_profiles / blobs / enrolments) are KEPT DELIBERATELY —
-- claim_student's empty-caller cleanup (`delete from students where id = v_mine`) and the future
-- PDPO erasure path both rely on deleting a students row cleaning up its whole subtree.
--
-- NO app-code change: new rows still get auth.uid() via the column default (non-null); a NULL
-- auth_user_id simply never matches current_student_id()'s `auth_user_id = auth.uid()` predicate,
-- so an orphaned row is unreachable via a session and recoverable ONLY via the code — the
-- intended detach. The `unique` on auth_user_id is unaffected (Postgres treats NULLs as
-- distinct, so multiple orphans coexist; non-null identities stay unique). Apply AFTER 0006.

-- SET NULL requires the column to be nullable (it was NOT NULL). Only a purge produces NULL;
-- ensureStudent still inserts a non-null auth.uid() via the column default.
alter table students alter column auth_user_id drop not null;

-- Postgres has no ALTER for a FK's on-delete action, so drop + re-add. Look the constraint up
-- by its column (not a hard-coded auto-name) so an unexpected name can't fail the migration.
do $$
declare fk_name text;
begin
  select con.conname into fk_name
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
   where con.conrelid = 'public.students'::regclass
     and con.contype = 'f'
     and att.attname = 'auth_user_id';
  if fk_name is null then raise exception 'students.auth_user_id foreign key not found'; end if;
  execute format('alter table students drop constraint %I', fk_name);
end $$;

alter table students
  add constraint students_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

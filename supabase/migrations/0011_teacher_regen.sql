-- Lyra — migration 0011: teacher-mediated recovery-code regeneration (BRIEF-TR / §123). ADDITIVE.
--
-- Lyra's FIRST teacher WRITE. §121/0010 gave the STUDENT self-service regen; this closes the
-- pilot-certain case a student can't self-serve: she lost her phone AND has no usable code, so the
-- only recovery root left is an adult who knows her face — her teacher regenerates her code and hands
-- it to her on paper (she then claims her work onto a new device via the §121 "Use a code" path).
--
-- The teacher's browser mints the new code + its SHA-256 hex hash locally (the SAME §95 pipeline the
-- student regen uses) and passes ONLY the hash — the server never sees the new plaintext (§87/§88).
-- Authorization is ENROLMENT-SCOPED inside this SECURITY DEFINER function (D-M2): the caller must be a
-- teacher AND the target student must be enrolled in one of the CALLING teacher's classes. Every
-- authorization failure raises ONE identical non-oracle error, so the RPC can't enumerate student
-- UUIDs by error shape (the 0009 pattern). Teachers otherwise stay SELECT-only — this is the single
-- definer-mediated write; NO table UPDATE/INSERT/DELETE grant or policy for teachers is added.
-- Apply MANUALLY via the Supabase SQL editor AFTER 0010.

create or replace function teacher_regen_code(p_student_id uuid, p_new_hash text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  -- Hash shape first (mirrors 0010's validation; its own error reveals nothing).
  if p_new_hash is null or p_new_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid hash' using errcode = '22023';  -- invalid_parameter_value — distinct from the authz P0001
  end if;

  -- D-M2: enrolment-scoped authorization — ONE identical error for EVERY authz failure (caller not a
  -- teacher; student unknown; student not in the caller's classes), so the shape enumerates nothing.
  if current_teacher_id() is null
     or not exists (
       select 1 from enrolments e join classes c on c.id = e.class_id
        where e.student_id = p_student_id and c.teacher_id = current_teacher_id()
     )
  then
    raise exception 'not permitted' using errcode = 'P0001';
  end if;

  update students set recovery_code_hash = p_new_hash where id = p_student_id;
end;
$$;

revoke all     on function teacher_regen_code(uuid, text) from public, anon;
grant  execute on function teacher_regen_code(uuid, text) to authenticated;

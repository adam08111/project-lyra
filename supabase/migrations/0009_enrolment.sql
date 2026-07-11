-- Lyra — migration 0009: enrolment (BRIEF-ENROL). ADDITIVE.
--
-- The pilot's front door: a student enrols on her own phone with a CLASS CODE + her name via a
-- verify-and-link RPC. NEVER claim_student (that is identity transfer); NEVER the recovery code as
-- an enrolment token (routinely speaking a secret degrades it). The display name lives ONLY on the
-- enrolment row (0005's design) — no name/email enters the identity model. Apply MANUALLY via the
-- Supabase SQL editor AFTER 0008 (no CLI/network assumed).

-- ── D-L1: class_code on classes ──────────────────────────────────────────────
-- Operator-set friendly strings ("7B-KESTREL") are the intended form; stored normalized (the app
-- looks up case-insensitively). Backfill existing rows with a generated unambiguous 6-char code
-- (A–Z minus I/O, digits 2–9 — 32 glyphs), then make it mandatory + unique.
alter table classes add column class_code text;

do $$
declare
  r      record;
  v_code text;
begin
  for r in select id from classes where class_code is null loop
    loop
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32))::int + 1, 1), '')
        into v_code from generate_series(1, 6);
      exit when not exists (select 1 from classes where upper(class_code) = v_code);
    end loop;
    update classes set class_code = v_code where id = r.id;
  end loop;
end $$;

alter table classes alter column class_code set not null;
-- Case-insensitive uniqueness: operators may type any case; the RPC (and any future insert) looks
-- up on upper(class_code), so the uniqueness guard must match that shape.
create unique index classes_class_code_key on classes (upper(class_code));

-- ── D-L4: student self-SELECT on enrolments ──────────────────────────────────
-- 0005 gave enrolments a TEACHER-only SELECT; a student being unable to see their OWN membership
-- was an omission. PERMISSIVE, so it OR's with teacher_own_enrolments (0005:78) — a student sees
-- only their own rows, teachers keep their class scope, neither widens the other. (enrolments
-- already grants SELECT to authenticated in 0005:105 — this adds the row-scoping policy.)
create policy student_own_enrolments on enrolments for select to authenticated
  using (student_id = current_student_id());

-- ── D-L2: enrol_student(code, name) — the verify-and-link RPC ─────────────────
-- SECURITY DEFINER: the owner bypasses RLS to look up ANY class by code and insert the enrolment —
-- students have (deliberately) no direct classes/enrolments write path, so enrolment is possible
-- ONLY through this guarded function. search_path pinned (the 0003 lesson). ONE non-oracle error
-- ('code not recognised') for EVERY failure path, so a caller can't distinguish "bad code" from
-- "no identity" by the error shape (code enumeration stays an accepted low-value residual, D-L1).
-- The name is sanitized SERVER-SIDE (the server is the law): control-chars stripped, whitespace
-- collapsed, trimmed, hard-capped 40. Insert is idempotent on the (class_id, student_id) PK —
-- re-enrolment is success and keeps the first-stored name (name editing is out of scope).
create function enrol_student(p_class_code text, p_display_name text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_class   record;
  v_name    text;
begin
  v_student := current_student_id();
  if v_student is null then
    raise exception 'code not recognised' using errcode = 'P0001'; -- non-oracle: never reveal the precondition
  end if;

  v_name := btrim(regexp_replace(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]]', '', 'g'), '\s+', ' ', 'g'));
  v_name := left(v_name, 40);
  if v_name = '' then v_name := 'Student'; end if; -- a blank name is not an error; store a neutral default

  select c.id, c.name, t.display_name as teacher_name
    into v_class
    from classes c join teachers t on t.id = c.teacher_id
    where upper(c.class_code) = upper(btrim(coalesce(p_class_code, '')));
  if not found then
    raise exception 'code not recognised' using errcode = 'P0001';
  end if;

  insert into enrolments (class_id, student_id, display_name)
    values (v_class.id, v_student, v_name)
    on conflict (class_id, student_id) do nothing;

  return jsonb_build_object('class_name', v_class.name, 'teacher_display_name', v_class.teacher_name);
end;
$$;

revoke all     on function enrol_student(text, text) from public, anon;
grant  execute on function enrol_student(text, text) to authenticated;

-- Lyra P0 — migration 0003: fix claim_student's pgcrypto resolution (§98).
--
-- BUG (found live in §97.1): calling claim_student errored
--   42883: function digest(text, unknown) does not exist
-- Cause — a Supabase quirk: claim_student calls digest() (from the pgcrypto extension)
-- but 0001 pinned `search_path = public`, and on Supabase pgcrypto is installed in the
-- `extensions` schema, NOT public. So the unqualified digest() was unresolvable and the
-- D3 cross-device recovery path never worked on the deployment.
--
-- FIX (two belts): schema-qualify the call as extensions.digest(...) AND widen the pinned
-- search_path to `public, extensions`. Body is otherwise identical to 0001's claim_student
-- with ONE additive change: the code is normalized upper(trim(...)) before hashing so a
-- hand-typed code tolerates case / stray whitespace. Generated codes are already uppercase
-- + dash-separated with no whitespace (generateRecoveryCode + sha256Hex in
-- src/supabase-client.js hash the raw canonical code via WebCrypto SHA-256 → lowercase hex),
-- so existing stored recovery_code_hash values are UNAFFECTED and parity holds:
--   client  crypto.subtle SHA-256 hex(code)
--   == server encode(extensions.digest(upper(trim(code)),'sha256'),'hex')  for a canonical code.
--
-- Apply in the Supabase SQL editor AFTER 0002. Idempotent (create or replace). If your
-- pgcrypto lives in a schema other than `extensions`, change both the search_path and the
-- extensions.digest(...) qualification to that schema.

create or replace function claim_student(p_code text) returns boolean
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v_target uuid;
  v_mine   uuid;
begin
  select id into v_target from students
    where recovery_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  if v_target is null then
    return false;                                   -- no such code
  end if;
  if exists (select 1 from students where id = v_target and auth_user_id = auth.uid()) then
    return true;                                    -- already ours
  end if;
  select id into v_mine from students where auth_user_id = auth.uid();
  if v_mine is not null then
    if exists (select 1 from learning_events where student_id = v_mine)
       or exists (select 1 from growth_profiles where student_id = v_mine)
       or exists (select 1 from blobs where student_id = v_mine) then
      return false;                                 -- our row has data → refuse (no merge)
    end if;
    delete from students where id = v_mine;
  end if;
  update students set auth_user_id = auth.uid() where id = v_target;
  return true;
end;
$$;

-- ACL is preserved by create-or-replace; re-assert 0001's grants so applying 0003 alone
-- still yields the correct privilege set (authenticated-only; never public/anon).
revoke all on function claim_student(text) from public;
grant execute on function claim_student(text) to authenticated;

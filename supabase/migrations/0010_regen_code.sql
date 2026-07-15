-- Lyra — migration 0010: self-service recovery-code regeneration (BRIEF-112 / §121, D-G2). ADDITIVE.
--
-- §97.1 proved a fork event DESTROYS the device's stored code at the moment it's needed, so
-- "regenerate a fresh code and write it down" is first-class recovery, not polish. The client
-- generates the new code + its SHA-256 hex hash locally (the SAME §95 WebCrypto path the mint uses,
-- and the same shape 0003's claim_student compares against) and passes ONLY the hash — the server
-- never sees the new plaintext (§87/§88: a secret that routinely travels degrades). The RPC updates
-- the CALLER'S OWN row (current_student_id(), defined 0001) and nobody else's.
--
-- D-G1: this is STUDENT self-service only. Teacher-mediated regeneration (the first teacher WRITE)
-- is a separate brief (BRIEF-TR) with its own security review — teachers stay SELECT-only here.
-- Apply MANUALLY via the Supabase SQL editor AFTER 0009 (no CLI/network assumed).

create or replace function regenerate_recovery_code(p_new_hash text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
begin
  v_student := current_student_id();
  if v_student is null then
    raise exception 'no current student';   -- no student session on this device → honest client failure
  end if;

  -- Defence-in-depth: this column is the ONLY key back to a lost account, so refuse anything that is
  -- not a well-formed lowercase SHA-256 hex digest. The client always sends sha256Hex() output; a
  -- malformed value would silently lock the student out of every future claim.
  if p_new_hash is null or p_new_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid hash';
  end if;

  update students set recovery_code_hash = p_new_hash where id = v_student;
end;
$$;

revoke all     on function regenerate_recovery_code(text) from public, anon;
grant  execute on function regenerate_recovery_code(text) to authenticated;

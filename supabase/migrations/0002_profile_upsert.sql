-- Lyra P0 — migration 0002: server-side last-write-wins upsert for the growth profile.
--
-- Apply MANUALLY via the Supabase SQL editor, AFTER 0001. Called by the client's sync
-- outbox (saveProfileRemote → rpc("upsert_growth_profile", …)). SECURITY DEFINER so it
-- resolves the caller's own student via current_student_id(); LWW is enforced HERE, on
-- the server, so a stale QUEUED profile (older last_regen_at, e.g. a replay after the
-- device already regenerated) can never clobber a newer server row (D5).

create function upsert_growth_profile(p_profile jsonb, p_last_regen_at timestamptz)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_student uuid := current_student_id();
begin
  if v_student is null then
    return;                                   -- no identity → no-op, never errors the client
  end if;
  insert into growth_profiles (student_id, profile, last_regen_at, updated_at)
    values (v_student, p_profile, p_last_regen_at, now())
  on conflict (student_id) do update
    set profile       = excluded.profile,
        last_regen_at = excluded.last_regen_at,
        updated_at    = now()
    -- LWW: only advance when the incoming profile is strictly newer (or the row has
    -- never carried a timestamp). An older/equal/NULL incoming timestamp is a no-op.
    where growth_profiles.last_regen_at is null
       or excluded.last_regen_at > growth_profiles.last_regen_at;
end;
$$;

revoke all on function upsert_growth_profile(jsonb, timestamptz) from public;
grant execute on function upsert_growth_profile(jsonb, timestamptz) to authenticated;

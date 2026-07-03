-- Lyra P0 — migration 0001: Supabase data-layer foundation.
--
-- Layer 2 (the moat): a structured, queryable per-student schema for the learning
-- data (learning_events + growth_profiles). Layer 1 (durability): blobs (created now,
-- used in Phase 3). Authored in-repo as the schema's SINGLE SOURCE OF TRUTH; APPLY
-- MANUALLY via the Supabase SQL editor (no CLI/network assumed).
--
-- Security model: anonymous auth gives every device a real auth.uid(), so Row Level
-- Security is enforced from row one. The server-side dedup identity is
-- unique(student_id, type, content_key) where content_key is EXACTLY the string
-- src/content-keys.js computes. service_role is never used by the client (D6).

create extension if not exists pgcrypto;

-- ── students ─────────────────────────────────────────────────────────────────
-- One row per device-identity (anonymous auth user). recovery_code_hash is the
-- SHA-256 hex of a client-generated code; the plaintext never reaches the server.
create table students (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  display_name       text,
  recovery_code_hash text,
  created_at         timestamptz not null default now()
);

-- Resolve the caller's own student id. SECURITY DEFINER so RLS policies on the other
-- tables can call it WITHOUT recursing into students' own RLS; search_path pinned.
create function current_student_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from students where auth_user_id = auth.uid()
$$;

-- ── learning_events (append-only) ────────────────────────────────────────────
-- Promoted columns (rule/technique/topic/ts) for cheap queries + the full JSONB
-- payload for fidelity. unique(student_id, type, content_key) = the dedup identity.
create table learning_events (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  type        text not null check (type in ('grammar','growth','skill_deployed','structure','vocabulary','report')),
  content_key text not null,
  rule        text,
  technique   text,
  topic       text,
  ts          timestamptz not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (student_id, type, content_key)
);
create index learning_events_student_type_idx on learning_events (student_id, type);
create index learning_events_student_ts_idx   on learning_events (student_id, ts);
create index learning_events_student_rule_idx on learning_events (student_id, rule) where rule is not null;

-- ── growth_profiles (one JSONB doc per student) ──────────────────────────────
create table growth_profiles (
  student_id    uuid primary key references students(id) on delete cascade,
  profile       jsonb not null,
  last_regen_at timestamptz,
  updated_at    timestamptz not null default now()
);

-- ── blobs (Layer 1 — created now, wired in Phase 3) ──────────────────────────
create table blobs (
  student_id uuid not null references students(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, key)
);

-- ── grammar rule-frequency view ──────────────────────────────────────────────
-- security_invoker = on → the querying student's RLS applies THROUGH the view (a
-- default-security view would run as owner and leak every student's rules).
create view student_rule_frequency with (security_invoker = on) as
  select student_id, rule, count(*) as occurrences, min(ts) as first_seen, max(ts) as last_seen
  from learning_events
  where type = 'grammar' and rule is not null
  group by 1, 2;

-- ── Table privileges ─────────────────────────────────────────────────────────
-- RLS decides WHICH ROWS a role sees; GRANT decides whether the role may touch the
-- table AT ALL — they are complementary, not substitutes. Newer Supabase projects no
-- longer auto-grant public tables to the API roles (exposure is opt-in), so WITHOUT
-- these every Data API call would be permission-denied (42501) regardless of RLS.
-- `authenticated` only: the client always signInAnonymously() (→ the `authenticated`
-- role) before any table call. No delete/update on learning_events keeps it append-only
-- at the privilege layer too. service_role is never granted client-side (D6).
grant select, insert, update on table students        to authenticated;
grant select, insert         on table learning_events to authenticated;
grant select, insert, update on table growth_profiles to authenticated;
grant select, insert, update on table blobs           to authenticated;
grant select                 on student_rule_frequency to authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table students        enable row level security;
alter table learning_events enable row level security;
alter table growth_profiles enable row level security;
alter table blobs           enable row level security;

-- students: a caller sees/edits ONLY their own row.
create policy students_select on students for select using (auth_user_id = auth.uid());
create policy students_insert on students for insert with check (auth_user_id = auth.uid());
create policy students_update on students for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- learning_events: append-only — select + insert scoped to the caller's student,
-- and deliberately NO update/delete policy (RLS default-denies both).
create policy learning_events_select on learning_events for select using (student_id = current_student_id());
create policy learning_events_insert on learning_events for insert with check (student_id = current_student_id());

-- growth_profiles: select/insert/update on the caller's own row.
create policy growth_profiles_select on growth_profiles for select using (student_id = current_student_id());
create policy growth_profiles_insert on growth_profiles for insert with check (student_id = current_student_id());
create policy growth_profiles_update on growth_profiles for update using (student_id = current_student_id()) with check (student_id = current_student_id());

-- blobs: select/insert/update on the caller's own rows.
create policy blobs_select on blobs for select using (student_id = current_student_id());
create policy blobs_insert on blobs for insert with check (student_id = current_student_id());
create policy blobs_update on blobs for update using (student_id = current_student_id()) with check (student_id = current_student_id());

-- ── claim_student — continuity across cache-clear / new device via the code ──
-- Adopt the code's student row onto the caller's auth.uid(). If the caller already
-- has a row, discard it ONLY when it is empty (no learning data) — merging is out of
-- scope. RPC ships now; the claim UX is Phase 2. Granted to authenticated only.
create function claim_student(p_code text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
  v_mine   uuid;
begin
  select id into v_target from students
    where recovery_code_hash = encode(digest(p_code, 'sha256'), 'hex');
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

revoke all on function claim_student(text) from public;
grant execute on function claim_student(text) to authenticated;

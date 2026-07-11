-- Lyra — migration 0008: report_snapshots (BRIEF-RS, DATA-ARCHITECTURE §3 Tier 1). ADDITIVE.
--
-- Takes the Continuous Growth Report off "the glass". The report is otherwise LWW-mutable in
-- `growth_profiles` (0002 — ONE row per student, overwritten by upsert_growth_profile on every
-- regen), so a regeneration silently replaces the prior assessment. This table archives each
-- AS-ISSUED report append-only, so no report is ever silently destroyed; as a bonus the stream
-- IS the student's band-estimate trajectory over time (each profile carries level.bandEstimate).
-- Same disease 0006 cured for essay drafts; same cure. Apply MANUALLY via the Supabase SQL editor
-- AFTER 0007 (no CLI/network assumed).
--
-- Student-owned, APPEND-ONLY (SELECT + INSERT only — no update/delete grant or policy, so the
-- history cannot be rewritten at the privilege layer either). TEACHERS EXCLUDED (D-K3): teachers
-- keep reading only the CURRENT profile (0005 posture); no teacher policy, no teacher grant here.
-- The student→snapshots FK cascades (a legitimately deleted student takes their snapshots — §115's
-- kept-segment design: erasure and claim-cleanup flow through the students row), unrelated to the
-- separate auth.users→students RESTRICT.
--
-- unique(student_id, content_hash) is a REPLAY-IDEMPOTENCY key, not a content de-duplicator: every
-- regen re-stamps lastRegenAt, so distinct regens always differ and each is archived as its own
-- issuance (a per-issuance ledger — what a trajectory archive wants). The ON CONFLICT DO NOTHING
-- only absorbs a re-flushed/replayed outbox item (a reload with an undrained queue can't
-- double-insert the same issuance). The hash is computed client-side over JSON.stringify(profile)
-- (D-K1, ratified — the profile is a JS object all the way to the RPC, so there is no wire string
-- to hash; the serialization is self-consistent with the stored `report`).

create table report_snapshots (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  report       jsonb not null,
  content_hash text not null,
  trigger      text not null,
  ts           timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (student_id, content_hash)
);
create index report_snapshots_student_ts_idx on report_snapshots (student_id, ts);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table report_snapshots enable row level security;

-- The student sees/appends only their own snapshots; NO update/delete policy (append-only).
create policy report_snapshots_select on report_snapshots for select using (student_id = current_student_id());
create policy report_snapshots_insert on report_snapshots for insert with check (student_id = current_student_id());

-- ── Privileges (0001-style: RLS picks rows, GRANT permits touching the table) ──
-- select + insert only (append-only — no update/delete). No teacher path of any kind. Then
-- re-assert the 0004 anon lockout for the new object (belt-and-suspenders least-privilege).
grant select, insert on table report_snapshots to authenticated;
revoke all           on table report_snapshots from anon;

-- Lyra — migration 0006: writing_snapshots (BRIEF-114, DATA-ARCHITECTURE §3 Tier 1). ADDITIVE.
--
-- Extends Layer 2's append-only ledger discipline to essay CONTENT ("the glass"): a row per
-- meaningful draft moment (proofread/coaching completion, sweep-detected change, deletion-as-
-- event). Essays otherwise live as mutable whole-blobs (§101 — deletes propagate, last sweep
-- wins); this table makes a written draft un-destroyable. Apply MANUALLY via the Supabase SQL
-- editor AFTER 0005 (no CLI/network assumed).
--
-- Student-owned, APPEND-ONLY (SELECT + INSERT only — no update/delete grant or policy, so the
-- history cannot be rewritten at the privilege layer either). TEACHERS EXCLUDED: this is essay
-- content, so the SELECT-only, no-essays teacher posture (SECURITY.md) extends here — no teacher
-- policy, no teacher grant. The student→snapshots FK cascades (a legitimately deleted student
-- takes their snapshots), which is the intended student-subtree behaviour, unrelated to the
-- separate auth.users→students cascade concern.
--
-- Server-side dedup is unique(student_id, writing_id, content_hash) — the content-key pattern
-- (CLAUDE.md #8): reload / multi-trigger re-emission is a harmless no-op. A DELETION event uses a
-- namespaced content_hash ("deleted:<last-hash>") so the tombstone can never collide with a
-- content snapshot for the same writing.

create table writing_snapshots (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  writing_id   text not null,
  content      text not null,
  content_hash text not null,
  trigger      text not null,
  deleted      boolean not null default false,
  ts           timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (student_id, writing_id, content_hash)
);
create index writing_snapshots_student_writing_ts_idx on writing_snapshots (student_id, writing_id, ts);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table writing_snapshots enable row level security;

-- The student sees/appends only their own snapshots; NO update/delete policy (append-only).
create policy writing_snapshots_select on writing_snapshots for select using (student_id = current_student_id());
create policy writing_snapshots_insert on writing_snapshots for insert with check (student_id = current_student_id());

-- ── Privileges (0001-style: RLS picks rows, GRANT permits touching the table) ──
-- select + insert only (append-only — no update/delete). No teacher path of any kind. Then
-- re-assert the 0004 anon lockout for the new object (belt-and-suspenders least-privilege).
grant select, insert on table writing_snapshots to authenticated;
revoke all           on table writing_snapshots from anon;

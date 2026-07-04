-- Lyra P0 — migration 0004: revoke the anon role's residual table/function access (§98).
--
-- §97.1 evidenced the anon apikey reaching public tables (GET returned 200 []) and the
-- upsert_growth_profile RPC (204) even though 0001's grants target `authenticated` only —
-- Supabase DEFAULT PRIVILEGES had granted anon SELECT/EXECUTE on new public objects.
-- Harmless under RLS + the null-identity guards (as anon, current_student_id() is null so
-- reads return nothing and the RPC no-ops), but broader than intended — tighten it.
--
-- ZERO app impact: the client never uses the anon role for DATA. signInAnonymously() is an
-- Auth (GoTrue) endpoint that returns an AUTHENTICATED JWT; every PostgREST data call then
-- carries that JWT (the `authenticated` role). Revoking anon touches nothing the app does.
--
-- Apply in the Supabase SQL editor AFTER 0003. Audit before AND after with:
--   select grantee, table_name, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and grantee = 'anon';
-- (Expect a non-empty list before, and zero rows after.)

revoke all     on all tables    in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all     on tables    from anon;
alter default privileges in schema public revoke execute on functions from anon;

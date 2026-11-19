-- ROLLBACK GV5 §83 / 001 — retire la RPC de diagnostic uniquement.

drop function if exists public.admin_identity_v2_health();

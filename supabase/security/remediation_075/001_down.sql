-- AUTO DYALI — GV5 §75 — ROLLBACK de 001_workspace_rpcs.sql
-- Supprime UNIQUEMENT les fonctions ajoutées ; aucune donnée n'est touchée.

drop function if exists public.admin_get_abonne_details(uuid);
drop function if exists public.admin_revoke_invitation(uuid);
drop function if exists public.admin_prepare_resend(uuid, text, text, timestamptz, text[]);
drop function if exists public.admin_set_permissions(uuid, user_role, jsonb);
drop function if exists public.admin_renew_subscription(uuid, integer);
drop function if exists public.admin_set_subscription(uuid, text, integer, integer, date);
drop function if exists public.admin_update_manager(uuid, text, text, text, boolean, text);
drop function if exists public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text);

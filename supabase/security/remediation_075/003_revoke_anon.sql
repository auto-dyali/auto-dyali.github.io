-- GV5 §75 — Durcissement : Supabase accorde par défaut EXECUTE au rôle anon
-- sur les nouvelles fonctions (via ALTER DEFAULT PRIVILEGES). Le simple
-- `revoke ... from public` ne suffit pas : il faut révoquer explicitement anon.
-- Vérifié sur staging : anon passe de 200 (lecture fiche) à 401 (permission denied).

revoke execute on function public.admin_get_abonne_details(uuid) from anon;
revoke execute on function public.admin_prepare_resend(uuid, text, text, timestamptz, text[]) from anon;
revoke execute on function public.admin_revoke_invitation(uuid) from anon;
revoke execute on function public.admin_set_permissions(uuid, user_role, jsonb) from anon;
revoke execute on function public.admin_renew_subscription(uuid, integer) from anon;
revoke execute on function public.admin_set_subscription(uuid, text, integer, integer, date) from anon;
revoke execute on function public.admin_update_manager(uuid, text, text, text, boolean, text) from anon;
revoke execute on function public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text) from anon;
revoke execute on function public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from anon;

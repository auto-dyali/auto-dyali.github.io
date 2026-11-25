-- Retour arrière migration 103000 (champs admin + versions durcies)
drop function if exists public.admin_update_manager(uuid, text, text, text, boolean, text);
drop function if exists public.hash_invitation_token(text);

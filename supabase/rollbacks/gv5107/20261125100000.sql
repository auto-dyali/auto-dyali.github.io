-- Retour arrière migration 100000 (invitations) — DESTRUCTIF
drop policy if exists invitations_saas_admin_all on public.invitations;
drop policy if exists invitations_manager_select_own on public.invitations;
drop policy if exists invitation_events_saas_admin_all on public.invitation_events;
drop policy if exists invitation_events_manager_select_own on public.invitation_events;
drop function if exists public.admin_prepare_resend(uuid, text, text, timestamptz, text[]);
drop function if exists public.admin_record_delivery(uuid, text, text, text, text);
drop function if exists public.admin_accept_invitation(text, uuid);
drop function if exists public.admin_invitation_preview(text);
drop function if exists public.admin_expire_stale_invitations();
drop function if exists public.hash_invitation_token(text);
drop function if exists public.gen_invitation_token();
drop table if exists public.invitation_events;
drop table if exists public.invitations;

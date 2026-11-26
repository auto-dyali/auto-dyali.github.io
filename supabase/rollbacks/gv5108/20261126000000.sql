-- Retour arrière de la migration 20261126000000 (GV5 notifications Super Admin).
-- Ne supprime QUE les objets créés par cette migration.
-- INTERDIT en Production sans autorisation explicite.

revoke execute on function public.admin_notify_new_subscriber(jsonb) from service_role;
drop function if exists public.admin_notify_new_subscriber(jsonb);

drop policy if exists super_admin_notifications_sa_update on public.super_admin_notifications;
drop policy if exists super_admin_notifications_sa_select on public.super_admin_notifications;

revoke all on table public.super_admin_notifications from service_role, authenticated;
drop table if exists public.super_admin_notifications;

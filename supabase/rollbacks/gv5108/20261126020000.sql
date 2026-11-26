-- Retour arrière de 20261126020000 (cycle de vie garages/abonnements).
-- Ne supprime que les objets ajoutés par cette migration.
-- PRÉPARÉ — NON APPLIQUÉ.

drop function if exists public.admin_soft_delete_subscription(uuid, text, text);
drop function if exists public.admin_archive_subscription(uuid, boolean, text);
drop function if exists public.admin_renew_subscription_v2(uuid, integer, text);
drop function if exists public.admin_update_subscription(uuid, text, timestamptz, timestamptz, timestamptz, text);
drop function if exists public.admin_set_subscription_status(uuid, text, text);
drop function if exists public.admin_soft_delete_establishment(uuid, text, text);
drop function if exists public.admin_archive_establishment_v2(uuid, boolean, text);
drop function if exists public.admin_set_establishment_status_v2(uuid, boolean, text);
drop function if exists public.admin_log_lifecycle(uuid, text, uuid, text, jsonb, jsonb, text, text);

drop index if exists public.subscriptions_gv5_archived_at_idx;
drop index if exists public.establishments_gv5_archived_at_idx;

alter table public.subscriptions
  drop column if exists gv5_archived_at,
  drop column if exists gv5_archive_reason,
  drop column if exists gv5_status_reason,
  drop column if exists gv5_updated_at;

alter table public.establishments
  drop column if exists gv5_archived_at,
  drop column if exists gv5_archive_reason,
  drop column if exists gv5_suspend_reason,
  drop column if exists gv5_deleted_at,
  drop column if exists gv5_delete_reason;

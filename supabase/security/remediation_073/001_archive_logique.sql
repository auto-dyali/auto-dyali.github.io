-- GV5 §73 — Archivage logique réversible des abonnés (PRÉPARÉ — NON EXÉCUTÉ en production)
-- Ajoute archived_at à establishments (aucune donnée supprimée) et 2 RPC Super Admin.

alter table public.establishments add column if not exists archived_at timestamptz;
create index if not exists establishments_archived_idx on public.establishments (archived_at) where archived_at is not null;

create or replace function public.admin_archive_establishment(p_id uuid, p_archive boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  update public.establishments
     set archived_at = case when p_archive then now() else null end,
         is_active = case when p_archive then false else true end,
         updated_at = now()
   where id = p_id;
  if not found then raise exception 'Établissement introuvable.'; end if;
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_id, auth.uid(), case when p_archive then 'archive' else 'restore' end, 'establishment', p_id, jsonb_build_object('archived', p_archive));
end; $$;
revoke all on function public.admin_archive_establishment(uuid,boolean) from public;
grant execute on function public.admin_archive_establishment(uuid,boolean) to authenticated;

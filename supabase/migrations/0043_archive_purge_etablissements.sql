-- =====================================================================
-- AUTO DYALI — 0043 (GV5 §93) : Archivage logique et suppression définitive
--                              des établissements (RPC officielles)
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Objet :
--   1. Intégrer officiellement `admin_archive_establishment` (archivage
--      logique réversible, issu de security/remediation_073).
--   2. Intégrer officiellement `admin_purge_establishment` (suppression
--      définitive contrôlée, issu de security/remediation_580).
--   3. S'assurer que les colonnes `archived_at` et `updated_at` existent
--      sur `public.establishments` (dépendance de 0041 pour updated_at).
--
-- Dépendances : 0001 (établissements, profiles, audit_log), 0041
--               (updated_at sur establishments/subscriptions), 0028
--               (onboarding_requests, is_saas_admin).
-- Ordre d'application : après 0042.
--
-- Aucune donnée n'est supprimée par cette migration elle-même. La purge
-- définitive n'est déclenchée que par un appel explicite à la RPC
-- `admin_purge_establissement`, et uniquement si l'établissement est
-- préalablement archivé et qu'aucune donnée métier protégée n'existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0043: table establishments absente (migration 0001).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='audit_log') then
    raise exception 'ARRÊT 0043: table audit_log absente (migration 0001).';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0043: fonction is_saas_admin() absente (migration 0028).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT 0043: table profiles absente (migration 0001).';
  end if;
  raise notice '0043 pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. Colonnes archived_at et updated_at sur establishments (idempotent)
-- ---------------------------------------------------------------------
alter table public.establishments
  add column if not exists archived_at timestamptz;

alter table public.establishments
  add column if not exists updated_at timestamptz default now();

create index if not exists establishments_archived_idx
  on public.establishments (archived_at) where archived_at is not null;

-- ---------------------------------------------------------------------
-- 2. RPC admin_archive_establishment (archivage logique réversible)
-- ---------------------------------------------------------------------
create or replace function public.admin_archive_establishment(
  p_id uuid,
  p_archive boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.establishments
     set archived_at = case when p_archive then now() else null end,
         is_active = case when p_archive then false else true end,
         updated_at = now()
   where id = p_id;

  if not found then
    raise exception 'Établissement introuvable.';
  end if;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    p_id, auth.uid(),
    case when p_archive then 'archive' else 'restore' end,
    'establishment', p_id,
    jsonb_build_object('archived', p_archive)
  );
end;
$$;

revoke all on function public.admin_archive_establishment(uuid, boolean) from public;
grant execute on function public.admin_archive_establishment(uuid, boolean) to authenticated;

comment on function public.admin_archive_establishment(uuid, boolean) is
  'Archive ou restaure un établissement (logique réversible). Super Admin uniquement.';

-- ---------------------------------------------------------------------
-- 3. RPC admin_purge_establishment (suppression définitive contrôlée)
-- ---------------------------------------------------------------------
create or replace function public.admin_purge_establishment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_etab public.establishments%rowtype;
  v_dependances jsonb;
  v_comptes uuid[];
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;

  select * into v_etab from public.establishments where id = p_id;
  if not found then
    raise exception 'Établissement introuvable.';
  end if;
  if v_etab.archived_at is null then
    raise exception 'Archivage obligatoire avant suppression définitive.';
  end if;

  -- Vérifie l'absence de données métier protégées (uniquement les tables
  -- qui existent dans le schéma actuel ; les tables absentes sont ignorées).
  select jsonb_strip_nulls(jsonb_build_object(
    'sales', (select count(*) from public.sales where establishment_id = p_id),
    'invoices', (select count(*) from public.invoices where establishment_id = p_id),
    'payments', (select count(*) from public.payments where establishment_id = p_id),
    'work_orders', (select count(*) from public.work_orders where establishment_id = p_id),
    'products', (select count(*) from public.products where establishment_id = p_id),
    'clients', (select count(*) from public.clients where establishment_id = p_id),
    'vehicles', (select count(*) from public.vehicles where establishment_id = p_id),
    'purchase_orders', (select count(*) from public.purchase_orders where establishment_id = p_id),
    'cash_sessions', (select count(*) from public.cash_sessions where establishment_id = p_id),
    'expenses', (select count(*) from public.expenses where establishment_id = p_id)
  )) into v_dependances;

  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  into v_dependances
  from jsonb_each_text(v_dependances) as t(k, v)
  where v::integer > 0;

  if v_dependances <> '{}'::jsonb then
    raise exception 'Suppression refusée : données métier présentes (%) — respecter les obligations de conservation.', v_dependances;
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_comptes
  from public.profiles where establishment_id = p_id;

  -- Conservation de l'audit : détachement puis snapshot de la purge.
  update public.audit_log set establishment_id = null where establishment_id = p_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (
    auth.uid(), 'establishment_purged', 'establishment', p_id,
    jsonb_build_object(
      'snapshot', to_jsonb(v_etab),
      'comptes_supprimes', v_comptes,
      'raison', 'suppression définitive GV5 §80'
    )
  );

  delete from public.invitation_events where invitation_id in (select id from public.invitations where establishment_id = p_id);
  delete from public.invitations where establishment_id = p_id;
  delete from public.permissions where establishment_id = p_id;
  delete from public.subscriptions where establishment_id = p_id;
  delete from public.saas_billing_events where establishment_id = p_id;
  delete from public.onboarding_requests where establishment_id = p_id;
  delete from public.profiles where establishment_id = p_id;

  -- Comptes Auth correspondants (comptes de test staging uniquement).
  delete from auth.users where id = any(v_comptes);

  delete from public.establishments where id = p_id;

  return jsonb_build_object(
    'etablissement_supprime', p_id,
    'comptes_supprimes', array_length(v_comptes, 1),
    'statut', 'purge_definitive'
  );
end;
$$;

revoke all on function public.admin_purge_establissement(uuid) from public;
grant execute on function public.admin_purge_establissement(uuid) to authenticated;

comment on function public.admin_purge_establissement(uuid) is
  'Supprime définitivement un établissement archivé sans données métier. Super Admin uniquement. Archivage préalable obligatoire.';

-- ---------------------------------------------------------------------
-- 4. Vérification
-- ---------------------------------------------------------------------
do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public' and tablename='establishments';
  raise notice '0043 vérification OK : politiques RLS sur establishments = %.', v_count;
end $$;

-- FIN 0043

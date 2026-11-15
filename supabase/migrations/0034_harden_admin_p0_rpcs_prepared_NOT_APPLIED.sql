-- AUTO DYALI — 0034 : Durcissement RPC Super Admin P0 (préparée, NON APPLIQUÉE)
--
-- Cible : admin_create_establishment, admin_change_plan,
--         admin_set_establishment_status, admin_save_plan, admin_set_feature
-- Sources historiques : 0010_super_admin_rpc.sql
--
-- PRÉREQUIS OBLIGATOIRES (avant exécution distante) :
--   1) Sauvegarde/PITR vérifiée et exploitable ; point de restauration noté.
--   2) Audit read-only de l'état réel (définitions, signatures/overloads,
--      propriétaires, grants EXECUTE public/anon/authenticated, RLS/policies,
--      dépendances is_saas_admin/current_establishment_id).
--   3) Autorisation explicite (levée ciblée gel P0 pour cette opération).
--   4) Exécution contrôlée (SQL Editor/service role), puis vérifications
--      avant/après consignées en GV5.
--
-- Compatibilité : signatures conservées pour limiter la régression client.
-- Sécurité : garde is_saas_admin(), search_path fixe, validations d'entrée,
-- contrôle d'unicité slug (création), journalisation audit, REVOKE PUBLIC.
-- Réversibilité : conserver export des définitions/privilèges AVANT exécution ;
-- rollback via restauration PITR/sauvegarde validée si anomalie.
--
-- NE PAS supprimer de données. NE PAS inventer de valeurs historiques.

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles (échoue si dépendances critiques absentes)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0034: is_saas_admin() absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0034: table establishments absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='subscriptions') then
    raise exception 'ARRÊT 0034: table subscriptions absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plans') then
    raise exception 'ARRÊT 0034: table plans absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plan_features') then
    raise exception 'ARRÊT 0034: table plan_features absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='audit_log') then
    raise exception 'ARRÊT 0034: table audit_log absente.';
  end if;
  raise notice '0034 pré-contrôles OK (dépendances présentes).';
end $$;

-- ---------------------------------------------------------------------
-- 1. admin_create_establishment (durci)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_establishment(
  p_name text,
  p_slug text,
  p_city text default null,
  p_phone text default null,
  p_email text default null,
  p_plan text default 'standard'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
  v_name text;
  v_plan text;
  v_trial_days integer := 14;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  v_name := trim(coalesce(p_name, ''));
  v_slug := lower(trim(coalesce(p_slug, '')));
  v_plan := lower(trim(coalesce(p_plan, 'standard')));

  if v_name = '' then
    raise exception 'Le nom de l’établissement est obligatoire.';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug invalide (minuscules, chiffres, tirets).';
  end if;
  if v_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : % (attendu standard|silver|gold)', v_plan;
  end if;
  if exists (select 1 from public.establishments e where e.slug = v_slug) then
    raise exception 'Un établissement avec ce slug existe déjà.';
  end if;

  select coalesce(p.trial_days, 14) into v_trial_days from public.plans p where p.code = v_plan;

  insert into public.establishments (name, slug, city, phone, email, plan, is_active)
  values (v_name, v_slug, nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_phone,'')),''), nullif(lower(trim(coalesce(p_email,''))),''), v_plan, true)
  returning id into v_id;

  insert into public.subscriptions (establishment_id, plan_code, status, trial_ends_at, current_period_end)
  values (v_id, v_plan, 'trial', now() + make_interval(days => greatest(v_trial_days, 0)), now() + make_interval(days => greatest(v_trial_days, 0)));

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'create', 'establishment', v_id,
          jsonb_build_object('name', v_name, 'plan', v_plan, 'slug', v_slug));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. admin_change_plan (durci)
-- ---------------------------------------------------------------------
create or replace function public.admin_change_plan(
  p_establishment_id uuid,
  p_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien text;
  v_plan text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  v_plan := lower(trim(coalesce(p_plan,'')));
  if v_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : %', v_plan;
  end if;

  select plan into v_ancien from public.establishments where id = p_establishment_id for update;
  if v_ancien is null then
    raise exception 'Établissement introuvable.';
  end if;

  update public.establishments
     set plan = v_plan, updated_at = now()
   where id = p_establishment_id;

  update public.subscriptions
     set plan_code = v_plan, status = case when status = 'suspended' then 'suspended' else 'active' end
   where establishment_id = p_establishment_id
     and status in ('active','trial','past_due','suspended');

  if not exists (
    select 1 from public.subscriptions
     where establishment_id = p_establishment_id and status in ('active','trial','past_due','suspended')
  ) then
    insert into public.subscriptions (establishment_id, plan_code, status, current_period_end)
    values (p_establishment_id, v_plan, 'active', now() + interval '1 year');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'change_plan', 'establishment', p_establishment_id,
          jsonb_build_object('ancien', v_ancien, 'nouveau', v_plan));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. admin_set_establishment_status (durci)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_establishment_status(
  p_establishment_id uuid,
  p_active boolean
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
     set is_active = p_active,
         suspended_at = case when p_active then null else coalesce(suspended_at, now()) end,
         updated_at = now()
   where id = p_establishment_id;
  if not found then
    raise exception 'Établissement introuvable.';
  end if;

  update public.subscriptions
     set status = case when p_active then 'active' else 'suspended' end
   where establishment_id = p_establishment_id
     and status in ('active','trial','past_due','suspended');

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), case when p_active then 'activate' else 'suspend' end,
          'establishment', p_establishment_id,
          jsonb_build_object('is_active', p_active));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. admin_save_plan (durci)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_plan(
  p_code text,
  p_price_monthly numeric,
  p_price_yearly numeric,
  p_trial_days integer,
  p_max_users integer,
  p_max_sites integer,
  p_storage_mb integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  v_code := lower(trim(coalesce(p_code,'')));
  if v_code not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : %', v_code;
  end if;
  if p_price_monthly is not null and p_price_monthly < 0 then raise exception 'Prix mensuel invalide.'; end if;
  if p_price_yearly is not null and p_price_yearly < 0 then raise exception 'Prix annuel invalide.'; end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then raise exception 'Durée d’essai invalide (0-365).'; end if;
  if p_max_users is null or p_max_users < 1 then raise exception 'max_users invalide.'; end if;
  if p_max_sites is null or p_max_sites < 1 then raise exception 'max_sites invalide.'; end if;
  if p_storage_mb is null or p_storage_mb < 1 then raise exception 'storage_mb invalide.'; end if;

  update public.plans
     set price_monthly = p_price_monthly,
         price_yearly = p_price_yearly,
         trial_days = p_trial_days,
         max_users = p_max_users,
         max_sites = p_max_sites,
         storage_mb = p_storage_mb,
         updated_at = now()
   where code = v_code;
  if not found then
    raise exception 'Forfait inconnu : %', v_code;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'save_plan', 'plan', null,
          jsonb_build_object('code', v_code, 'price_monthly', p_price_monthly, 'price_yearly', p_price_yearly));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. admin_set_feature (durci)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_feature(
  p_plan_code text,
  p_feature text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_feature text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  v_plan := lower(trim(coalesce(p_plan_code,'')));
  v_feature := trim(coalesce(p_feature,''));
  if v_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : %', v_plan;
  end if;
  if v_feature = '' then
    raise exception 'Fonctionnalité obligatoire.';
  end if;

  update public.plan_features
     set enabled = coalesce(p_enabled, false)
   where plan_code = v_plan and feature_key = v_feature;
  if not found then
    raise exception 'Fonctionnalité % inconnue pour le forfait %', v_feature, v_plan;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'set_feature', 'plan_feature', null,
          jsonb_build_object('plan', v_plan, 'feature', v_feature, 'enabled', p_enabled));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Privilèges (minimaux, contrôlés par garde interne)
-- ---------------------------------------------------------------------
revoke all on function public.admin_create_establishment(text,text,text,text,text,text) from public;
revoke all on function public.admin_change_plan(uuid,text) from public;
revoke all on function public.admin_set_establishment_status(uuid,boolean) from public;
revoke all on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) from public;
revoke all on function public.admin_set_feature(text,text,boolean) from public;

grant execute on function public.admin_create_establishment(text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_change_plan(uuid,text) to authenticated;
grant execute on function public.admin_set_establishment_status(uuid,boolean) to authenticated;
grant execute on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function public.admin_set_feature(text,text,boolean) to authenticated;

-- FIN 0034 (préparée). Vérifier après application : définitions, grants, appels SA/non-SA.

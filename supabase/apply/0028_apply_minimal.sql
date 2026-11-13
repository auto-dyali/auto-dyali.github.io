-- =====================================================================
-- AUTO DYALI — APPLICATION MINIMALE DE LA MIGRATION 0028
-- =====================================================================
-- PRÉ-FLIGHT (lecture seule) : si un objet critique est absent,
-- l'exécution ENTIÈRE est annulée AVANT toute écriture.
-- AUCUNE donnée existante n'est supprimée, modifiée ou recréée.
-- PRÉ-REQUIS : sauvegarde/PITR vérifiée + autorisation explicite.
-- Projet : nxmsqqoflskfajqrqddw
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname='public' and p.proname='is_saas_admin') then
    raise exception 'ARRÊT: is_saas_admin() absente — appliquez les migrations de base (0001/0002/0007) d''abord.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname='public' and p.proname='current_establishment_id') then
    raise exception 'ARRÊT: current_establishment_id() absente — appliquez 0001/0002/0007.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT: table establishments absente (0001).';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='establishments' and column_name='trial_ends_at') then
    raise exception 'ARRÊT: trial_ends_at absent — appliquez 0009.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='establishments' and column_name='suspended_at') then
    raise exception 'ARRÊT: suspended_at absent — appliquez 0009.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='plans') then
    raise exception 'ARRÊT: table plans absente (0009).';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='subscriptions') then
    raise exception 'ARRÊT: table subscriptions absente (0009).';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='audit_log') then
    raise exception 'ARRÊT: table audit_log absente (0001).';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT: table profiles absente (0001).';
  end if;
  if not exists (select 1 from public.plans where code in ('standard','silver','gold')) then
    raise exception 'ARRÊT: forfaits standard/silver/gold absents de plans (seed 0009 incomplet).';
  end if;
  raise notice 'PRÉ-FLIGHT OK : dépendances 0028 présentes. Application autorisée.';
end $$;

-- =====================================================================
-- AUTO DYALI — 0028 : Onboarding sécurisé entreprise + Manager
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Ne pas exécuter à distance sans :
--   1) sauvegarde / export,
--   2) vérification des dépendances (FK, RLS, données existantes),
--   3) autorisation explicite de l'utilisateur.
--
-- Principe de sécurité :
--   - La création du compte Auth (invitation email) se fait côté serveur
--     via une Edge Function utilisant la clé service_role (jamais le navigateur).
--   - Cette migration fournit les RPC transactionnelles sécurisées.
--   - Idempotence : chaque demande porte un request_id unique (uuid généré
--     par le client) ; un retry retourne le résultat déjà créé au lieu de
--     dupliquer l'entreprise, l'abonnement ou le profil.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TABLE DE SUIVI DES DEMANDES D'ONBOARDING (idempotence)
-- ---------------------------------------------------------------------
create table if not exists public.onboarding_requests (
  request_id       text primary key,
  company_name     text not null,
  slug             text not null,
  plan             text not null,
  company_email    text,
  manager_user_id  uuid references auth.users(id) on delete set null,
  establishment_id uuid references public.establishments(id) on delete set null,
  status           text not null default 'started' check (status in ('started','completed','failed')),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

alter table public.onboarding_requests enable row level security;
drop policy if exists onboarding_requests_saas_admin on public.onboarding_requests;
create policy onboarding_requests_saas_admin on public.onboarding_requests
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());
grant select on public.onboarding_requests to authenticated;

-- ---------------------------------------------------------------------
-- 1. Retrouver l'identifiant Auth d'un email (sans exposer l'email).
-- ---------------------------------------------------------------------
create or replace function public.admin_find_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_email is null or length(trim(p_email)) = 0 then
    return null;
  end if;
  select u.id into v_id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1;
  return v_id;
end;
$$;

revoke all on function public.admin_find_user_id_by_email(text) from public;
grant execute on function public.admin_find_user_id_by_email(text) to authenticated;

comment on function public.admin_find_user_id_by_email(text) is
  'Retourne l''UUID Auth pour un email (Super Admin uniquement). Aucun email renvoyé.';

-- ---------------------------------------------------------------------
-- 2. Consulter une demande d'onboarding (idempotence côté Edge Function)
-- ---------------------------------------------------------------------
create or replace function public.admin_find_onboarding_request(p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.onboarding_requests%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  select * into v from public.onboarding_requests where request_id = p_request_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'request_id', v.request_id,
    'status', v.status,
    'establishment_id', v.establishment_id,
    'manager_user_id', v.manager_user_id
  );
end;
$$;

revoke all on function public.admin_find_onboarding_request(text) from public;
grant execute on function public.admin_find_onboarding_request(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Onboarding atomique : entreprise + abonnement + Manager.
--    Le compte Auth doit déjà exister (invitation Edge Function) ou
--    être omis (p_manager_user_id null) pour une création sans Manager.
--    Idempotent via p_request_id : un retry retourne le résultat existant.
-- ---------------------------------------------------------------------
create or replace function public.admin_onboard_tenant(
  p_company_name    text,
  p_slug            text,
  p_city            text default null,
  p_phone           text default null,
  p_email           text default null,
  p_plan            text default 'standard',
  p_manager_user_id uuid default null,
  p_manager_name    text default null,
  p_manager_phone   text default null,
  p_trial_days      integer default 14,
  p_request_id      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab_id uuid;
  v_sub_id  uuid;
  v_existing public.onboarding_requests%rowtype;
  v_manager_profile public.profiles%rowtype;
  v_slug    text;
  v_request text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  -- Idempotence : si la demande existe déjà, retourner le résultat enregistré.
  v_request := nullif(trim(coalesce(p_request_id, '')), '');
  if v_request is not null then
    select * into v_existing from public.onboarding_requests where request_id = v_request;
    if found then
      return jsonb_build_object(
        'idempotent', true,
        'status', v_existing.status,
        'establishment_id', v_existing.establishment_id,
        'manager_user_id', v_existing.manager_user_id
      );
    end if;
  end if;

  -- Validations d'entrée.
  if p_company_name is null or length(trim(p_company_name)) = 0 then
    raise exception 'Le nom de l''entreprise est obligatoire.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : % (attendu standard|silver|gold)', p_plan;
  end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 90 then
    raise exception 'Durée d''essai invalide (0..90 jours).';
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then
    raise exception 'Le slug de l''entreprise est obligatoire.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug invalide : minuscules, chiffres et tirets uniquement.';
  end if;

  if exists (select 1 from public.establishments e where e.slug = v_slug) then
    raise exception 'Une entreprise avec le slug « % » existe déjà.', v_slug;
  end if;

  -- Contrôle du Manager : utilisateur Auth existant + pas déjà rattaché.
  if p_manager_user_id is not null then
    if not exists (select 1 from auth.users u where u.id = p_manager_user_id) then
      raise exception 'Compte Manager introuvable dans Auth.';
    end if;

    select * into v_manager_profile from public.profiles where id = p_manager_user_id;
    if found then
      if v_manager_profile.establishment_id is not null then
        raise exception 'Ce compte est déjà rattaché à une entreprise.';
      end if;
      if v_manager_profile.role <> 'manager' then
        raise exception 'Ce compte possède déjà un rôle incompatible (%).', v_manager_profile.role;
      end if;
    end if;
  end if;

  -- Enregistrement de la demande AVANT insertion (traçabilité + verrou idempotence).
  if v_request is not null then
    insert into public.onboarding_requests (request_id, company_name, slug, plan, company_email, manager_user_id, status)
    values (v_request, trim(p_company_name), v_slug, p_plan, p_email, p_manager_user_id, 'started')
    on conflict (request_id) do nothing;
  end if;

  -- 1) Entreprise.
  insert into public.establishments (name, slug, city, phone, email, plan, is_active, trial_ends_at)
  values (trim(p_company_name), v_slug, p_city, p_phone, p_email, p_plan, true,
          case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else null end)
  returning id into v_etab_id;

  -- 2) Abonnement initial (essai ou actif).
  insert into public.subscriptions (establishment_id, plan_code, status, trial_ends_at, current_period_end)
  values (
    v_etab_id,
    p_plan,
    case when p_trial_days > 0 then 'trial' else 'active' end,
    case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else null end,
    case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else now() + interval '1 year' end
  )
  returning id into v_sub_id;

  -- 3) Manager propriétaire (profil lié à l'entreprise).
  if p_manager_user_id is not null then
    insert into public.profiles (id, full_name, phone, establishment_id, role, is_active)
    values (
      p_manager_user_id,
      coalesce(nullif(trim(p_manager_name), ''), split_part(coalesce(p_email, 'Manager'), '@', 1)),
      p_manager_phone,
      v_etab_id,
      'manager',
      true
    )
    on conflict (id) do update
      set full_name = excluded.full_name,
          phone = excluded.phone,
          establishment_id = excluded.establishment_id,
          role = 'manager',
          is_active = true;
  end if;

  -- 4) Journal d'audit (sans secret).
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    v_etab_id,
    auth.uid(),
    'onboard_tenant',
    'establishment',
    v_etab_id,
    jsonb_build_object(
      'company', p_company_name,
      'slug', v_slug,
      'plan', p_plan,
      'trial_days', p_trial_days,
      'manager_user_id', p_manager_user_id,
      'subscription_id', v_sub_id,
      'request_id', v_request
    )
  );

  -- 5) Clôture de la demande.
  if v_request is not null then
    update public.onboarding_requests
       set establishment_id = v_etab_id, status = 'completed', completed_at = now()
     where request_id = v_request;
  end if;

  return jsonb_build_object(
    'idempotent', false,
    'status', 'completed',
    'establishment_id', v_etab_id,
    'subscription_id', v_sub_id,
    'manager_user_id', p_manager_user_id,
    'request_id', v_request
  );
end;
$$;

revoke all on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer,text) from public;
grant execute on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer,text) to authenticated;

comment on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer,text) is
  'Onboarding atomique entreprise + abonnement + Manager. Idempotent via request_id (UUID client).';

-- ---------------------------------------------------------------------
-- 4. Rattacher un Manager à une entreprise existante (compensation).
--    Utilisé si l'invitation a réussi mais l'association a échoué :
--    l'admin ré-invite/réutilise le même compte sans recréer l'entreprise.
-- ---------------------------------------------------------------------
create or replace function public.admin_attach_manager(
  p_establishment_id uuid,
  p_user_id          uuid,
  p_full_name        text,
  p_phone            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab public.establishments%rowtype;
  v_profile public.profiles%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select * into v_etab from public.establishments where id = p_establishment_id;
  if not found then
    raise exception 'Entreprise introuvable.';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Compte Manager introuvable dans Auth.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if found and v_profile.establishment_id is not null and v_profile.establishment_id <> p_establishment_id then
    raise exception 'Ce compte est déjà rattaché à une autre entreprise.';
  end if;

  insert into public.profiles (id, full_name, phone, establishment_id, role, is_active)
  values (p_user_id, coalesce(nullif(trim(p_full_name), ''), 'Manager'), p_phone, p_establishment_id, 'manager', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, profiles.phone),
        establishment_id = excluded.establishment_id,
        role = 'manager',
        is_active = true;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_establishment_id, auth.uid(), 'attach_manager', 'profile', p_user_id,
          jsonb_build_object('full_name', p_full_name));

  return jsonb_build_object('status', 'attached', 'establishment_id', p_establishment_id, 'manager_user_id', p_user_id);
end;
$$;

revoke all on function public.admin_attach_manager(uuid,uuid,text,text) from public;
grant execute on function public.admin_attach_manager(uuid,uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Vérification de cohérence (lecture seule)
-- ---------------------------------------------------------------------
create or replace function public.admin_tenant_integrity(p_establishment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab public.establishments%rowtype;
  v_managers integer;
  v_sub public.subscriptions%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select * into v_etab from public.establishments where id = p_establishment_id;
  if not found then
    raise exception 'Entreprise introuvable.';
  end if;

  select count(*) into v_managers
    from public.profiles
   where establishment_id = p_establishment_id and role = 'manager';

  select * into v_sub
    from public.subscriptions
   where establishment_id = p_establishment_id
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'establishment_id', p_establishment_id,
    'is_active', v_etab.is_active,
    'plan', v_etab.plan,
    'managers', v_managers,
    'has_manager', v_managers > 0,
    'subscription_status', v_sub.status,
    'subscription_plan', v_sub.plan_code,
    'coherent', (v_managers > 0 and v_sub.id is not null)
  );
end;
$$;

revoke all on function public.admin_tenant_integrity(uuid) from public;
grant execute on function public.admin_tenant_integrity(uuid) to authenticated;

-- =====================================================================
-- POST-CHECKS (lecture seule) : vérifiez que l'application a réussi.
-- =====================================================================
select proname, pg_get_function_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('admin_onboard_tenant','admin_attach_manager','admin_find_user_id_by_email','admin_find_onboarding_request','admin_tenant_integrity')
order by p.proname;

select case when exists (
         select 1 from information_schema.tables
          where table_schema='public' and table_name='onboarding_requests'
       ) then 'onboarding_requests : CRÉÉE' else 'onboarding_requests : ABSENTE — 0028 a échoué' end as resultat;

-- Intégrité de référence (à compléter avec un ID réel après le premier test) :
-- select public.admin_tenant_integrity('<establishment_id>');

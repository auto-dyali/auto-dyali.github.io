do $$ begin create type public.user_role as enum ('saas_admin','manager','employee','client'); exception when duplicate_object then null; end $$;
-- Fonctions de la forme PRODUCTION utiles au parcours (schéma seul)
CREATE OR REPLACE FUNCTION public.admin_attach_manager(p_establishment_id uuid, p_user_id uuid, p_full_name text, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.admin_change_plan(p_establishment_id uuid, p_plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ancien text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : %', p_plan;
  end if;

  select plan into v_ancien from public.establishments where id = p_establishment_id;
  if v_ancien is null then
    raise exception 'Établissement introuvable.';
  end if;

  update public.establishments
     set plan = p_plan, updated_at = now()
   where id = p_establishment_id;

  update public.subscriptions
     set plan_code = p_plan, status = 'active'
   where establishment_id = p_establishment_id
     and status in ('active','trial','past_due');

  -- Si aucun abonnement ouvert : en ouvrir un.
  if not exists (
    select 1 from public.subscriptions
     where establishment_id = p_establishment_id and status in ('active','trial','past_due')
  ) then
    insert into public.subscriptions (establishment_id, plan_code, status, current_period_end)
    values (p_establishment_id, p_plan, 'active', now() + interval '1 year');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'change_plan', 'establishment', p_establishment_id,
          jsonb_build_object('ancien', v_ancien, 'nouveau', p_plan));
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_create_establishment(p_name text, p_slug text, p_city text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_plan text DEFAULT 'standard'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom de l’établissement est obligatoire.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : % (attendu standard|silver|gold)', p_plan;
  end if;

  insert into public.establishments (name, slug, city, phone, email, plan, is_active)
  values (trim(p_name), trim(p_slug), p_city, p_phone, p_email, p_plan, true)
  returning id into v_id;

  insert into public.subscriptions (establishment_id, plan_code, status, trial_ends_at, current_period_end)
  values (v_id, p_plan, 'trial', now() + interval '14 days', now() + interval '14 days');

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'create', 'establishment', v_id,
          jsonb_build_object('name', p_name, 'plan', p_plan, 'slug', p_slug));

  return v_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_find_onboarding_request(p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.admin_find_user_id_by_email(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.admin_onboard_tenant(p_company_name text, p_slug text, p_city text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_plan text DEFAULT 'standard'::text, p_manager_user_id uuid DEFAULT NULL::uuid, p_manager_name text DEFAULT NULL::text, p_manager_phone text DEFAULT NULL::text, p_trial_days integer DEFAULT 14, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.admin_save_plan(p_code text, p_price_monthly numeric, p_price_yearly numeric, p_trial_days integer, p_max_users integer, p_max_sites integer, p_storage_mb integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.plans
     set price_monthly = p_price_monthly,
         price_yearly = p_price_yearly,
         trial_days = p_trial_days,
         max_users = p_max_users,
         max_sites = p_max_sites,
         storage_mb = p_storage_mb,
         updated_at = now()
   where code = p_code;
  if not found then
    raise exception 'Forfait inconnu : %', p_code;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'save_plan', 'plan', null,
          jsonb_build_object('code', p_code,
                             'price_monthly', p_price_monthly,
                             'price_yearly', p_price_yearly));
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_establishment_status(p_establishment_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.establishments
     set is_active = p_active,
         suspended_at = case when p_active then null else now() end,
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
$function$


CREATE OR REPLACE FUNCTION public.admin_set_feature(p_plan_code text, p_feature text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.plan_features
     set enabled = p_enabled
   where plan_code = p_plan_code and feature_key = p_feature;
  if not found then
    raise exception 'Fonctionnalité % inconnue pour le forfait %', p_feature, p_plan_code;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'set_feature', 'plan_feature', null,
          jsonb_build_object('plan', p_plan_code, 'feature', p_feature, 'enabled', p_enabled));
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_tenant_integrity(p_establishment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.autoplus_current_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.profiles
  where id = auth.uid();
$function$


CREATE OR REPLACE FUNCTION public.current_establishment_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select establishment_id
  from public.profiles
  where id = auth.uid();
$function$


CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS TABLE(role user_role, establishment_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.role, p.establishment_id
  from public.profiles as p
  where p.id = auth.uid();
$function$


CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select autoplus_current_role() in ('manager','saas_admin');
$function$


CREATE OR REPLACE FUNCTION public.is_saas_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.autoplus_current_role() = 'saas_admin'::public.user_role;
$function$


CREATE OR REPLACE FUNCTION public.my_features()
 RETURNS TABLE(feature_key text, enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pf.feature_key, pf.enabled
    from public.establishments e
    join public.plan_features pf on pf.plan_code = e.plan
   where e.id = public.current_establishment_id();
$function$


-- =====================================================================
-- AUTO DYALI — RÉCONCILIATION 20261124 — Parcours abonné / Manager
-- CIBLE : STAGING yocufscgninxiihwiepa UNIQUEMENT.
-- NE PAS EXÉCUTER SUR PRODUCTION (nxmsqqoflskfajqrqddw).
--
-- Objet (idempotent, aucune donnée supprimée) :
--   1. Rétablit admin_onboard_tenant_v2 avec les 6 champs administratifs
--      (country, legal_info, fiscal_info, admin_info, dossier_state,
--      complementary_contacts) que la version m0039_onboard_v2 du
--      20/11/2026 a écrasés. Le corps est celui réellement appliqué,
--      augmenté des 6 colonnes : aucune régression fonctionnelle.
--   2. Corrige admin_update_manager : synchronise auth.identities
--      (identity_data.email) lors d'un changement d'e-mail et rétablit
--      la regex d'e-mail exacte (le backslash avait été perdu).
--   3. Répare les identités e-mail divergentes (auth.users vs auth.identities).
--   4. Réinstalle admin_identity_v2_health (diagnostic préflight).
--
-- Ce fichier n'est PAS dans supabase/migrations/ : il ne doit jamais être
-- emporté par un `supabase db push` (l'historique distant est horodaté et
-- ne correspond pas aux préfixes locaux 0001..0043).
-- Application : supabase db query --remote=<ref> --file=<ce fichier>
-- =====================================================================

-- 0. Pré-contrôles : échouer avant toute modification si le socle manque.
do $$
declare
  v_manquants text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then v_manquants := v_manquants || 'establishments'; end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='invitations') then v_manquants := v_manquants || 'invitations'; end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='onboarding_requests') then v_manquants := v_manquants || 'onboarding_requests'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='establishments' and column_name='country') then v_manquants := v_manquants || 'establishments.country'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='establishments' and column_name='complementary_contacts') then v_manquants := v_manquants || 'establishments.complementary_contacts'; end if;
  if array_length(v_manquants,1) is not null then
    raise exception 'ARRÊT réconciliation 20261124 : objets manquants → %', array_to_string(v_manquants, ', ');
  end if;
  raise notice 'Réconciliation 20261124 — pré-contrôles OK.';
end $$;

-- 1. Champs administratifs (déjà présents sur staging, idempotent).
alter table public.establishments
  add column if not exists country text,
  add column if not exists legal_info text,
  add column if not exists fiscal_info text,
  add column if not exists admin_info text,
  add column if not exists dossier_state text,
  add column if not exists complementary_contacts text;

-- 2. admin_onboard_tenant_v2 — version appliquée + 6 champs administratifs.
CREATE OR REPLACE FUNCTION public.admin_onboard_tenant_v2(p_request_id text, p_establishment jsonb, p_manager jsonb, p_subscription jsonb, p_modules text[], p_permissions jsonb, p_invitation_token_hash text, p_invitation_expires_at timestamp with time zone, p_delivery_channels text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_existing public.onboarding_requests%rowtype; v_etab_id uuid; v_sub_id uuid; v_inv_id uuid; v_manager_id uuid;
  v_plan text; v_paid_months integer; v_trial_days integer; v_start_date date; v_professional_id text;
  v_login_id text; v_email text; v_slug text; v_modules text[]; v_invalid_modules text[];
  v_want_email boolean := 'email' = any(coalesce(p_delivery_channels, '{}'::text[]));
  v_want_whatsapp boolean := 'whatsapp' = any(coalesce(p_delivery_channels, '{}'::text[]));
  v_forbidden text[];
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé : réservé au Super Admin.'; end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then raise exception 'request_id obligatoire.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));
  select * into v_existing from public.onboarding_requests where request_id = p_request_id;
  if found and v_existing.status = 'completed' then
    return jsonb_build_object('idempotent', true, 'status', 'completed', 'establishment_id', v_existing.establishment_id, 'manager_user_id', v_existing.manager_user_id, 'invitation_id', v_existing.invitation_id, 'request_id', v_existing.request_id);
  end if;
  v_plan := lower(trim(coalesce(p_subscription->>'plan', '')));
  v_paid_months := coalesce((p_subscription->>'paid_months')::integer, 0);
  v_trial_days := coalesce((p_subscription->>'trial_days')::integer, 0);
  v_start_date := coalesce((p_subscription->>'start_date')::date, current_date);
  v_professional_id := upper(trim(coalesce(p_establishment->>'professional_id', '')));
  v_login_id := lower(trim(coalesce(p_manager->>'login_id', '')));
  v_email := lower(trim(coalesce(p_manager->>'email', '')));
  v_slug := lower(trim(coalesce(p_establishment->>'slug', '')));
  v_manager_id := nullif(p_manager->>'user_id', '')::uuid;
  v_modules := coalesce(p_modules, '{}'::text[]);
  if v_manager_id is null then raise exception 'Compte Manager requis (user_id).'; end if;
  if not exists (select 1 from auth.users u where u.id = v_manager_id) then raise exception 'Compte Manager introuvable dans Auth.'; end if;
  if not exists (select 1 from public.plans pl where pl.code = v_plan) then raise exception 'Forfait inconnu : %.', v_plan; end if;
  if v_paid_months < 1 or v_paid_months > 120 then raise exception 'Durée facturée invalide (1 à 120 mois).'; end if;
  if v_trial_days < 0 or v_trial_days > 365 then raise exception 'Durée d essai invalide (0 à 365 jours).'; end if;
  if v_professional_id = '' then raise exception 'Identifiant professionnel obligatoire.'; end if;
  if v_login_id = '' then raise exception 'Identifiant de connexion obligatoire.'; end if;
  if p_invitation_token_hash is null or length(p_invitation_token_hash) < 32 then raise exception 'Empreinte de jeton d invitation invalide.'; end if;
  if exists (select 1 from public.establishments e where upper(e.professional_id) = v_professional_id) then raise exception 'Identifiant professionnel déjà utilisé : %.', v_professional_id; end if;
  if exists (select 1 from public.establishments e where e.slug = v_slug) then raise exception 'Slug déjà utilisé : %.', v_slug; end if;
  if exists (select 1 from public.profiles p where lower(p.login_id) = v_login_id) then raise exception 'Identifiant de connexion déjà utilisé : %.', v_login_id; end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> v_manager_id) then raise exception 'Un autre compte existe déjà pour cet e-mail Manager.'; end if;
  if not exists (select 1 from auth.users u where u.id = v_manager_id and lower(u.email) = v_email) then raise exception 'Le compte Auth ne correspond pas à l e-mail Manager fourni.'; end if;
  if exists (select 1 from public.profiles p where p.id = v_manager_id and p.establishment_id is not null) then raise exception 'Ce compte Manager est déjà rattaché à une entreprise.'; end if;
  select coalesce(array_agg(distinct pf.feature_key), '{}'::text[]) into v_modules from public.plan_features pf where pf.plan_code = v_plan and pf.enabled = true and pf.feature_key = any(v_modules);
  select coalesce(array_agg(m), '{}'::text[]) into v_invalid_modules from unnest(coalesce(p_modules, '{}'::text[])) as m where m <> all (v_modules);
  if array_length(v_invalid_modules, 1) is not null then raise exception 'Modules non inclus dans le forfait % : %.', v_plan, array_to_string(v_invalid_modules, ', '); end if;
  if array_length(coalesce(v_modules, '{}'::text[]), 1) is null then raise exception 'Aucun module du forfait % n a été attribué.', v_plan; end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then raise exception 'Permissions absentes ou invalides.'; end if;
  if jsonb_array_length(p_permissions) <> array_length(v_modules, 1) then raise exception 'Permissions incohérentes : % permission(s) pour % module(s).', jsonb_array_length(p_permissions), array_length(v_modules, 1); end if;
  if exists (select 1 from jsonb_array_elements(p_permissions) e where not (e->>'module' = any(v_modules)) or coalesce((e->>'can_view')::boolean, false) is not true) then raise exception 'Permission invalide : module hors forfait ou consultation absente.'; end if;
  if exists (select 1 from unnest(v_modules) m where not exists (select 1 from jsonb_array_elements(p_permissions) e where e->>'module' = m)) then raise exception 'Permission manquante pour un module attribué.'; end if;

  -- 1) Établissement
  insert into public.establishments (
    name, slug, address, city, phone, email, plan, is_active, trial_ends_at,
    professional_id, legal_name, activity_type, region, notes,
    country, legal_info, fiscal_info, admin_info, dossier_state, complementary_contacts
  ) values (
    trim(p_establishment->>'name'), v_slug,
    nullif(trim(coalesce(p_establishment->>'address','')),''),
    nullif(trim(coalesce(p_establishment->>'city','')),''),
    nullif(trim(coalesce(p_establishment->>'phone','')),''),
    nullif(trim(coalesce(p_establishment->>'email','')),''),
    v_plan, true,
    case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end,
    v_professional_id,
    nullif(trim(coalesce(p_establishment->>'legal_name','')),''),
    nullif(trim(coalesce(p_establishment->>'activity_type','')),''),
    nullif(trim(coalesce(p_establishment->>'region','')),''),
    nullif(trim(coalesce(p_establishment->>'notes','')),''),
    nullif(trim(coalesce(p_establishment->>'country','')),''),
    nullif(trim(coalesce(p_establishment->>'legal_info','')),''),
    nullif(trim(coalesce(p_establishment->>'fiscal_info','')),''),
    nullif(trim(coalesce(p_establishment->>'admin_info','')),''),
    nullif(trim(coalesce(p_establishment->>'dossier_state','')),''),
    nullif(trim(coalesce(p_establishment->>'complementary_contacts','')),'')
  ) returning id into v_etab_id;

  -- 2) Abonnement
  insert into public.subscriptions (establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end) values (v_etab_id, v_plan, case when v_trial_days > 0 then 'trial' else 'active' end, v_start_date::timestamptz, case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end, (v_start_date + make_interval(months => v_paid_months))::timestamptz) returning id into v_sub_id;

  -- 3) Profil Manager
  insert into public.profiles (id, full_name, phone, establishment_id, role, is_active, login_id, must_change_password, temporary_password_issued_at, temporary_password_expires_at) values (v_manager_id, trim(coalesce(p_manager->>'full_name','Manager')), nullif(trim(coalesce(p_manager->>'phone','')),''), v_etab_id, 'manager', true, v_login_id, true, now(), now() + interval '7 days') on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, establishment_id = excluded.establishment_id, role = 'manager', is_active = true, login_id = excluded.login_id, must_change_password = true, temporary_password_issued_at = now(), temporary_password_expires_at = now() + interval '7 days', password_changed_at = null;

  -- 4) Modules + permissions
  delete from public.permissions where establishment_id = v_etab_id and role = 'manager';
  insert into public.permissions (establishment_id, role, module, can_view, can_create, can_edit, can_delete) select v_etab_id, 'manager', e->>'module', true, coalesce((e->>'can_create')::boolean, false), coalesce((e->>'can_edit')::boolean, false), coalesce((e->>'can_delete')::boolean, false) from jsonb_array_elements(p_permissions) e;

  -- 5) Invitation
  insert into public.invitations (token_hash, email, manager_user_id, establishment_id, manager_full_name, manager_phone, plan_code, status, expires_at, created_by, email_status, whatsapp_status) values (p_invitation_token_hash, v_email, v_manager_id, v_etab_id, trim(coalesce(p_manager->>'full_name','Manager')), nullif(trim(coalesce(p_manager->>'phone','')),''), v_plan, 'prepared', coalesce(p_invitation_expires_at, now() + interval '7 days'), auth.uid(), case when v_want_email then 'en_attente' else 'non_demande' end, case when v_want_whatsapp then 'en_attente' else 'non_demande' end) returning id into v_inv_id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata) values (v_inv_id, 'system', 'prepared', jsonb_build_object('professional_id', v_professional_id, 'login_id', v_login_id, 'plan', v_plan, 'modules', v_modules, 'channels', coalesce(p_delivery_channels, '{}'::text[])));

  -- 6) Audit
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json) values (v_etab_id, auth.uid(), 'onboard_tenant_v2', 'establishment', v_etab_id, jsonb_build_object('request_id', p_request_id, 'professional_id', v_professional_id, 'login_id', v_login_id, 'plan', v_plan, 'paid_months', v_paid_months, 'trial_days', v_trial_days, 'modules', v_modules, 'subscription_id', v_sub_id, 'invitation_id', v_inv_id));

  -- 7) Clôture
  insert into public.onboarding_requests (request_id, company_name, slug, plan, company_email, manager_user_id, establishment_id, invitation_id, status, completed_at) values (p_request_id, trim(p_establishment->>'name'), v_slug, v_plan, nullif(trim(coalesce(p_establishment->>'email','')),''), v_manager_id, v_etab_id, v_inv_id, 'completed', now()) on conflict (request_id) do update set manager_user_id = excluded.manager_user_id, establishment_id = excluded.establishment_id, invitation_id = excluded.invitation_id, status = 'completed', completed_at = now();

  return jsonb_build_object('idempotent', false, 'status', 'completed', 'establishment_id', v_etab_id, 'subscription_id', v_sub_id, 'manager_user_id', v_manager_id, 'invitation_id', v_inv_id, 'professional_id', v_professional_id, 'login_id', v_login_id, 'modules', v_modules, 'request_id', p_request_id);
end; $function$;


revoke execute on function public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]) from public;
revoke execute on function public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]) from anon;
grant execute on function public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]) to authenticated;

-- 3. admin_update_manager — synchronisation auth.identities + regex exacte.
create or replace function public.admin_update_manager(
  p_profile_id uuid,
  p_full_name text,
  p_login_id text,
  p_phone text,
  p_is_active boolean,
  p_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil public.profiles%rowtype;
  v_conflit uuid;
  v_ancien_email text;
  v_nouvel_email text;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then raise exception 'Le nom du Manager est obligatoire.'; end if;

  select * into v_profil from public.profiles where id = p_profile_id and role = 'manager';
  if not found then raise exception 'Manager introuvable.'; end if;

  if nullif(btrim(coalesce(p_login_id, '')), '') is not null then
    select p.id into v_conflit from public.profiles p
      where p.login_id = btrim(p_login_id) and p.id <> p_profile_id limit 1;
    if v_conflit is not null then raise exception 'Cet identifiant de connexion est déjà utilisé.'; end if;
  end if;

  v_nouvel_email := lower(nullif(btrim(coalesce(p_email, '')), ''));
  if v_nouvel_email is not null then
    if v_nouvel_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Adresse e-mail invalide.';
    end if;
    select u.email into v_ancien_email from auth.users u where u.id = p_profile_id;
    if v_ancien_email is distinct from v_nouvel_email then
      select u.id into v_conflit from auth.users u
        where lower(u.email) = v_nouvel_email and u.id <> p_profile_id limit 1;
      if v_conflit is not null then raise exception 'Cet e-mail est déjà rattaché à un autre compte.'; end if;

      update auth.users set email = v_nouvel_email, updated_at = now() where id = p_profile_id;
      update auth.identities
         set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_nouvel_email), true),
             updated_at = now()
       where user_id = p_profile_id and provider = 'email';
    end if;
  end if;

  update public.profiles set
    full_name = btrim(p_full_name),
    login_id = nullif(btrim(coalesce(p_login_id, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    is_active = coalesce(p_is_active, is_active)
  where id = p_profile_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_profil.establishment_id, auth.uid(), 'update_manager', 'profile', p_profile_id,
          jsonb_build_object('full_name', btrim(p_full_name), 'login_id', nullif(btrim(coalesce(p_login_id, '')), ''),
                             'is_active', coalesce(p_is_active, v_profil.is_active),
                             'email_changes', v_ancien_email is distinct from v_nouvel_email));

  return jsonb_build_object('ok', true, 'id', p_profile_id, 'email_changed', v_ancien_email is distinct from v_nouvel_email);
end; $$;

revoke execute on function public.admin_update_manager(uuid, text, text, text, boolean, text) from public;
revoke execute on function public.admin_update_manager(uuid, text, text, text, boolean, text) from anon;
grant execute on function public.admin_update_manager(uuid, text, text, text, boolean, text) to authenticated;

-- 4. Réparation des identités e-mail divergentes (aucune donnée supprimée).
update auth.identities i
   set identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email}', to_jsonb(u.email), true),
       updated_at = now()
  from auth.users u
 where u.id = i.user_id
   and i.provider = 'email'
   and u.email is not null
   and lower(coalesce(i.identity_data->>'email','')) is distinct from lower(u.email);

-- 5. Diagnostic préflight (idempotent).
create or replace function public.admin_identity_v2_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;

  return jsonb_build_object(
    'establishments_professional_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='establishments' and column_name='professional_id'),
    'profiles_login_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='login_id'),
    'profiles_must_change_password', exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='must_change_password'),
    'fn_admin_check_identity_available', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_check_identity_available'),
    'fn_admin_onboard_tenant_v2', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_onboard_tenant_v2'),
    'fn_get_my_profile', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_my_profile'),
    'fn_get_my_security_state', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_my_security_state'),
    'fn_resolve_login_email', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_login_email'),
    'fn_must_change_password', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='must_change_password')
  );
end; $$;

revoke all on function public.admin_identity_v2_health() from public;
revoke all on function public.admin_identity_v2_health() from anon;
grant execute on function public.admin_identity_v2_health() to authenticated;

-- 6. hash_invitation_token — pgcrypto est installé dans le schéma `extensions`
--    sur Supabase. Sans ce search_path, `digest()` est introuvable et TOUTE
--    activation d'invitation échoue (erreur reproduite le 24/11/2026).
create or replace function public.hash_invitation_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$ select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex'); $$;

revoke all on function public.hash_invitation_token(text) from public;
revoke all on function public.hash_invitation_token(text) from anon;
grant execute on function public.hash_invitation_token(text) to authenticated, service_role;

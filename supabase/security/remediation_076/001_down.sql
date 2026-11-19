-- ROLLBACK GV5 §76 / 001 — restaure la RPC de création à sa version §75
-- (INSERT sans les 6 colonnes administratives). Aucune donnée n'est supprimée.

create or replace function public.admin_onboard_tenant_v2(
  p_request_id text, p_establishment jsonb, p_manager jsonb, p_subscription jsonb,
  p_modules text[], p_permissions jsonb, p_invitation_token_hash text,
  p_invitation_expires_at timestamp with time zone, p_delivery_channels text[]
) returns jsonb
language plpgsql security definer set search_path = public, auth
as $function$
declare
  v_existing public.onboarding_requests%rowtype;
  v_etab_id uuid; v_sub_id uuid; v_inv_id uuid; v_manager_id uuid;
  v_plan text; v_paid_months integer; v_trial_days integer; v_start_date date;
  v_professional_id text; v_login_id text; v_email text; v_slug text;
  v_modules text[]; v_invalid_modules text[];
  v_want_email boolean := 'email' = any(coalesce(p_delivery_channels, '{}'::text[]));
  v_want_whatsapp boolean := 'whatsapp' = any(coalesce(p_delivery_channels, '{}'::text[]));
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
  if v_trial_days < 0 or v_trial_days > 365 then raise exception 'Durée d''essai invalide (0 à 365 jours).'; end if;
  if v_professional_id = '' then raise exception 'Identifiant professionnel obligatoire.'; end if;
  if v_login_id = '' then raise exception 'Identifiant de connexion obligatoire.'; end if;
  if p_invitation_token_hash is null or length(p_invitation_token_hash) < 32 then raise exception 'Empreinte de jeton invalide.'; end if;
  if exists (select 1 from public.establishments e where upper(e.professional_id) = v_professional_id) then raise exception 'Identifiant professionnel déjà utilisé.'; end if;
  if exists (select 1 from public.establishments e where e.slug = v_slug) then raise exception 'Slug déjà utilisé.'; end if;
  if exists (select 1 from public.profiles p where lower(p.login_id) = v_login_id) then raise exception 'Identifiant de connexion déjà utilisé.'; end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> v_manager_id) then raise exception 'Un autre compte existe pour cet e-mail.'; end if;
  if not exists (select 1 from auth.users u where u.id = v_manager_id and lower(u.email) = v_email) then raise exception 'Le compte Auth ne correspond pas à l''e-mail Manager.'; end if;
  if exists (select 1 from public.profiles p where p.id = v_manager_id and p.establishment_id is not null) then raise exception 'Ce compte est déjà rattaché à une entreprise.'; end if;
  select coalesce(array_agg(distinct pf.feature_key), '{}'::text[]) into v_modules from public.plan_features pf where pf.plan_code = v_plan and pf.enabled = true and pf.feature_key = any(v_modules);
  select coalesce(array_agg(m), '{}'::text[]) into v_invalid_modules from unnest(coalesce(p_modules, '{}'::text[])) as m where m <> all (v_modules);
  if array_length(v_invalid_modules, 1) is not null then raise exception 'Modules non inclus dans le forfait.'; end if;
  if array_length(coalesce(v_modules, '{}'::text[]), 1) is null then raise exception 'Aucun module du forfait attribué.'; end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then raise exception 'Permissions absentes ou invalides.'; end if;
  if jsonb_array_length(p_permissions) <> array_length(v_modules, 1) then raise exception 'Permissions incohérentes.'; end if;
  if exists (select 1 from jsonb_array_elements(p_permissions) e where not (e->>'module' = any(v_modules)) or coalesce((e->>'can_view')::boolean, false) is not true) then raise exception 'Permission invalide.'; end if;
  insert into public.establishments (name, slug, address, city, phone, email, plan, is_active, trial_ends_at, professional_id, legal_name, activity_type, region, notes)
  values (trim(p_establishment->>'name'), v_slug,
          nullif(trim(coalesce(p_establishment->>'address','')), ''),
          nullif(trim(coalesce(p_establishment->>'city','')), ''),
          nullif(trim(coalesce(p_establishment->>'phone','')), ''),
          nullif(trim(coalesce(p_establishment->>'email','')), ''),
          v_plan, true,
          case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end,
          v_professional_id,
          nullif(trim(coalesce(p_establishment->>'legal_name','')), ''),
          nullif(trim(coalesce(p_establishment->>'activity_type','')), ''),
          nullif(trim(coalesce(p_establishment->>'region','')), ''),
          nullif(trim(coalesce(p_establishment->>'notes','')), '')) returning id into v_etab_id;
  insert into public.subscriptions (establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end)
  values (v_etab_id, v_plan, case when v_trial_days > 0 then 'trial' else 'active' end,
          v_start_date::timestamptz,
          case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end,
          (v_start_date + make_interval(months => v_paid_months))::timestamptz) returning id into v_sub_id;
  insert into public.profiles (id, full_name, phone, establishment_id, role, is_active, login_id, must_change_password, temporary_password_issued_at, temporary_password_expires_at)
  values (v_manager_id, trim(coalesce(p_manager->>'full_name', 'Manager')),
          nullif(trim(coalesce(p_manager->>'phone','')), ''), v_etab_id, 'manager', true, v_login_id, true,
          now(), now() + interval '7 days')
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone,
    establishment_id = excluded.establishment_id, role = 'manager', is_active = true,
    login_id = excluded.login_id, must_change_password = true,
    temporary_password_issued_at = now(), temporary_password_expires_at = now() + interval '7 days',
    password_changed_at = null;
  delete from public.permissions where establishment_id = v_etab_id and role = 'manager';
  insert into public.permissions (establishment_id, role, module, can_view, can_create, can_edit, can_delete)
  select v_etab_id, 'manager', e->>'module', true, coalesce((e->>'can_create')::boolean, false),
    coalesce((e->>'can_edit')::boolean, false), coalesce((e->>'can_delete')::boolean, false)
  from jsonb_array_elements(p_permissions) e;
  insert into public.invitations (token_hash, email, manager_user_id, establishment_id, manager_full_name, manager_phone, plan_code, status, expires_at, created_by, email_status, whatsapp_status)
  values (p_invitation_token_hash, v_email, v_manager_id, v_etab_id,
          trim(coalesce(p_manager->>'full_name', 'Manager')),
          nullif(trim(coalesce(p_manager->>'phone','')), ''), v_plan, 'prepared',
          coalesce(p_invitation_expires_at, now() + interval '7 days'), auth.uid(),
          case when v_want_email then 'en_attente' else 'non_demande' end,
          case when v_want_whatsapp then 'en_attente' else 'non_demande' end) returning id into v_inv_id;
  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (v_inv_id, 'system', 'prepared', jsonb_build_object('professional_id', v_professional_id, 'login_id', v_login_id, 'plan', v_plan, 'modules', v_modules, 'channels', coalesce(p_delivery_channels, '{}'::text[])));
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_etab_id, auth.uid(), 'onboard_tenant_v2', 'establishment', v_etab_id,
          jsonb_build_object('request_id', p_request_id, 'professional_id', v_professional_id,
                             'login_id', v_login_id, 'plan', v_plan, 'paid_months', v_paid_months,
                             'trial_days', v_trial_days, 'subscription_id', v_sub_id, 'invitation_id', v_inv_id));
  insert into public.onboarding_requests (request_id, company_name, slug, plan, company_email, manager_user_id, establishment_id, invitation_id, status, completed_at)
  values (p_request_id, trim(p_establishment->>'name'), v_slug, v_plan,
          nullif(trim(coalesce(p_establishment->>'email','')), ''), v_manager_id, v_etab_id, v_inv_id, 'completed', now())
  on conflict (request_id) do update set manager_user_id = excluded.manager_user_id,
    establishment_id = excluded.establishment_id, invitation_id = excluded.invitation_id,
    status = 'completed', completed_at = now();
  return jsonb_build_object('idempotent', false, 'status', 'completed',
    'establishment_id', v_etab_id, 'subscription_id', v_sub_id, 'manager_user_id', v_manager_id,
    'invitation_id', v_inv_id, 'professional_id', v_professional_id, 'login_id', v_login_id,
    'modules', v_modules, 'request_id', p_request_id);
end; $function$;

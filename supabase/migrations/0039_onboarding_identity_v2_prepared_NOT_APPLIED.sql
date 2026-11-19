-- =====================================================================
-- AUTO DYALI — 0039 (GV5 §51) : Identités Super Admin, permissions
--                              réelles et mot de passe temporaire
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Objet :
--   1. Identifiant professionnel AUTO DYALI (choisi par le Super Admin),
--      unique en base.
--   2. Identifiant de connexion Manager (login_id), unique, résolvable
--      avant authentification (RPC dédiée).
--   3. Mot de passe temporaire : jamais stocké en base ; drapeau serveur
--      `must_change_password` + preuve de changement via auth.users.updated_at
--      + politiques RLS restrictives qui bloquent TOUTES les données tenant
--      tant que le mot de passe n'a pas été changé.
--   4. Attribution réelle des modules dans `public.permissions`, avec
--      contrôle d'appartenance au forfait, et `my_features()` qui applique
--      l'intersection forfait ∩ permissions.
--   5. RPC d'onboarding v2 idempotente (verrou consultatif + contrainte
--      unique), qui ne renvoie jamais de secret.
--
-- DÉPENDANCES : 0001, 0007, 0009, 0028, 0036 (invitations), 0037/0038.
-- ORDRE D'APPLICATION : 0036 → 0037 → 0038 → 0039.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='invitations') then
    raise exception 'ARRÊT 0039: table invitations absente (migration 0036).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='onboarding_requests') then
    raise exception 'ARRÊT 0039: table onboarding_requests absente (migration 0028).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='permissions') then
    raise exception 'ARRÊT 0039: table permissions absente (migration 0001).';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0039: is_saas_admin() absente.';
  end if;
  raise notice '0039 pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. Identités persistées
-- ---------------------------------------------------------------------
alter table public.establishments
  add column if not exists professional_id text,
  add column if not exists legal_name      text,
  add column if not exists activity_type   text,
  add column if not exists region          text,
  add column if not exists notes           text;

create unique index if not exists establishments_professional_id_key
  on public.establishments (upper(professional_id))
  where professional_id is not null;

alter table public.profiles
  add column if not exists login_id                       text,
  add column if not exists must_change_password           boolean not null default false,
  add column if not exists temporary_password_issued_at   timestamptz,
  add column if not exists temporary_password_expires_at  timestamptz,
  add column if not exists password_changed_at            timestamptz;

create unique index if not exists profiles_login_id_key
  on public.profiles (lower(login_id))
  where login_id is not null;

alter table public.onboarding_requests
  add column if not exists invitation_id uuid references public.invitations(id) on delete set null;

comment on column public.establishments.professional_id is
  'Identifiant professionnel AUTO DYALI choisi par le Super Admin. Unique (insensible à la casse).';
comment on column public.profiles.login_id is
  'Identifiant de connexion du Manager. Unique (insensible à la casse). Résolu vers l''e-mail Auth.';
comment on column public.profiles.must_change_password is
  'Drapeau serveur : tant qu''il est vrai, les politiques RLS restrictives bloquent les données tenant.';
comment on column public.profiles.temporary_password_issued_at is
  'Horodatage d''émission du mot de passe temporaire. Preuve de changement = auth.users.updated_at > cette valeur.';

-- ---------------------------------------------------------------------
-- 2. Drapeau « changement de mot de passe requis » (SECURITY DEFINER)
--    Lit profiles sans passer par les politiques restrictives.
-- ---------------------------------------------------------------------
create or replace function public.must_change_password()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.must_change_password from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.must_change_password() from public;
grant execute on function public.must_change_password() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Blocage RLS restrictif pendant la rotation du mot de passe
--    (s'applique à toutes les tables portant establishment_id)
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and exists (
         select 1 from information_schema.columns col
          where col.table_schema = 'public'
            and col.table_name = c.relname
            and col.column_name = 'establishment_id'
       )
  loop
    execute format('drop policy if exists password_rotation_required on public.%I', t.relname);
    execute format(
      'create policy password_rotation_required on public.%I as restrictive for all '
      'using (not public.must_change_password()) '
      'with check (not public.must_change_password())',
      t.relname
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. État de sécurité du compte connecté (guard applicatif fiable)
-- ---------------------------------------------------------------------
create or replace function public.get_my_security_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'establishment_id', p.establishment_id,
    'login_id', p.login_id,
    'must_change_password', p.must_change_password,
    'temporary_password_expires_at', p.temporary_password_expires_at,
    'password_changed_at', p.password_changed_at
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_security_state() from public;
grant execute on function public.get_my_security_state() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Résolution login → e-mail (pré-authentification)
--    Nécessaire car Supabase Auth s'authentifie par e-mail.
--    SECURITY DEFINER volontaire ; ne renvoie que des comptes actifs.
-- ---------------------------------------------------------------------
create or replace function public.resolve_login_email(p_login text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.login_id is not null
    and lower(p.login_id) = lower(trim(p_login))
    and p.is_active = true
    and p.role in ('manager', 'employee', 'saas_admin')
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

comment on function public.resolve_login_email(text) is
  'Traduit un identifiant de connexion en e-mail Auth. Comptes actifs uniquement. Aucune donnée tenant.';

-- ---------------------------------------------------------------------
-- 6. Permissions : lecture tenant, écriture Super Admin uniquement
-- ---------------------------------------------------------------------
drop policy if exists tenant_isolation on public.permissions;
drop policy if exists permissions_tenant_select on public.permissions;
drop policy if exists permissions_saas_admin_write on public.permissions;

create policy permissions_tenant_select on public.permissions
  for select using (establishment_id = public.current_establishment_id() or public.is_saas_admin());

create policy permissions_saas_admin_write on public.permissions
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

-- ---------------------------------------------------------------------
-- 7. my_features() = forfait ∩ permissions attribuées
--    Si aucune permission n'est définie pour l'établissement, le forfait
--    s'applique seul (compatibilité avec les comptes existants).
-- ---------------------------------------------------------------------
create or replace function public.my_features()
returns table(feature_key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select pf.feature_key,
         pf.enabled and (
           not exists (
             select 1 from public.permissions p0
              where p0.establishment_id = e.id
           )
           or exists (
             select 1 from public.permissions p1
              where p1.establishment_id = e.id
                and p1.module = pf.feature_key
                and p1.can_view = true
           )
         ) as enabled
    from public.establishments e
    join public.plan_features pf on pf.plan_code = e.plan
   where e.id = public.current_establishment_id();
$$;

revoke all on function public.my_features() from public;
grant execute on function public.my_features() to authenticated;

-- has_feature() applique la MÊME intersection : un module retiré par les
-- permissions est refusé côté serveur, pas seulement masqué dans le menu.
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pf.enabled
             and (
               not exists (
                 select 1 from public.permissions p0
                  where p0.establishment_id = e.id
               )
               or exists (
                 select 1 from public.permissions p1
                  where p1.establishment_id = e.id
                    and p1.module = pf.feature_key
                    and p1.can_view = true
               )
             )
        from public.establishments e
        join public.plan_features pf on pf.plan_code = e.plan
       where e.id = public.current_establishment_id()
         and pf.feature_key = p_feature
    ),
    false
  );
$$;

revoke all on function public.has_feature(text) from public;
grant execute on function public.has_feature(text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. my_permissions() : droits granulaires du rôle courant
-- ---------------------------------------------------------------------
create or replace function public.my_permissions()
returns table(module text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.module, p.can_view, p.can_create, p.can_edit, p.can_delete
    from public.permissions p
    join public.profiles me on me.id = auth.uid()
   where p.establishment_id = me.establishment_id
     and p.role = me.role;
$$;

revoke all on function public.my_permissions() from public;
grant execute on function public.my_permissions() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Vérification d'unicité en temps réel (Super Admin uniquement)
-- ---------------------------------------------------------------------
create or replace function public.admin_check_identity_available(
  p_professional_id text default null,
  p_login_id        text default null,
  p_manager_email   text default null,
  p_slug            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  return jsonb_build_object(
    'professional_id_available', not exists (
      select 1 from public.establishments e
       where p_professional_id is not null
         and e.professional_id is not null
         and upper(e.professional_id) = upper(trim(p_professional_id))
    ),
    'login_id_available', not exists (
      select 1 from public.profiles p
       where p_login_id is not null
         and p.login_id is not null
         and lower(p.login_id) = lower(trim(p_login_id))
    ),
    'email_available', not exists (
      select 1 from auth.users u
       where p_manager_email is not null and lower(u.email) = lower(trim(p_manager_email))
    ),
    'slug_available', not exists (
      select 1 from public.establishments e
       where p_slug is not null and e.slug = lower(trim(p_slug))
    )
  );
end;
$$;

revoke all on function public.admin_check_identity_available(text, text, text, text) from public;
grant execute on function public.admin_check_identity_available(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Onboarding v2 — transactionnel, idempotent, sans secret
-- ---------------------------------------------------------------------
create or replace function public.admin_onboard_tenant_v2(
  p_request_id            text,
  p_establishment         jsonb,
  p_manager               jsonb,
  p_subscription          jsonb,
  p_modules               text[],
  p_permissions           jsonb,
  p_invitation_token_hash text,
  p_invitation_expires_at timestamptz,
  p_delivery_channels     text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existing        public.onboarding_requests%rowtype;
  v_etab_id         uuid;
  v_sub_id          uuid;
  v_inv_id          uuid;
  v_manager_id      uuid;
  v_plan            text;
  v_paid_months     integer;
  v_trial_days      integer;
  v_start_date      date;
  v_professional_id text;
  v_login_id        text;
  v_email           text;
  v_slug            text;
  v_modules         text[];
  v_invalid_modules text[];
  v_want_email      boolean := 'email' = any(coalesce(p_delivery_channels, '{}'::text[]));
  v_want_whatsapp   boolean := 'whatsapp' = any(coalesce(p_delivery_channels, '{}'::text[]));
  v_forbidden       text[];
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception 'request_id obligatoire.';
  end if;

  -- Idempotence forte : verrou consultatif sur la requête.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));

  select * into v_existing from public.onboarding_requests where request_id = p_request_id;
  if found and v_existing.status = 'completed' then
    return jsonb_build_object(
      'idempotent', true,
      'status', 'completed',
      'establishment_id', v_existing.establishment_id,
      'manager_user_id', v_existing.manager_user_id,
      'invitation_id', v_existing.invitation_id,
      'request_id', v_existing.request_id
    );
  end if;

  v_plan            := lower(trim(coalesce(p_subscription->>'plan', '')));
  v_paid_months     := coalesce((p_subscription->>'paid_months')::integer, 0);
  v_trial_days      := coalesce((p_subscription->>'trial_days')::integer, 0);
  v_start_date      := coalesce((p_subscription->>'start_date')::date, current_date);
  v_professional_id := upper(trim(coalesce(p_establishment->>'professional_id', '')));
  v_login_id        := lower(trim(coalesce(p_manager->>'login_id', '')));
  v_email           := lower(trim(coalesce(p_manager->>'email', '')));
  v_slug            := lower(trim(coalesce(p_establishment->>'slug', '')));
  v_manager_id      := nullif(p_manager->>'user_id', '')::uuid;
  v_modules         := coalesce(p_modules, '{}'::text[]);

  if v_manager_id is null then
    raise exception 'Compte Manager requis (user_id).';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_manager_id) then
    raise exception 'Compte Manager introuvable dans Auth.';
  end if;

  if not exists (select 1 from public.plans pl where pl.code = v_plan) then
    raise exception 'Forfait inconnu : %.', v_plan;
  end if;
  if v_paid_months < 1 or v_paid_months > 120 then
    raise exception 'Durée facturée invalide (1 à 120 mois).';
  end if;
  if v_trial_days < 0 or v_trial_days > 365 then
    raise exception 'Durée d''essai invalide (0 à 365 jours).';
  end if;

  if v_professional_id = '' then
    raise exception 'Identifiant professionnel obligatoire.';
  end if;
  if v_login_id = '' then
    raise exception 'Identifiant de connexion obligatoire.';
  end if;
  if p_invitation_token_hash is null or length(p_invitation_token_hash) < 32 then
    raise exception 'Empreinte de jeton d''invitation invalide.';
  end if;

  if exists (select 1 from public.establishments e where upper(e.professional_id) = v_professional_id) then
    raise exception 'Identifiant professionnel déjà utilisé : %.', v_professional_id;
  end if;
  if exists (select 1 from public.establishments e where e.slug = v_slug) then
    raise exception 'Slug déjà utilisé : %.', v_slug;
  end if;
  if exists (select 1 from public.profiles p where lower(p.login_id) = v_login_id) then
    raise exception 'Identifiant de connexion déjà utilisé : %.', v_login_id;
  end if;
  if exists (
    select 1 from auth.users u
     where lower(u.email) = v_email and u.id <> v_manager_id
  ) then
    raise exception 'Un autre compte existe déjà pour cet e-mail Manager.';
  end if;
  if not exists (
    select 1 from auth.users u where u.id = v_manager_id and lower(u.email) = v_email
  ) then
    raise exception 'Le compte Auth ne correspond pas à l''e-mail Manager fourni.';
  end if;
  if exists (
    select 1 from public.profiles p
     where p.id = v_manager_id and p.establishment_id is not null
  ) then
    raise exception 'Ce compte Manager est déjà rattaché à une entreprise.';
  end if;

  -- Modules : uniquement ceux réellement inclus dans le forfait.
  select coalesce(array_agg(distinct pf.feature_key), '{}'::text[])
    into v_modules
    from public.plan_features pf
   where pf.plan_code = v_plan
     and pf.enabled = true
     and pf.feature_key = any(v_modules);

  select coalesce(array_agg(m), '{}'::text[])
    into v_invalid_modules
    from unnest(coalesce(p_modules, '{}'::text[])) as m
   where m <> all (v_modules);

  if array_length(v_invalid_modules, 1) is not null then
    raise exception 'Modules non inclus dans le forfait % : %.', v_plan, array_to_string(v_invalid_modules, ', ');
  end if;
  if array_length(coalesce(v_modules, '{}'::text[]), 1) is null then
    raise exception 'Aucun module du forfait % n''a été attribué.', v_plan;
  end if;

  -- Permissions : chaque module ouvert doit être décrit, avec au moins la
  -- consultation. Aucune permission n'est inventée côté serveur.
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then
    raise exception 'Permissions absentes ou invalides.';
  end if;
  if jsonb_array_length(p_permissions) <> array_length(v_modules, 1) then
    raise exception 'Permissions incohérentes : % permission(s) pour % module(s).',
      jsonb_array_length(p_permissions), array_length(v_modules, 1);
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_permissions) e
     where not (e->>'module' = any(v_modules))
        or coalesce((e->>'can_view')::boolean, false) is not true
  ) then
    raise exception 'Permission invalide : module hors forfait ou consultation absente.';
  end if;
  if exists (
    select 1 from unnest(v_modules) m
     where not exists (
       select 1 from jsonb_array_elements(p_permissions) e where e->>'module' = m
     )
  ) then
    raise exception 'Permission manquante pour un module attribué.';
  end if;

  -- 1) Établissement
  insert into public.establishments (
    name, slug, address, city, phone, email, plan, is_active,
    trial_ends_at, professional_id, legal_name, activity_type, region, notes
  ) values (
    trim(p_establishment->>'name'),
    v_slug,
    nullif(trim(coalesce(p_establishment->>'address','')), ''),
    nullif(trim(coalesce(p_establishment->>'city','')), ''),
    nullif(trim(coalesce(p_establishment->>'phone','')), ''),
    nullif(trim(coalesce(p_establishment->>'email','')), ''),
    v_plan,
    true,
    case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end,
    v_professional_id,
    nullif(trim(coalesce(p_establishment->>'legal_name','')), ''),
    nullif(trim(coalesce(p_establishment->>'activity_type','')), ''),
    nullif(trim(coalesce(p_establishment->>'region','')), ''),
    nullif(trim(coalesce(p_establishment->>'notes','')), '')
  )
  returning id into v_etab_id;

  -- 2) Abonnement (dates réelles issues du contrat)
  insert into public.subscriptions (
    establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end
  ) values (
    v_etab_id,
    v_plan,
    case when v_trial_days > 0 then 'trial' else 'active' end,
    v_start_date::timestamptz,
    case when v_trial_days > 0 then (v_start_date + v_trial_days)::timestamptz else null end,
    (v_start_date + make_interval(months => v_paid_months))::timestamptz
  )
  returning id into v_sub_id;

  -- 3) Profil Manager (identité + mot de passe temporaire à rotation)
  insert into public.profiles (
    id, full_name, phone, establishment_id, role, is_active,
    login_id, must_change_password, temporary_password_issued_at,
    temporary_password_expires_at
  ) values (
    v_manager_id,
    trim(coalesce(p_manager->>'full_name', 'Manager')),
    nullif(trim(coalesce(p_manager->>'phone','')), ''),
    v_etab_id,
    'manager',
    true,
    v_login_id,
    true,
    now(),
    now() + interval '7 days'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        establishment_id = excluded.establishment_id,
        role = 'manager',
        is_active = true,
        login_id = excluded.login_id,
        must_change_password = true,
        temporary_password_issued_at = now(),
        temporary_password_expires_at = now() + interval '7 days',
        password_changed_at = null;

  -- 4) Modules réellement attribués + permissions réelles (source serveur)
  delete from public.permissions
   where establishment_id = v_etab_id and role = 'manager';

  insert into public.permissions (establishment_id, role, module, can_view, can_create, can_edit, can_delete)
  select v_etab_id,
         'manager',
         e->>'module',
         true,
         coalesce((e->>'can_create')::boolean, false),
         coalesce((e->>'can_edit')::boolean, false),
         coalesce((e->>'can_delete')::boolean, false)
    from jsonb_array_elements(p_permissions) e;

  -- 5) Invitation (jeton haché uniquement)
  insert into public.invitations (
    token_hash, email, manager_user_id, establishment_id, manager_full_name,
    manager_phone, plan_code, status, expires_at, created_by,
    email_status, whatsapp_status
  ) values (
    p_invitation_token_hash,
    v_email,
    v_manager_id,
    v_etab_id,
    trim(coalesce(p_manager->>'full_name', 'Manager')),
    nullif(trim(coalesce(p_manager->>'phone','')), ''),
    v_plan,
    'prepared',
    coalesce(p_invitation_expires_at, now() + interval '7 days'),
    auth.uid(),
    case when v_want_email then 'en_attente' else 'non_demande' end,
    case when v_want_whatsapp then 'en_attente' else 'non_demande' end
  )
  returning id into v_inv_id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (
    v_inv_id, 'system', 'prepared',
    jsonb_build_object(
      'professional_id', v_professional_id,
      'login_id', v_login_id,
      'plan', v_plan,
      'modules', v_modules,
      'channels', coalesce(p_delivery_channels, '{}'::text[])
    )
  );

  -- 6) Journal d'audit (aucun secret)
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    v_etab_id, auth.uid(), 'onboard_tenant_v2', 'establishment', v_etab_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'professional_id', v_professional_id,
      'login_id', v_login_id,
      'plan', v_plan,
      'paid_months', v_paid_months,
      'trial_days', v_trial_days,
      'modules', v_modules,
      'subscription_id', v_sub_id,
      'invitation_id', v_inv_id
    )
  );

  -- 7) Clôture idempotente
  insert into public.onboarding_requests (
    request_id, company_name, slug, plan, company_email,
    manager_user_id, establishment_id, invitation_id, status, completed_at
  ) values (
    p_request_id,
    trim(p_establishment->>'name'),
    v_slug,
    v_plan,
    nullif(trim(coalesce(p_establishment->>'email','')), ''),
    v_manager_id,
    v_etab_id,
    v_inv_id,
    'completed',
    now()
  )
  on conflict (request_id) do update
    set manager_user_id = excluded.manager_user_id,
        establishment_id = excluded.establishment_id,
        invitation_id = excluded.invitation_id,
        status = 'completed',
        completed_at = now();

  return jsonb_build_object(
    'idempotent', false,
    'status', 'completed',
    'establishment_id', v_etab_id,
    'subscription_id', v_sub_id,
    'manager_user_id', v_manager_id,
    'invitation_id', v_inv_id,
    'professional_id', v_professional_id,
    'login_id', v_login_id,
    'modules', v_modules,
    'request_id', p_request_id
  );
end;
$$;

revoke all on function public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]) from public;
grant execute on function public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Fin de la rotation du mot de passe (preuve serveur)
-- ---------------------------------------------------------------------
create or replace function public.admin_complete_password_change()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_updated timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profil introuvable.';
  end if;

  select u.updated_at into v_updated from auth.users u where u.id = auth.uid();

  -- Preuve : le mot de passe a été modifié APRÈS l'émission du mot de passe temporaire.
  if v_profile.temporary_password_issued_at is not null
     and (v_updated is null or v_updated <= v_profile.temporary_password_issued_at) then
    raise exception 'Aucun changement de mot de passe détecté.';
  end if;

  update public.profiles
     set must_change_password = false,
         password_changed_at = now(),
         temporary_password_expires_at = null
   where id = auth.uid();

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_profile.establishment_id, auth.uid(), 'password_changed', 'profile', auth.uid(), '{}'::jsonb);

  return jsonb_build_object('ok', true, 'must_change_password', false);
end;
$$;

revoke all on function public.admin_complete_password_change() from public;
grant execute on function public.admin_complete_password_change() to authenticated;

comment on function public.admin_complete_password_change() is
  'Lève le drapeau must_change_password uniquement si auth.users.updated_at prouve un changement postérieur à l''émission temporaire.';

-- FIN 0039

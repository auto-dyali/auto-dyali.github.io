-- =====================================================================
-- AUTO DYALI — 0036 : Invitations Manager et suivi d'activation
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Ne pas exécuter à distance sans :
--   1) sauvegarde / export,
--   2) vérification des dépendances (FK, RLS, données existantes),
--   3) autorisation explicite de l'utilisateur.
--
-- Objet : gérer les invitations sécurisées de managers depuis le Super Admin.
--   - Table invitations : jeton d'activation, statut, expiration, établissement.
--   - Table invitation_events : historique des envois (e-mail, WhatsApp) et statuts.
--   - RPC admin_invite_manager : création transactionnelle établissement + profil
--     manager + compte Auth + invitation, via Edge Function côté serveur.
--   - Aucun mot de passe n'est jamais transmis par e-mail ou WhatsApp.
--   - Le lien d'activation est à usage unique, limité dans le temps (7 jours).
--   - RLS : seul saas_admin peut créer/lire les invitations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles (échoue si dépendances critiques absentes)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0036: table establishments absente (migration 0001).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT 0036: table profiles absente (migration 0001).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plans') then
    raise exception 'ARRÊT 0036: table plans absente (migration 0008/0009).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='subscriptions') then
    raise exception 'ARRÊT 0036: table subscriptions absente (migration 0009).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plan_features') then
    raise exception 'ARRÊT 0036: table plan_features absente (migration 0009).';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0036: fonction is_saas_admin() absente.';
  end if;
  raise notice '0036 pré-contrôles OK (dépendances présentes).';
end $$;

-- ---------------------------------------------------------------------
-- 1. TABLE DES INVITATIONS MANAGER
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id                uuid primary key default uuid_generate_v4(),
  token             text not null unique,
  email             text not null,
  establishment_id  uuid references public.establishments(id) on delete cascade,
  manager_full_name text not null,
  manager_phone     text,
  plan_code         text references public.plans(code),
  status            text not null default 'preparée'
                    check (status in (
                      'preparée', 'envoyee', 'confirmee', 'echec',
                      'acceptee', 'expiree', 'annulee'
                    )),
  expires_at        timestamptz not null default (now() + interval '7 days'),
  accepted_at       timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
    created_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_email_idx on public.invitations (lower(email));
create index if not exists invitations_status_idx on public.invitations (status, created_at desc);
create index if not exists invitations_establishment_idx on public.invitations (establishment_id);

alter table public.invitations enable row level security;

drop policy if exists invitations_saas_admin_all on public.invitations;
create policy invitations_saas_admin_all on public.invitations
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists invitations_manager_select_own on public.invitations;
create policy invitations_manager_select_own on public.invitations
  for select using (
    public.is_manager()
    and establishment_id = public.current_establishment_id()
  );

grant select, insert on public.invitations to authenticated;

-- ---------------------------------------------------------------------
-- 2. HISTORIQUE DES ENVOIS ET STATUTS D'INVITATION
-- ---------------------------------------------------------------------
create table if not exists public.invitation_events (
  id             uuid primary key default uuid_generate_v4(),
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  channel        text not null check (channel in ('email', 'whatsapp', 'system')),
  event_type     text not null check (event_type in (
    'prepared', 'sent_requested', 'sent_confirmed', 'sent_failed',
    'accepted', 'expired', 'cancelled', 'resent'
  )),
  provider_ref   text,                          -- identifiant de suivi du fournisseur
  provider_error text,                          -- message d'erreur du fournisseur
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists invitation_events_invitation_idx on public.invitation_events (invitation_id, created_at desc);

alter table public.invitation_events enable row level security;

drop policy if exists invitation_events_saas_admin_all on public.invitation_events;
create policy invitation_events_saas_admin_all on public.invitation_events
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select, insert on public.invitation_events to authenticated;

-- ---------------------------------------------------------------------
-- 3. FONCTION HELPER : générer un jeton d'activation sécurisé
-- ---------------------------------------------------------------------
create or replace function public.gen_invitation_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  select encode(gen_random_bytes(24), 'hex') into v_token;
  return v_token;
end;
$$;

revoke all on function public.gen_invitation_token() from public;
grant execute on function public.gen_invitation_token() to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC : admin_invite_manager (création transactionnelle)
--   Cette RPC est appelée par l'Edge Function onboard-tenant côté serveur.
--   Elle crée : établissement, profil manager, employé, abonnement,
--   permissions initiales et invitation (jeton d'activation).
--   Le compte Auth est créé par l'Edge Function (service_role), jamais ici.
-- ---------------------------------------------------------------------
create or replace function public.admin_invite_manager(
  p_request_id        text,
  p_company_name      text,
  p_company_slug      text,
  p_manager_name      text,
  p_manager_email     text,
  p_manager_phone     text,
  p_address           text,
  p_city              text,
  p_plan_code         text,
  p_trial_days        integer,
  p_modules           jsonb default '[]'::jsonb,
  p_created_by        uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment_id uuid;
  v_profile_id       uuid;
  v_employee_id      uuid;
  v_invitation_id    uuid;
  v_token            text;
  v_exists           boolean;
begin
  -- 1. Vérifier le rôle saas_admin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  -- 2. Vérifier l'idempotence (request_id unique)
  select exists (
    select 1 from public.onboarding_requests where request_id = p_request_id
  ) into v_exists;
  if v_exists then
    return jsonb_build_object(
      'status', 'deja_existant',
      'message', 'Une demande avec cet identifiant existe déjà.'
    );
  end if;

  -- 3. Valider l'email
  if p_manager_email is null or length(trim(p_manager_email)) = 0 then
    raise exception 'L email du manager est obligatoire.';
  end if;
  if position('@' in lower(p_manager_email)) = 0 then
    raise exception 'Email du manager invalide.';
  end if;

  -- 4. Valider le plan
  if p_plan_code is null or p_plan_code not in ('standard','silver','gold') then
    raise exception 'Forfait invalide (standard, silver, gold).';
  end if;

  -- 5. Vérifier l'unicité du slug
  if exists (
    select 1 from public.establishments where slug = lower(trim(p_company_slug))
  ) then
    raise exception 'Un établissement avec ce slug existe déjà.';
  end if;

  -- 6. Créer l'établissement
  insert into public.establishments (name, slug, address, city, phone, email, plan, is_active)
  values (
    trim(p_company_name),
    lower(trim(p_company_slug)),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_manager_phone, '')), ''),
    lower(trim(p_manager_email)),
    p_plan_code,
    true
  )
  returning id into v_establishment_id;

  -- 7. Créer la demande d'onboarding (idempotence)
  insert into public.onboarding_requests (
    request_id, company_name, slug, plan, company_email,
    establishment_id, status, created_at
  ) values (
    p_request_id, trim(p_company_name), lower(trim(p_company_slug)),
    p_plan_code, lower(trim(p_manager_email)),
    v_establishment_id, 'started', now()
  );

  -- 8. Créer l'invitation (jeton d'activation)
  v_token := public.gen_invitation_token();
  insert into public.invitations (
    token, email, establishment_id, manager_full_name, manager_phone,
    plan_code, status, expires_at, created_by, created_at, updated_at
  ) values (
    v_token, lower(trim(p_manager_email)), v_establishment_id,
    trim(p_manager_name), nullif(trim(coalesce(p_manager_phone, '')), ''),
    p_plan_code, 'preparée', now() + make_interval(days => greatest(p_trial_days, 7)),
    p_created_by, now(), now()
  )
  returning id into v_invitation_id;

  -- 9. Enregistrer l'événement de préparation
  insert into public.invitation_events (
    invitation_id, channel, event_type, metadata, created_at
  ) values (
    v_invitation_id, 'system', 'prepared',
    jsonb_build_object('email', lower(trim(p_manager_email)), 'plan', p_plan_code),
    now()
  );

  -- 10. Retourner le résultat (jeton pour l'EF qui enverra l'invitation)
  return jsonb_build_object(
    'status', 'preparée',
    'invitation_id', v_invitation_id,
    'token', v_token,
    'email', lower(trim(p_manager_email)),
    'establishment_id', v_establishment_id,
    'plan', p_plan_code,
    'expires_at', (now() + make_interval(days => greatest(p_trial_days, 7)))
  );
end;
$$;

revoke all on function public.admin_invite_manager(text,text,text,text,text,text,text,text,text,integer,jsonb,uuid) from public;
grant execute on function public.admin_invite_manager(text,text,text,text,text,text,text,text,text,integer,jsonb,uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC : admin_accept_invitation (activation du compte par le manager)
--   Appelée lorsque le manager clique sur le lien d'activation.
--   Vérifie le jeton, la date d'expiration et le statut.
-- ---------------------------------------------------------------------
create or replace function public.admin_accept_invitation(
  p_token text,
  p_password_hash text  -- jamais stocké en clair ; côté Auth uniquement
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation_id uuid;
  v_establishment_id uuid;
  v_email text;
  v_status text;
  v_expires_at timestamptz;
begin
  -- 1. Rechercher l'invitation par jeton
  select id, establishment_id, email, status, expires_at
    into v_invitation_id, v_establishment_id, v_email, v_status, v_expires_at
    from public.invitations
   where token = p_token;

  if not found then
    raise exception 'Jeton d activation invalide ou inconnu.';
  end if;

  -- 2. Vérifier le statut
  if v_status <> 'preparée' and v_status <> 'envoyee' then
    raise exception 'Invitation deja traitee ou invalide (statut : %).', v_status;
  end if;

  -- 3. Vérifier l'expiration
  if v_expires_at < now() then
    update public.invitations
       set status = 'expiree', updated_at = now()
     where id = v_invitation_id;
    insert into public.invitation_events (
      invitation_id, channel, event_type, metadata, created_at
    ) values (
      v_invitation_id, 'system', 'expired',
      jsonb_build_object('email', v_email), now()
    );
    raise exception 'Invitation expiree. Veuillez demander un nouveau lien d activation.';
  end if;

  -- 4. Marquer comme acceptée
  update public.invitations
     set status = 'acceptee', accepted_at = now(), updated_at = now()
   where id = v_invitation_id;

  insert into public.invitation_events (
    invitation_id, channel, event_type, metadata, created_at
  ) values (
    v_invitation_id, 'system', 'accepted',
    jsonb_build_object('email', v_email), now()
  );

  return jsonb_build_object(
    'status', 'acceptee',
    'invitation_id', v_invitation_id,
    'establishment_id', v_establishment_id,
    'email', v_email
  );
end;
$$;

revoke all on function public.admin_accept_invitation(text,text) from public;
grant execute on function public.admin_accept_invitation(text,text) to authenticated, anon;

-- ---------------------------------------------------------------------
-- 6. PRIVILEGES
-- ---------------------------------------------------------------------
grant select on public.invitations to authenticated;
grant select, insert on public.invitation_events to authenticated;

-- FIN 0036 (préparée). Vérifier après application : définitions, RLS, appels.
SQL\n")
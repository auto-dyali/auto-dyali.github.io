-- GV5 §107 — RÉPÉTITION GÉNÉRALE EN TRANSACTION ANNULÉE (Dashboard SQL Editor).
-- Exécuter TOUT ce fichier en UNE SEULE requête, un seul clic sur Exécuter.
-- IDENTIQUE au script d'application, à la dernière instruction près :
-- il se termine par ROLLBACK et n'écrit donc rien.
set idle_in_transaction_session_timeout = '120s';
begin;
set local idle_in_transaction_session_timeout = '120s';
set local lock_timeout = '2s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
-- 0. Contrôles avant migrations (aucune donnée réelle n'est affichée).
do $$
declare n integer;
begin
  select count(*)::int into n from public.profiles where role = 'saas_admin';
  if n <> 1 then
    raise exception 'SA_UNIQUE_KO: %', n;
  end if;
end $$;

create temp table gv5_etabs(etab uuid, uid uuid) on commit drop;
create temp table gv5_features_avant(etab uuid, feature_key text, enabled boolean) on commit drop;

do $$
declare r record;
begin
  for r in
    select e.id as etab,
           (select p.id from public.profiles p where p.establishment_id = e.id order by p.id limit 1) as uid
      from public.establishments e
     where exists (select 1 from public.profiles p where p.establishment_id = e.id)
  loop
    insert into gv5_etabs values (r.etab, r.uid);
    perform set_config('request.jwt.claim.sub', r.uid::text, true);
    insert into gv5_features_avant(etab, feature_key, enabled)
      select r.etab, x.feature_key, x.enabled from public.my_features() x;
  end loop;
end $$;

-- === 20261125100000_prod_minimal_invitations.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 0036_invitations_manager_prepared_NOT_APPLIED.sql : invitations + invitation_events + RPC d'invitation.
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

-- =====================================================================
-- AUTO DYALI — 0036 (RÉVISÉE GV5 §51) : Invitations Manager sécurisées
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Corrections apportées par rapport à la version précédente :
--   * suppression de la ligne parasite `SQL\n")` (migration invalide) ;
--   * le jeton n'est PLUS stocké en clair : seule son empreinte SHA-256
--     (`token_hash`) est conservée ;
--   * statuts d'envoi INDÉPENDANTS par canal (e-mail / WhatsApp) ;
--   * historique `invitation_events` en écriture RPC uniquement ;
--   * `admin_accept_invitation` ne reçoit plus d'empreinte de mot de passe trompeuse :
--     le mot de passe est défini par Supabase Auth (service_role, Edge Function) ;
--   * prévisualisation d'une invitation SANS la consommer ;
--   * usage unique réel (statut + `accepted_at`) ;
--   * aucune écriture directe accordée aux clients (`insert` retiré).
--
-- PRÉREQUIS : 0028 (`onboarding_requests`, `is_saas_admin`), 0001 (tables),
--             extensions `pgcrypto` + `uuid-ossp` (présentes en distant).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0036: table establishments absente (migration 0001).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='onboarding_requests') then
    raise exception 'ARRÊT 0036: table onboarding_requests absente (migration 0028).';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0036: fonction is_saas_admin() absente.';
  end if;
  if not exists (select 1 from pg_extension where extname='pgcrypto') then
    raise exception 'ARRÊT 0036: extension pgcrypto requise (digest).';
  end if;
  raise notice '0036 pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. Helpers jeton
-- ---------------------------------------------------------------------
create or replace function public.gen_invitation_token()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

create or replace function public.hash_invitation_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.gen_invitation_token() from public;
revoke all on function public.hash_invitation_token(text) from public;

-- ---------------------------------------------------------------------
-- 2. TABLE invitations
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id                    uuid primary key default gen_random_uuid(),
  token_hash            text not null unique,
  email                 text not null,
  manager_user_id       uuid references auth.users(id) on delete set null,
  establishment_id      uuid references public.establishments(id) on delete cascade,
  manager_full_name     text not null,
  manager_phone         text,
  plan_code             text references public.plans(code),
  status                text not null default 'prepared'
                        check (status in ('prepared','sent','accepted','expired','cancelled','failed')),
  email_status          text not null default 'non_demande'
                        check (email_status in ('non_demande','en_attente','accepte_par_fournisseur','echec','non_configure')),
  whatsapp_status       text not null default 'non_demande'
                        check (whatsapp_status in ('non_demande','en_attente','accepte_par_fournisseur','echec','non_configure')),
  email_provider_ref    text,
  whatsapp_provider_ref text,
  last_error            text,
  last_request_id       text,
  expires_at            timestamptz not null default (now() + interval '7 days'),
  accepted_at           timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations (lower(email));
create index if not exists invitations_status_idx on public.invitations (status, created_at desc);
create index if not exists invitations_establishment_idx on public.invitations (establishment_id);
create index if not exists invitations_manager_user_idx on public.invitations (manager_user_id);

alter table public.invitations enable row level security;

drop policy if exists invitations_saas_admin_all on public.invitations;
create policy invitations_saas_admin_all on public.invitations
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists invitations_manager_select_own on public.invitations;
create policy invitations_manager_select_own on public.invitations
  for select using (
    manager_user_id = auth.uid()
    or (public.is_manager() and establishment_id = public.current_establishment_id())
  );

grant select on public.invitations to authenticated;

-- ---------------------------------------------------------------------
-- 3. TABLE invitation_events (historique par canal)
-- ---------------------------------------------------------------------
create table if not exists public.invitation_events (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  channel        text not null check (channel in ('email','whatsapp','system')),
  event_type     text not null check (event_type in (
    'prepared','send_requested','accepted_by_provider','sent_failed',
    'resent','accepted','expired','cancelled'
  )),
  provider_ref   text,
  provider_error text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists invitation_events_invitation_idx
  on public.invitation_events (invitation_id, created_at desc);

alter table public.invitation_events enable row level security;

drop policy if exists invitation_events_saas_admin_all on public.invitation_events;
create policy invitation_events_saas_admin_all on public.invitation_events
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists invitation_events_manager_select_own on public.invitation_events;
create policy invitation_events_manager_select_own on public.invitation_events
  for select using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_events.invitation_id
        and (i.manager_user_id = auth.uid()
             or (public.is_manager() and i.establishment_id = public.current_establishment_id()))
    )
  );

grant select on public.invitation_events to authenticated;

-- ---------------------------------------------------------------------
-- 4. Expiration paresseuse + prévisualisation (sans consommation)
-- ---------------------------------------------------------------------
create or replace function public.admin_expire_stale_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  update public.invitations
     set status = 'expired', updated_at = now()
   where status in ('prepared','sent')
     and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.invitations%rowtype;
  v_etab_name text;
  v_login_id text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'Jeton d''activation invalide.';
  end if;

  select * into v
    from public.invitations
   where token_hash = public.hash_invitation_token(trim(p_token));

  if not found then
    raise exception 'Jeton d''activation invalide ou inconnu.';
  end if;

  if v.status = 'accepted' then
    raise exception 'Invitation déjà utilisée.';
  end if;
  if v.status in ('expired','cancelled','failed') then
    raise exception 'Invitation expirée ou annulée.';
  end if;
  if v.expires_at < now() then
    update public.invitations set status = 'expired', updated_at = now() where id = v.id;
    raise exception 'Invitation expirée.';
  end if;

  select e.name into v_etab_name from public.establishments e where e.id = v.establishment_id;
  select p.login_id into v_login_id from public.profiles p where p.id = v.manager_user_id;

  -- Aucune consommation : on ne fait que décrire l'invitation.
  return jsonb_build_object(
    'invitation_id', v.id,
    'email', v.email,
    'login_id', v_login_id,
    'manager_full_name', v.manager_full_name,
    'establishment_id', v.establishment_id,
    'establishment_name', v_etab_name,
    'plan_code', v.plan_code,
    'status', v.status,
    'expires_at', v.expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Acceptation (usage unique) — appelée par l'Edge Function APRÈS
--    la définition du mot de passe par Supabase Auth (service_role).
-- ---------------------------------------------------------------------
create or replace function public.admin_accept_invitation(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v public.invitations%rowtype;
  v_profile public.profiles%rowtype;
  v_updated timestamptz;
begin
  if p_user_id is null then
    raise exception 'Compte Manager requis.';
  end if;
  -- Appel légitime : service_role (Edge Function après définition du mot de
  -- passe) ou le Manager lui-même (p_user_id = auth.uid()).
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Accès refusé : cette invitation ne correspond pas à votre compte.';
  end if;
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'Jeton d''activation invalide.';
  end if;

  select * into v
    from public.invitations
   where token_hash = public.hash_invitation_token(trim(p_token))
   for update;

  if not found then
    raise exception 'Jeton d''activation invalide ou inconnu.';
  end if;
  if v.status = 'accepted' then
    raise exception 'Invitation déjà utilisée.';
  end if;
  if v.status in ('expired','cancelled','failed') or v.expires_at < now() then
    update public.invitations set status = 'expired', updated_at = now() where id = v.id and status <> 'accepted';
    raise exception 'Invitation expirée ou annulée.';
  end if;
  if v.manager_user_id is not null and v.manager_user_id <> p_user_id then
    raise exception 'Cette invitation ne correspond pas à ce compte.';
  end if;

  update public.invitations
     set status = 'accepted', accepted_at = now(), manager_user_id = p_user_id, updated_at = now()
   where id = v.id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (v.id, 'system', 'accepted', jsonb_build_object('user_id', p_user_id))
  on conflict do nothing;

  -- Preuve de rotation : le mot de passe Auth a été mis à jour APRÈS
  -- l'émission du mot de passe temporaire. Sans cette preuve, on refuse de
  -- lever le blocage (aucun contournement possible côté client).
  select * into v_profile from public.profiles where id = p_user_id;
  if found then
    select u.updated_at into v_updated from auth.users u where u.id = p_user_id;
    if v_profile.temporary_password_issued_at is not null
       and (v_updated is null or v_updated <= v_profile.temporary_password_issued_at) then
      raise exception 'Aucun changement de mot de passe détecté : activation refusée.';
    end if;

    update public.profiles
       set must_change_password = false,
           password_changed_at = now(),
           temporary_password_expires_at = null
     where id = p_user_id;
  end if;

  return jsonb_build_object(
    'invitation_id', v.id,
    'establishment_id', v.establishment_id,
    'email', v.email,
    'status', 'accepted'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Enregistrement des résultats fournisseurs (e-mail / WhatsApp)
--    Appelée par l'Edge Function avec service_role, jamais par le client.
-- ---------------------------------------------------------------------
create or replace function public.admin_record_delivery(
  p_invitation_id uuid,
  p_channel         text,
  p_status          text,
  p_provider_ref    text default null,
  p_provider_error  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_email_status text;
  v_whatsapp_status text;
  v_event text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_channel not in ('email','whatsapp') then
    raise exception 'Canal invalide (email|whatsapp).';
  end if;
  if p_status not in ('non_demande','en_attente','accepte_par_fournisseur','echec','non_configure') then
    raise exception 'Statut de livraison invalide.';
  end if;

  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'Invitation introuvable.';
  end if;

  v_email_status := case when p_channel = 'email' then p_status else v_inv.email_status end;
  v_whatsapp_status := case when p_channel = 'whatsapp' then p_status else v_inv.whatsapp_status end;

  v_event := case p_status
    when 'accepte_par_fournisseur' then 'accepted_by_provider'
    when 'echec' then 'sent_failed'
    when 'en_attente' then 'send_requested'
    else 'send_requested'
  end;

  update public.invitations
     set email_status = v_email_status,
         whatsapp_status = v_whatsapp_status,
         email_provider_ref = case when p_channel='email' then p_provider_ref else email_provider_ref end,
         whatsapp_provider_ref = case when p_channel='whatsapp' then p_provider_ref else whatsapp_provider_ref end,
         last_error = case when p_status = 'echec' then p_provider_error else last_error end,
         status = case
           when status in ('prepared','sent')
            and (
              v_email_status in ('accepte_par_fournisseur','echec','non_configure')
              or v_whatsapp_status in ('accepte_par_fournisseur','echec','non_configure')
            )
             then 'sent'
           else status
         end,
         updated_at = now()
   where id = p_invitation_id;

  insert into public.invitation_events (invitation_id, channel, event_type, provider_ref, provider_error)
  values (p_invitation_id, p_channel, v_event, p_provider_ref, p_provider_error);

  return jsonb_build_object(
    'invitation_id', p_invitation_id,
    'email_status', v_email_status,
    'whatsapp_status', v_whatsapp_status
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6 bis. Relance idempotente (nouveau jeton, même requestId = même état)
-- ---------------------------------------------------------------------
create or replace function public.admin_prepare_resend(
  p_invitation_id uuid,
  p_request_id    text,
  p_token_hash    text,
  p_expires_at    timestamptz,
  p_channels      text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.invitations%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_invitation_id is null or p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception 'Paramètres de relance incomplets.';
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Empreinte de jeton invalide.';
  end if;

  select * into v from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'Invitation introuvable.';
  end if;
  if v.status = 'accepted' then
    raise exception 'Invitation déjà acceptée : relance impossible.';
  end if;
  if v.status = 'cancelled' then
    raise exception 'Invitation annulée : relance impossible.';
  end if;

  -- Idempotence : la même demande ne réémet pas de jeton.
  if v.last_request_id = p_request_id then
    return jsonb_build_object(
      'already', true,
      'invitation_id', v.id,
      'email_status', v.email_status,
      'whatsapp_status', v.whatsapp_status
    );
  end if;

  update public.invitations
     set token_hash = p_token_hash,
         expires_at = coalesce(p_expires_at, now() + interval '7 days'),
         -- Le statut global n'est pas « sent » avant la réponse fournisseur :
         -- seuls les canaux repassent en attente. Un statut expiré/échoué est
         -- réarmé, jamais présenté comme envoyé.
         status = case when status in ('expired','failed') then 'prepared' else status end,
         accepted_at = null,
         last_request_id = p_request_id,
         email_status = case when 'email' = any(coalesce(p_channels, '{}'::text[]))
                             then 'en_attente' else email_status end,
         whatsapp_status = case when 'whatsapp' = any(coalesce(p_channels, '{}'::text[]))
                                then 'en_attente' else whatsapp_status end,
         updated_at = now()
   where id = p_invitation_id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  select p_invitation_id, canal, 'resent', jsonb_build_object('request_id', p_request_id)
    from unnest(coalesce(p_channels, '{}'::text[])) as canal
   where canal in ('email','whatsapp');

  return jsonb_build_object(
    'already', false,
    'invitation_id', p_invitation_id,
    'expires_at', coalesce(p_expires_at, now() + interval '7 days')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Privilèges (aucun EXECUTE PUBLIC)
-- ---------------------------------------------------------------------
revoke all on function public.admin_expire_stale_invitations() from public;
revoke all on function public.admin_invitation_preview(text) from public;
revoke all on function public.admin_accept_invitation(text, uuid) from public;
revoke all on function public.admin_record_delivery(uuid, text, text, text, text) from public;
revoke all on function public.admin_prepare_resend(uuid, text, text, timestamptz, text[]) from public;

grant execute on function public.admin_invitation_preview(text) to anon, authenticated;
grant execute on function public.admin_expire_stale_invitations() to authenticated;
grant execute on function public.admin_accept_invitation(text, uuid) to authenticated, service_role;
grant execute on function public.admin_record_delivery(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_prepare_resend(uuid, text, text, timestamptz, text[]) to authenticated;

comment on table public.invitations is
  'Invitations Manager. Le jeton brut n''est jamais stocké : seul token_hash (SHA-256) est conservé.';
comment on function public.admin_accept_invitation(text, uuid) is
  'Consomme une invitation valide (usage unique). Le mot de passe est défini par Supabase Auth côté serveur.';

-- FIN 0036 (révisée GV5 §51)
-- === 20261125101000_prod_minimal_identity_v2.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql : colonnes identité + RPC on boarding v2 de base.
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

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
-- === 20261125102000_prod_minimal_identity_health.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 001_identity_health.sql : RPC de diagnostic admin_identity_v2_health().
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

-- AUTO DYALI — GV5 §83 — Diagnostic d'environnement « identité v2 » (STAGING)
-- Réversible : 001_down.sql. Aucune donnée modifiée.
--
-- Objective : permettre au Super Admin de vérifier, avant une création, que
-- l'environnement cible possède bien les objets issus de la migration 0039.
-- L'incident signalé provenait d'un environnement (production) où ces objets
-- sont absents : la RPC admin_check_identity_available renvoyait PGRST202 et
-- le frontend affichait « migration 0039 non appliquée ».

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
    'establishments_professional_id', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='establishments' and column_name='professional_id'
    ),
    'profiles_login_id', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='login_id'
    ),
    'profiles_must_change_password', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='must_change_password'
    ),
    'fn_admin_check_identity_available', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='admin_check_identity_available'
    ),
    'fn_admin_onboard_tenant_v2', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='admin_onboard_tenant_v2'
    ),
    'fn_get_my_profile', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_my_profile'
    ),
    'fn_get_my_security_state', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_my_security_state'
    ),
    'fn_resolve_login_email', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='resolve_login_email'
    ),
    'fn_must_change_password', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='must_change_password'
    )
  );
end; $$;

revoke all on function public.admin_identity_v2_health() from public;
revoke all on function public.admin_identity_v2_health() from anon;
grant execute on function public.admin_identity_v2_health() to authenticated;
-- === 20261125102500_prod_minimal_admin_columns.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration CORRECTIVE.
-- Défaut reproduit sur la base « forme production » en CI : le pré-contrôle
-- de 20261125103000 exige les 6 colonnes administratives AVANT de les créer.
-- Sur staging ces colonnes existaient déjà ; en production elles sont absentes.
-- On les crée ici, avant 103000, de façon idempotente. 103000 leur ajout
-- `ADD COLUMN IF NOT EXISTS` devient alors un no-op. Aucune migration déjà
-- appliquée n'est modifiée.

alter table public.establishments
  add column if not exists country text,
  add column if not exists legal_info text,
  add column if not exists fiscal_info text,
  add column if not exists admin_info text,
  add column if not exists dossier_state text,
  add column if not exists complementary_contacts text;
-- === 20261125103000_prod_minimal_admin_fields.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 20261124_reconcile_manager_onboarding.sql : 6 champs administratifs + versions durcies.
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

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
-- === 20261125104000_prod_minimal_onboard_trigger_fix.sql ===
-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 20261124133000_fix_onboard_trigger_profile.sql : correctif du profil créé par le trigger Auth.
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

-- AUTO DYALI — GV5 §105 — Migration CORRECTIVE.
-- Défaut reproduit en CI sur Supabase local vierge : le trigger
-- handle_new_auth_user crée un profil 'client' rattaché au garage de démo
-- pour chaque nouvel utilisateur Auth. Le garde de admin_onboard_tenant_v2
-- refusait ensuite de promouvoir ce profil en Manager ("déjà rattaché").
-- On autorise uniquement le profil provisoire role='client' ; tout profil
-- réellement rattaché avec un autre rôle reste refusé.
-- CREATE OR REPLACE : aucune migration déjà appliquée n'est réécrite.

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
  if exists (select 1 from public.profiles p where p.id = v_manager_id and p.establishment_id is not null and p.role <> 'client') then raise exception 'Ce compte Manager est déjà rattaché à une entreprise.'; end if;
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
-- === 20261125106000_prod_minimal_activation_link.sql ===
-- AUTO DYALI — GV5 §107-PROD-FINAL — Migration CORRECTIVE.
-- Défaut reproduit par audit du code : la fiche Manager n'offre aucun moyen
-- de récupérer le lien d'activation quand aucun fournisseur e-mail n'est
-- configuré. Cette RPC émet un NOUVEAU jeton (ancien invalidé), ne stocke
-- que son empreinte SHA-256 et renvoie le lien au Super Admin authentifié.
-- Reversible : CREATE OR REPLACE. Aucune donnée existante modifiée hormis
-- l'invitation ciblée et son événement d'émission.

create or replace function public.admin_issue_activation_link(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.invitations%rowtype;
  v_token text;
  v_request_id text;
  v_expires timestamptz;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if p_invitation_id is null then
    raise exception 'Invitation requise.';
  end if;

  select * into v from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'Invitation introuvable.';
  end if;
  if v.status in ('accepted','cancelled','expired') then
    raise exception 'Invitation non activable.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_request_id := gen_random_uuid()::text;
  v_expires := now() + interval '7 days';

  update public.invitations
     set token_hash = public.hash_invitation_token(v_token),
         expires_at = v_expires,
         last_request_id = v_request_id,
         status = 'prepared',
         updated_at = now()
   where id = v.id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (v.id, 'system', 'resent',
          jsonb_build_object('request_id', v_request_id, 'source', 'admin_issue_activation_link'));

  return jsonb_build_object(
    'url', '/activer/#token=' || v_token,
    'expires_at', v_expires,
    'invitation_id', v.id
  );
end $$;

revoke all on function public.admin_issue_activation_link(uuid) from public;
revoke all on function public.admin_issue_activation_link(uuid) from anon;
grant execute on function public.admin_issue_activation_link(uuid) to authenticated;
-- === 20261125108000_prod_minimal_pgcrypto_helpers.sql ===
-- AUTO DYALI — GV5 §107 — migration CORRECTIVE n°8.
-- Cause : pgcrypto est installé dans le schéma `extensions` sur Supabase Free.
-- Les helpers créés par 20261125100000 n'ont pas de `search_path` propre :
-- `gen_random_bytes()` / `digest()` sont résolus à l'exécution avec le
-- search_path de l'appelant (`"$user", public`) et échouent en PGRST.
-- Correctif : définitions explicites, schéma qualifié, aucun SECURITY DEFINER,
-- aucun droit supplémentaire. Additive, idempotente, réversible.

create or replace function public.gen_invitation_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

revoke all on function public.gen_invitation_token() from public;

create or replace function public.hash_invitation_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hash_invitation_token(text) from public;
revoke all on function public.hash_invitation_token(text) from anon;
grant execute on function public.hash_invitation_token(text) to authenticated, service_role;
-- === 20261125109000_prod_minimal_permissions_tenant_write.sql ===
-- AUTO DYALI — GV5 §107 — migration CORRECTIVE n°9.
-- Le front de main (81ca143) écrit directement dans public.permissions
-- (src/components/permissions-module.tsx : UPDATE/INSERT) avec un rôle non
-- Super Admin, en s'appuyant sur la policy historique `tenant_isolation`
-- (FOR ALL) de production. La corrective 101000 supprime cette policy et ne
-- laisse qu'une lecture tenant + une écriture Super Admin : l'ancien parcours
-- serait cassé. On restaure une écriture tenant équivalente, sans modifier
-- 101000 (déjà appliquée sur staging). Additive, idempotente, réversible.

drop policy if exists permissions_tenant_write on public.permissions;

create policy permissions_tenant_write on public.permissions
  for all to authenticated
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

-- Contrôle my_features : aucune fonctionnalité active ne doit disparaître.
do $$
declare r record; a record; v_new boolean;
begin
  for r in select * from gv5_etabs loop
    perform set_config('request.jwt.claim.sub', r.uid::text, true);
    for a in select feature_key from gv5_features_avant where etab = r.etab and enabled loop
      select enabled into v_new from public.my_features() where feature_key = a.feature_key;
      if v_new is not true then
        raise exception 'FEATURE_PERDUE: %', a.feature_key;
      end if;
    end loop;
  end loop;
end $$;

-- Contrôle de la policy d'écriture tenant (test annulé par savepoint).
-- Le test s'exécute avec le rôle `authenticated` : `postgres` est
-- superutilisateur et contourne RLS, ce qui rendrait le contrôle faux.
-- Production ne contient qu'un profil (Super Admin) : on crée un profil
-- tenant TEMPORAIRE dans la transaction, annulé par le savepoint.
savepoint gv5_policy_test;
do $$
declare v_etab uuid; v_other uuid; v_uid uuid; v_def text;
begin
  if to_regprocedure('public.current_establishment_id()') is null then
    raise exception 'CURRENT_ETAB_ABSENT';
  end if;
  select pg_get_functiondef('public.current_establishment_id()'::regprocedure) into v_def;
  if v_def not like '%auth.uid()%' or v_def not like '%profiles%' then
    raise exception 'CURRENT_ETAB_INCOMPATIBLE';
  end if;
  select id into v_etab from public.establishments order by id limit 1;
  if v_etab is null then raise exception 'ETABS_ABSENTS'; end if;
  select id into v_other from public.establishments where id <> v_etab order by id limit 1;
  if v_other is null then raise exception 'ETABS_INSUFFISANTS'; end if;
  v_uid := extensions.uuid_generate_v4();
  insert into public.profiles(id, full_name, establishment_id, role, is_active)
    values (v_uid, 'GV5 policy probe', v_etab, 'employee', true);
  perform set_config('gv5.policy_own_etab', v_etab::text, true);
  perform set_config('gv5.policy_own_uid', v_uid::text, true);
  perform set_config('gv5.policy_cross_etab', v_other::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('gv5.policy_own_uid'), true);
do $$
begin
  begin
    insert into public.permissions(establishment_id, role, module, can_view)
      values (current_setting('gv5.policy_own_etab')::uuid, 'employee', 'gv5_policy_test', true);
  exception when others then
    raise exception 'POLICY_OWN_WRITE_KO';
  end;
  begin
    insert into public.permissions(establishment_id, role, module, can_view)
      values (current_setting('gv5.policy_cross_etab')::uuid, 'employee', 'gv5_policy_test', true);
    raise exception 'POLICY_CROSS_WRITE_OK';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;
rollback to gv5_policy_test;

-- Session Super Admin résolue uniquement depuis la base, sans UUID saisi.
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role = 'saas_admin'), true);
-- La santé est lue DANS la transaction, avant ROLLBACK. Le NOTICE reste
-- publié, mais le contrôle repose sur une EXCEPTION : l'essai ne réussit
-- que si le SELECT final 'ROLLBACK_VOLONTAIRE' est atteint.
DO $$
DECLARE
  v jsonb := public.admin_identity_v2_health();
  n integer;
  non_booleens integer;
  en_echec integer;
BEGIN
  RAISE NOTICE 'SANTE_GV5=%', v::text;
  select count(*)::int,
         count(*) filter (where jsonb_typeof(value) <> 'boolean')::int
    into n, non_booleens
    from jsonb_each(v);
  if n is distinct from 9 or non_booleens > 0 then
    raise exception 'SANTE_INCOMPLETE: %', v::text;
  end if;
  select count(*)::int into en_echec
    from jsonb_each(v)
   where jsonb_typeof(value) = 'boolean'
     and (value #>> '{}')::boolean is not true;
  if en_echec > 0 then
    raise exception 'SANTE_KO: %', v::text;
  end if;
  RAISE NOTICE 'SANTE_OK=true';
END $$;
rollback;
select 'ROLLBACK_VOLONTAIRE' as resultat;

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

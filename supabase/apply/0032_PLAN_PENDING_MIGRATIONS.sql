-- =====================================================================
-- AUTO DYALI — PLAN SQL SÉCURISÉ ET ORDONNÉ — MIGRATIONS MANQUANTES (Phase 3)
-- Généré le : 2026-11-13
-- Concerne les migrations identifiées PENDING lors de l'audit Phase 1/2 :
--   0010, 0015, 0018, 0026, 0029 (+ 0030, 0031 déjà créées localement).
-- STATUT : PLAN UNIQUEMENT — AUCUNE ÉCRITURE RÉALISÉE SUR SUPABASE.
-- PRÉREQUIS : sauvegarde / PITR vérifiée. Ordre respecté.
-- =====================================================================


-- =====================================================================
-- MIGRATION 0010 — RPC & policies Super Admin (PENDING)
-- Fichier source : supabase/migrations/0010_super_admin_rpc.sql
-- =====================================================================
-- AUTO DYALI — 0010 : RPC et policies Super Admin (pilotage de la plateforme)
-- Toute action sensible est journalisée dans audit_log.
-- Contrôle : chaque RPC vérifie is_saas_admin() (security definer).

-- ---------------------------------------------------------------------
-- 1. POLICIES : création d'établissement + journal d'audit
-- ---------------------------------------------------------------------
drop policy if exists saas_admin_insert_establishments on public.establishments;
create policy saas_admin_insert_establishments
  on public.establishments for insert
  with check (public.is_saas_admin());

drop policy if exists saas_admin_all_audit_log on public.audit_log;
create policy saas_admin_all_audit_log
  on public.audit_log for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

drop policy if exists managers_insert_audit_log on public.audit_log;
create policy managers_insert_audit_log
  on public.audit_log for insert
  with check (public.is_saas_admin() or public.is_manager());

drop policy if exists tenant_select_audit_log on public.audit_log;
create policy tenant_select_audit_log
  on public.audit_log for select
  using (
    establishment_id = public.current_establishment_id()
    or public.is_saas_admin()
  );

grant select, insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 2. Création d'un nouvel établissement (+ abonnement standard)
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
$$;

-- ---------------------------------------------------------------------
-- 3. Changement de forfait (upgrade / downgrade) — journalisé
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
$$;

-- ---------------------------------------------------------------------
-- 4. Activer / suspendre un établissement — journalisé
-- NB : la suspension ne supprime JAMAIS les données.
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
$$;

-- ---------------------------------------------------------------------
-- 5. Configuration commerciale des forfaits (prix, essai, limites)
--    Les prix restent NULL tant que le Super Admin ne les fixe pas.
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
$$;

-- ---------------------------------------------------------------------
-- 6. Activation / désactivation d'une fonctionnalité dans un forfait
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
$$;

grant execute on function public.admin_create_establishment(text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_change_plan(uuid,text) to authenticated;
grant execute on function public.admin_set_establishment_status(uuid,boolean) to authenticated;
grant execute on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function public.admin_set_feature(text,text,boolean) to authenticated;

-- =====================================================================
-- MIGRATION 0015 — Support & tickets (PENDING)
-- Fichier source : supabase/migrations/0015_support_tickets.sql
-- =====================================================================
-- AUTO DYALI — 0015 : Support & tickets
-- Tickets de support plateforme + échanges de messages.
-- Un établissement ne voit QUE ses tickets (RLS tenant) ; le Super Admin les voit tous.

create table if not exists public.support_tickets (
  id               uuid primary key default uuid_generate_v4(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  requester_id     uuid references auth.users(id) on delete set null,
  subject          text not null,
  body             text not null,
  category         text not null default 'other'
                   check (category in ('bug','question','billing','feature','other')),
  status           text not null default 'open'
                   check (status in ('open','in_progress','waiting_reply','resolved','closed')),
  priority         text not null default 'normal'
                   check (priority in ('low','normal','high','urgent')),
  plan_code        text,                                -- forfait au moment de la demande
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);

create table if not exists public.ticket_messages (
  id         uuid primary key default uuid_generate_v4(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  is_staff   boolean not null default false,            -- réponse support vs client
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- L'établissement voit ses tickets ; le Super Admin voit tout.
drop policy if exists support_tickets_tenant on public.support_tickets;
create policy support_tickets_tenant on public.support_tickets
  for all using (
    establishment_id = public.current_establishment_id() or public.is_saas_admin()
  )
  with check (
    establishment_id = public.current_establishment_id() or public.is_saas_admin()
  );

drop policy if exists ticket_messages_tenant on public.ticket_messages;
create policy ticket_messages_tenant on public.ticket_messages
  for all using (
    public.is_saas_admin()
    or exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id
         and t.establishment_id = public.current_establishment_id()
    )
  )
  with check (
    public.is_saas_admin()
    or exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id
         and t.establishment_id = public.current_establishment_id()
    )
  );

grant select, insert, update on public.support_tickets, public.ticket_messages to authenticated;

-- Vue : nombre de tickets ouverts par établissement (KPI plateforme)
create or replace function public.open_ticket_count(p_establishment_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.support_tickets
   where establishment_id = p_establishment_id
     and status in ('open','in_progress','waiting_reply');
$$;

grant execute on function public.open_ticket_count(uuid) to authenticated;

-- =====================================================================
-- MIGRATION 0018 — CRM Super Admin (PENDING)
-- Fichier source : supabase/migrations/0018_crm_super_admin.sql
-- =====================================================================
-- AUTO DYALI — 0018 : CRM Super Admin (pipeline commercial plateforme)
-- Prospects, démonstrations, essais, relances, conversions.
-- Table PLATEFORME (pas multi-tenant) : réservée au Super Admin.

create table if not exists public.crm_leads (
  id               uuid primary key default uuid_generate_v4(),
  company          text not null,
  contact_name     text,
  email            text,
  phone            text,
  city             text,
  activity         text,                          -- garage, magasin, centre pneus…
  stage            text not null default 'prospect'
                   check (stage in ('prospect','demo','trial','negotiation','won','lost')),
  plan_interest    text check (plan_interest in ('standard','silver','gold')),
  owner_id         uuid references auth.users(id) on delete set null,
  notes            text,
  next_action_at   date,                          -- prochaine relance
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  converted_establishment_id uuid references public.establishments(id) on delete set null
);

create table if not exists public.crm_events (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  event_type  text not null default 'note'
              check (event_type in ('note','call','email','demo','trial_start','stage_change')),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists crm_leads_stage_idx on public.crm_leads (stage, updated_at desc);
create index if not exists crm_events_lead_idx on public.crm_events (lead_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_events enable row level security;

-- Exclusivement Super Admin (aucun tenant ne doit voir le CRM plateforme)
drop policy if exists crm_leads_saas_admin on public.crm_leads;
create policy crm_leads_saas_admin on public.crm_leads for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists crm_events_saas_admin on public.crm_events;
create policy crm_events_saas_admin on public.crm_events for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select, insert, update, delete on public.crm_leads, public.crm_events to authenticated;

-- =====================================================================
-- MIGRATION 0026 — Abonnements audit & lifecycle (PENDING)
-- Fichier source : supabase/migrations/0026_subscriptions_audit_and_lifecycle.sql
-- =====================================================================
-- AUTO DYALI — 0026 : Historique des abonnements et RPC de cycle de vie
-- Complète la migration 0009 (tables plans, plan_features, subscriptions)
-- avec :
--   - table subscriptions_audit (historique des changements d'abonnement)
--   - RPC admin_renew_subscription() (renouvellement)
--   - RPC admin_reactivate_subscription() (réactivation après expiration)
--   - RPC admin_expire_subscription() (expiration forcée)
--   - RLS policies pour les nouvelles tables
--
-- Ne pas exécuter sur Supabase distant sans autorisation.

-- ---------------------------------------------------------------------
-- 1. TABLE D'HISTORIQUE DES ABONNEMENTS
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions_audit (
  id               uuid primary key default uuid_generate_v4(),
  subscription_id  uuid not null references public.subscriptions(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  actor_id         uuid references auth.users(id),
  action           text not null check (action in ('create','change_plan','renew','suspend','reactivate','expire','cancel')),
  ancien_plan      text,
  nouveau_plan     text,
  ancien_statut    text,
  nouveau_statut   text,
  ancien_heure_essai timestamptz,
  nouveau_heure_essai timestamptz,
  ancien_fin_periode timestamptz,
  nouveau_fin_periode timestamptz,
  payload_json     jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

comment on table public.subscriptions_audit is
  'Historique complet des changements dabonnement. Qui a modifie quoi et quand.';

create index if not exists subscriptions_audit_subscription_idx
  on public.subscriptions_audit(subscription_id);
create index if not exists subscriptions_audit_establishment_idx
  on public.subscriptions_audit(establishment_id);
create index if not exists subscriptions_audit_created_at_idx
  on public.subscriptions_audit(created_at);

-- ---------------------------------------------------------------------
-- 2. DROITS RLS sur subscriptions_audit
-- ---------------------------------------------------------------------
alter table public.subscriptions_audit enable row level security;

drop policy if exists subscriptions_audit_saas_admin on public.subscriptions_audit;
create policy subscriptions_audit_saas_admin on public.subscriptions_audit for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists subscriptions_audit_tenant on public.subscriptions_audit;
create policy subscriptions_audit_tenant on public.subscriptions_audit for select
  using (establishment_id = public.current_establishment_id() or public.is_saas_admin());

grant select on public.subscriptions_audit to authenticated;
grant all on public.subscriptions_audit to service_role;

-- ---------------------------------------------------------------------
-- 3. RPC : admin_renew_subscription()
-- Renouvellement dun abonnement actif ou expiré.
-- Met à jour current_period_end et réactive si nécessaire.
-- ---------------------------------------------------------------------
create or replace function public.admin_renew_subscription(
  p_establishment_id uuid,
  p_months integer default 12
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_ancien_plan   text;
  v_ancien_fin    timestamptz;
  v_nouveau_fin   timestamptz;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  if p_months <= 0 then
    raise exception 'La durée de renouvellement doit être positive.';
  end if;

  -- Récupération de l abonnement courant
  select s.id, s.status, s.plan_code, s.current_period_end
    into v_sub_id, v_ancien_statut, v_ancien_plan, v_ancien_fin
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('active','trial','past_due','suspended','expired')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement trouvable pour cet établissement.';
  end if;

  -- Calcul de la nouvelle date de fin
  if v_ancien_fin is not null and v_ancien_fin > now() then
    v_nouveau_fin := v_ancien_fin + (p_months || ' months')::interval;
  else
    v_nouveau_fin := now() + (p_months || ' months')::interval;
  end if;

  -- Mise à jour de l abonnement
  update public.subscriptions
     set status = 'active',
         current_period_end = v_nouveau_fin,
         updated_at = now()
   where id = v_sub_id;

  -- Mise à jour de l établissement
  update public.establishments
     set plan = v_ancien_plan,
         updated_at = now()
   where id = p_establishment_id;

  -- Journal dans subscriptions_audit
  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    ancien_fin_periode, nouveau_fin_periode,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'renew',
    v_ancien_plan, v_ancien_plan, v_ancien_statut, 'active',
    v_ancien_fin, v_nouveau_fin,
    jsonb_build_object('months', p_months)
  );

  -- Journal dans audit_log
  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'renew', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'active', 'duree_mois', p_months));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC : admin_reactivate_subscription()
-- Réactive un abonnement suspendu ou expiré.
-- ---------------------------------------------------------------------
create or replace function public.admin_reactivate_subscription(
  p_establishment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_ancien_plan   text;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select s.id, s.status, s.plan_code
    into v_sub_id, v_ancien_statut, v_ancien_plan
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('suspended','expired','cancelled')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement suspendu ou expiré trouvable pour cet établissement.';
  end if;

  update public.subscriptions
     set status = 'active',
         updated_at = now()
   where id = v_sub_id;

  update public.establishments
     set plan = v_ancien_plan,
         is_active = true,
         suspended_at = null,
         updated_at = now()
   where id = p_establishment_id;

  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'reactivate',
    v_ancien_plan, v_ancien_plan, v_ancien_statut, 'active',
    jsonb_build_object('raison', 'réactivation manuelle par le Super Admin')
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'reactivate', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'active'));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC : admin_expire_subscription()
-- Marque un abonnement comme expiré (sans supprimer les données).
-- ---------------------------------------------------------------------
create or replace function public.admin_expire_subscription(
  p_establishment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select s.id, s.status
    into v_sub_id, v_ancien_statut
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('active','trial','past_due')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement actif trouvable pour cet établissement.';
  end if;

  update public.subscriptions
     set status = 'expired',
         updated_at = now()
   where id = v_sub_id;

  update public.establishments
     set is_active = false,
         suspended_at = now(),
         updated_at = now()
   where id = p_establishment_id;

  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'expire',
    (select plan_code from public.subscriptions where id = v_sub_id),
    (select plan_code from public.subscriptions where id = v_sub_id),
    v_ancien_statut, 'expired',
    jsonb_build_object('raison', 'expiration manuelle par le Super Admin')
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'expire', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'expired'));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. PERMISSIONS
-- ---------------------------------------------------------------------
grant execute on function public.admin_renew_subscription(uuid,integer) to authenticated;
grant execute on function public.admin_reactivate_subscription(uuid) to authenticated;
grant execute on function public.admin_expire_subscription(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- NOTE : Aucun prix, durée dessai ou règle commerciale nest imposé ici.
-- Le Super Admin configure les prix via admin_save_plan() et les dates
-- via les RPC ci-dessus. Les règles commerciales (durée dessai, tarif,
-- renouvellement automatique) doivent être décidées par le propriétaire.

-- =====================================================================
-- MIGRATION 0029 — CRM enrichi (PENDING)
-- Fichier source : supabase/migrations/0029_crm_extension_prepared_NOT_APPLIED.sql
-- =====================================================================
-- =====================================================================
-- AUTO DYALI — 0029 : CRM enrichi (source / priorité / valeur potentielle)
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- PRÉREQUIS : 0018 appliquée (tables crm_leads / crm_events présentes).
-- Ne pas exécuter sans sauvegarde/PITR vérifiée et autorisation explicite.
-- Aucune donnée existante n'est supprimée ou modifiée ; colonnes ajoutées
-- avec valeurs par défaut sûres (nullable ou défaut 'normal').
-- =====================================================================

alter table public.crm_leads
  add column if not exists source          text,              -- site web, salon, recommandation, cold call, autre
  add column if not exists priority        text not null default 'normal'
            check (priority in ('low','normal','high','urgent')),
  add column if not exists estimated_value numeric(10,2);     -- valeur potentielle en MAD (contrôle côté app)

create index if not exists crm_leads_source_idx   on public.crm_leads (source);
create index if not exists crm_leads_priority_idx on public.crm_leads (priority);

comment on column public.crm_leads.source is 'Source du prospect (site web, salon, recommandation…).';
comment on column public.crm_leads.priority is 'Priorité commerciale : low|normal|high|urgent.';
comment on column public.crm_leads.estimated_value is 'Valeur potentielle du prospect (MAD) — NULL si inconnue.';

-- =====================================================================
-- MIGRATIONS PHASE 2 (créées localement, application distante en attente)
-- =====================================================================
-- 0030_super_admin_security_hardening.sql
-- =====================================================================
-- AUTO DYALI — 0030 : Sécurité Super Admin (Phase 2 — audit read-only)
-- Objet : durcir l'exécution de suppression de compte client.
--
-- Contexte : `admin_delete_client_account` avait été créée directement
-- dans la base distante (hors migrations versionnées) et n'avait pas de
-- garde `is_saas_admin()` fiable. L'audit read-only avait montré qu'un
-- appel non authentifié atteignait la logique applicative (erreur métier
-- P0001) au lieu d'une erreur d'autorisation.
--
-- Action : recréer la fonction avec garde Super Admin + journalisation
-- audit + retrait des privilèges PUBLIC.
--
-- Sécurité :
--   - aucune donnée métier existante n'est supprimée ici,
--   - l'accès est réservé au rôle `saas_admin` authentifié,
--   - toute suppression est journalisée dans `audit_log`.
-- =====================================================================

create or replace function public.admin_delete_client_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'Profil introuvable.';
  end if;

  delete from public.clients
   where establishment_id = v_profile.establishment_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_profile.establishment_id, auth.uid(), 'delete_client_account', 'profile', p_user_id, jsonb_build_object('source', 'super_admin_dashboard'));

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_client_account(uuid) from public;
grant execute on function public.admin_delete_client_account(uuid) to authenticated;

-- 0031_profiles_rls_admin_access.sql
-- =====================================================================
-- AUTO DYALI — 0031 : RLS profils & clients (Phase 2)
-- Ajout des politiques manquantes identifiees lors de l'audit read-only:
--   - `profiles` n'avait pas de policy UPDATE -> les actions
--     d'activation/desactivation via le Super Admin echouaient en RLS.
--   - `clients` n'avait pas de policy Super Admin -> le dashboard
--     Super Admin ne pouvait pas lire la liste clients en conditions reelles.
-- =====================================================================

drop policy if exists profiles_saas_admin_update on public.profiles;
create policy profiles_saas_admin_update on public.profiles
  for update
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

drop policy if exists clients_saas_admin on public.clients;
create policy clients_saas_admin on public.clients
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

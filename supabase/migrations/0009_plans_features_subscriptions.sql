-- AUTO DYALI — 0009 : Moteur central de droits par forfait
-- STANDARD | SILVER | GOLD : fonctionnalités activables depuis le Super Admin.
-- Contrôle serveur : RPC has_feature() (security definer) appelée par l'UI ET par les
-- écritures sensibles. Une modification d'URL ne suffit pas : la RLS + les RPC vérifient.

-- ---------------------------------------------------------------------
-- 1. TABLE DES FORFAITS (configurable, prix libres — aucun prix imposé)
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique check (code in ('standard','silver','gold')),
  label         text not null,
  description   text default '',
  price_monthly numeric(10,2),          -- null = non configuré (jamais imposé)
  price_yearly  numeric(10,2),          -- null = non configuré
  currency      text not null default 'MAD',
  trial_days    integer not null default 14,
  max_users     integer not null default 5,
  max_sites     integer not null default 1,
  storage_mb    integer not null default 1024,
  options       jsonb not null default '{}'::jsonb,   -- promotions, taxes, renouvellement…
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FONCTIONNALITÉS PAR FORFAIT (moteur de droits)
-- ---------------------------------------------------------------------
create table if not exists public.plan_features (
  plan_code   text not null references public.plans(code) on delete cascade,
  feature_key text not null,
  enabled     boolean not null default false,
  primary key (plan_code, feature_key)
);

comment on table public.plan_features is 'Moteur de droits : feature_key active ou non pour un forfait.';

-- Fonctionnalités maîtres de la plateforme
insert into public.plan_features (plan_code, feature_key, enabled) values
  -- Offre STANDARD (offre d''entrée)
  ('standard','dashboard',true),
  ('standard','clients',true),
  ('standard','vehicles',true),
  ('standard','catalogue',true),
  ('standard','stock',true),
  ('standard','pos',true),
  ('standard','invoices',true),
  ('standard','quotes',true),
  ('standard','suppliers',true),
  ('standard','reports_basic',true),
  ('standard','stock_advanced',false),
  ('standard','purchasing',false),
  ('standard','employees',false),
  ('standard','workshop',false),
  ('standard','appointments',false),
  ('standard','tires',false),
  ('standard','barcode',false),
  ('standard','excel',false),
  ('standard','reports_finance',false),
  ('standard','cheques',false),
  ('standard','alerts',false),
  ('standard','crm',false),
  ('standard','ai',false),
  ('standard','automation',false),
  ('standard','analytics',false),
  ('standard','multisite',false),
  ('standard','whatsapp',false),
  ('standard','custom_reports',false),
  ('standard','advanced_permissions',false),
  ('standard','advanced_suppliers',false),
  ('standard','support',true),
  -- Offre SILVER = STANDARD + fonctions atelier/stock avancé
  ('silver','dashboard',true),
  ('silver','clients',true),
  ('silver','vehicles',true),
  ('silver','catalogue',true),
  ('silver','stock',true),
  ('silver','pos',true),
  ('silver','invoices',true),
  ('silver','quotes',true),
  ('silver','suppliers',true),
  ('silver','reports_basic',true),
  ('silver','stock_advanced',true),
  ('silver','purchasing',true),
  ('silver','employees',true),
  ('silver','workshop',true),
  ('silver','appointments',true),
  ('silver','tires',true),
  ('silver','barcode',true),
  ('silver','excel',true),
  ('silver','reports_finance',true),
  ('silver','cheques',true),
  ('silver','alerts',true),
  ('silver','crm',true),
  ('silver','ai',false),
  ('silver','automation',false),
  ('silver','analytics',false),
  ('silver','multisite',false),
  ('silver','whatsapp',false),
  ('silver','custom_reports',false),
  ('silver','advanced_permissions',false),
  ('silver','advanced_suppliers',false),
  ('silver','support',true),
  -- Offre GOLD = tout activé
  ('gold','dashboard',true),
  ('gold','clients',true),
  ('gold','vehicles',true),
  ('gold','catalogue',true),
  ('gold','stock',true),
  ('gold','pos',true),
  ('gold','invoices',true),
  ('gold','quotes',true),
  ('gold','suppliers',true),
  ('gold','reports_basic',true),
  ('gold','stock_advanced',true),
  ('gold','purchasing',true),
  ('gold','employees',true),
  ('gold','workshop',true),
  ('gold','appointments',true),
  ('gold','tires',true),
  ('gold','barcode',true),
  ('gold','excel',true),
  ('gold','reports_finance',true),
  ('gold','cheques',true),
  ('gold','alerts',true),
  ('gold','crm',true),
  ('gold','ai',true),
  ('gold','automation',true),
  ('gold','analytics',true),
  ('gold','multisite',true),
  ('gold','whatsapp',true),
  ('gold','custom_reports',true),
  ('gold','advanced_permissions',true),
  ('gold','advanced_suppliers',true),
  ('gold','support',true)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. TABLE DES SOUSCRIPTIONS (historique, essais, expiration)
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id               uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  plan_code        text not null references public.plans(code),
  status           text not null default 'active'
                   check (status in ('trial','active','past_due','suspended','expired','cancelled')),
  started_at       timestamptz not null default now(),
  trial_ends_at    timestamptz,
  current_period_end timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now()
);

comment on table public.subscriptions is 'Historique des abonnements. L expiration ne supprime JAMAIS les donnees de l entreprise.';

create index if not exists subscriptions_establishment_idx on public.subscriptions(establishment_id);

-- ---------------------------------------------------------------------
-- 4. COLONNES ESSAI / SUSPENSION sur establishments
-- ---------------------------------------------------------------------
alter table public.establishments
  add column if not exists trial_ends_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists logo_url text;

-- ---------------------------------------------------------------------
-- 5. RPC : has_feature() — contrôle serveur des droits
-- ---------------------------------------------------------------------
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pf.enabled
       from public.establishments e
       join public.plan_features pf on pf.plan_code = e.plan
      where e.id = public.current_establishment_id()
        and pf.feature_key = p_feature),
    false
  );
$$;

comment on function public.has_feature(text) is
  'Vrai si le forfait de l etablissement courant autorise la fonctionnalite. A appeler cote UI ET cote serveur (RPC/RLS).';

grant execute on function public.has_feature(text) to authenticated;

-- Vue synthétique des droits de l etablissement courant (un seul appel pour toute l UI)
create or replace function public.my_features()
returns table(feature_key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select pf.feature_key, pf.enabled
    from public.establishments e
    join public.plan_features pf on pf.plan_code = e.plan
   where e.id = public.current_establishment_id();
$$;

grant execute on function public.my_features() to authenticated;

-- ---------------------------------------------------------------------
-- 6. DROITS SUPER ADMIN sur les nouvelles tables
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists plans_saas_admin on public.plans;
create policy plans_saas_admin on public.plans for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists plans_authenticated_read on public.plans;
create policy plans_authenticated_read on public.plans for select using (auth.uid() is not null);

drop policy if exists plan_features_saas_admin on public.plan_features;
create policy plan_features_saas_admin on public.plan_features for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists plan_features_authenticated_read on public.plan_features;
create policy plan_features_authenticated_read on public.plan_features for select using (auth.uid() is not null);

drop policy if exists subscriptions_tenant on public.subscriptions;
create policy subscriptions_tenant on public.subscriptions for select
  using (establishment_id = public.current_establishment_id() or public.is_saas_admin());

drop policy if exists subscriptions_saas_admin on public.subscriptions;
create policy subscriptions_saas_admin on public.subscriptions for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select on public.plans, public.plan_features, public.subscriptions to authenticated;
grant all on public.plans, public.plan_features, public.subscriptions to service_role;

-- ---------------------------------------------------------------------
-- 7. SEED : les trois offres (sans prix — à configurer par le Super Admin)
-- ---------------------------------------------------------------------
insert into public.plans (code, label, description) values
  ('standard','STANDARD','Gestion entreprise, clients, catalogue, stock de base, POS, factures, devis, rapports essentiels.'),
  ('silver','SILVER','Tout STANDARD + stock avancé, achats, employés, atelier, rendez-vous, pneumatiques, scanner, Excel, rapports financiers, chèques, alertes, CRM.'),
  ('gold','GOLD','Tout SILVER + AUTO DYALI AI, automatisations, analyses avancées, multi-sites, WhatsApp, rapports personnalisés, permissions avancées.')
on conflict (code) do nothing;

-- Abonnement actif pour chaque établissement existant
insert into public.subscriptions (establishment_id, plan_code, status, current_period_end)
select e.id, e.plan, 'active', now() + interval '1 year'
  from public.establishments e
 where not exists (
   select 1 from public.subscriptions s where s.establishment_id = e.id
 );

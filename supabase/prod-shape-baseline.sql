-- BASELINE FORME PRODUCTION (schéma seul, aucune donnée) — généré en lecture seule
do $$ begin create type public.user_role as enum ('saas_admin','manager','employee','client'); exception when duplicate_object then null; end $$;
create table if not exists public.audit_log (
  id uuid not null default extensions.uuid_generate_v4(),
  establishment_id uuid,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload_json jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.establishments (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  slug text not null,
  address text,
  city text,
  phone text,
  email text,
  currency text not null default 'MAD'::text,
  timezone text not null default 'Africa/Casablanca'::text,
  plan text not null default 'starter'::text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  trial_ends_at timestamp with time zone,
  suspended_at timestamp with time zone,
  logo_url text
);

create table if not exists public.onboarding_requests (
  request_id text not null,
  company_name text not null,
  slug text not null,
  plan text not null,
  company_email text,
  manager_user_id uuid,
  establishment_id uuid,
  status text not null default 'started'::text,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone
);

create table if not exists public.permissions (
  id uuid not null default extensions.uuid_generate_v4(),
  establishment_id uuid not null,
  role user_role not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false
);

create table if not exists public.plan_features (
  plan_code text not null,
  feature_key text not null,
  enabled boolean not null default false
);

create table if not exists public.plans (
  id uuid not null default extensions.uuid_generate_v4(),
  code text not null,
  label text not null,
  description text default ''::text,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  currency text not null default 'MAD'::text,
  trial_days integer not null default 14,
  max_users integer not null default 5,
  max_sites integer not null default 1,
  storage_mb integer not null default 1024,
  options jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.profiles (
  id uuid not null,
  full_name text not null,
  phone text,
  establishment_id uuid,
  role user_role not null default 'employee'::user_role,
  avatar_url text,
  is_active boolean not null default true,
  pin_hash text,
  hourly_rate numeric(10,2),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.subscriptions (
  id uuid not null default extensions.uuid_generate_v4(),
  establishment_id uuid not null,
  plan_code text not null,
  status text not null default 'active'::text,
  started_at timestamp with time zone not null default now(),
  trial_ends_at timestamp with time zone,
  current_period_end timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);


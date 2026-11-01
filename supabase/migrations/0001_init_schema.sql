-- =====================================================================
-- AUTO+ — Schéma initial (migration supabase)
-- SaaS multi-établissements : tout enregistrement métier porte
-- establishment_id et est protégé par RLS.
-- Rôles SaaS : saas_admin (plateforme) | manager | employee | client
--=====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. TYPES
-- ---------------------------------------------------------------------
create type user_role        as enum ('saas_admin', 'manager', 'employee', 'client');
create type vehicle_status   as enum ('active', 'in_atelier', 'delivered');
create type or_status        as enum ('pending', 'in_progress', 'waiting_parts', 'done', 'delivered', 'cancelled');
create type payment_method   as enum ('cash', 'card', 'cheque', 'credit', 'transfer');
create type stock_move_dir   as enum ('in', 'out', 'transfer', 'adjustment');
create type appointment_way  as enum ('walkin', 'online', 'phone', 'counter');
create type po_status        as enum ('draft', 'sent', 'partially_received', 'received', 'cancelled');
create type sale_status      as enum ('open', 'paid', 'partial', 'refunded', 'cancelled');

-- ---------------------------------------------------------------------
-- 1. ÉTABLISSEMENTS (pilier multi-tenant)
-- ---------------------------------------------------------------------
create table establishments (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  address     text,
  city        text,
  phone       text,
  email       text,
  currency    text not null default 'MAD',
  timezone    text not null default 'Africa/Casablanca',
  plan        text not null default 'starter',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. UTILISATEURS & EMPLOYÉS
-- ---------------------------------------------------------------------
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  phone             text,
  establishment_id  uuid references establishments(id) on delete set null,
  role              user_role not null default 'employee',
  avatar_url        text,
  is_active         boolean not null default true,
  pin_hash          text, -- pointage PIN/QR (hashé, jamais en clair)
  hourly_rate       numeric(10,2),
  created_at        timestamptz not null default now()
);

create table employees (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete set null,
  code              text not null,
  full_name         text not null,
  job_title         text not null default 'Mécanicien',
  hired_at          date,
  weekly_hours      numeric(5,1) not null default 40,
  active_permanent  boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (establishment_id, code)
);

-- Pointage (entrées / sorties de service)
create table attendance (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  employee_id       uuid not null references employees(id) on delete cascade,
  clock_in          timestamptz not null default now(),
  clock_out         timestamptz,
  method            text not null default 'pin', -- pin | qr | manual
  notes             text
);

create table permissions (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  role              user_role not null,
  module            text not null,   -- pos | stock | atelier | caisse ...
  can_view          boolean not null default false,
  can_create        boolean not null default false,
  can_edit          boolean not null default false,
  can_delete        boolean not null default false,
  unique (establishment_id, role, module)
);

-- Journal des opérations sensibles
create table audit_log (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid references establishments(id) on delete cascade,
  actor_id          uuid references auth.users(id) on delete set null,
  action            text not null,
  entity            text not null,
  entity_id         uuid,
  payload_json      jsonb,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CLIENTS & VÉHICULES
-- ---------------------------------------------------------------------
create table clients (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  code              text not null unique,
  full_name         text not null,
  phone             text,
  email             text,
  address           text,
  city              text,
  notes             text,
  balance_due       numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (establishment_id, code)
);

create table vehicles (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  plate             text not null,
  brand             text not null,
  model             text not null,
  year              integer,
  vin               text,
  mileage           integer not null default 0,
  fuel_type         text,
  status            vehicle_status not null default 'active',
  created_at        timestamptz not null default now(),
  unique (establishment_id, plate)
);

-- ---------------------------------------------------------------------
-- 4. CATALOGUE : SERVICES & PRODUITS
-- ---------------------------------------------------------------------
create table services (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  name              text not null,
  category          text not null
                    check (category in ('vidange','pneumatiques','freinage','reparation','diagnostic','autre')),
  price             numeric(10,2) not null default 0,
  duration_min      integer not null default 60,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create table products (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  sku               text not null,
  barcode           text,
  name              text not null,
  category          text not null
                    check (category in ('piece','accessoire','lubrifiant','merchandise','autrep')),
  unit              text not null default 'unité',
  purchase_price    numeric(10,2) not null default 0,
  sale_price        numeric(10,2) not null default 0,
  tax_rate          numeric(5,2)   not null default 20,
  min_stock         integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (establishment_id, sku)
);

-- Lots (traçabilité complète)
create table product_lots (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  lot_code          text,
  expires_at        date,
  quantity          numeric(10,2) not null default 0,
  unit_cost         numeric(10,2) not null default 0,
  received_at       timestamptz not null default now()
);

create table stock_movements (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  lot_id            uuid references product_lots(id) on delete set null,
  direction         stock_move_dir not null,
  quantity          numeric(10,2) not null,
  reference         text,
  related_work_order uuid,
  actor_id          uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table inventory_counts ( -- inventaire physique
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  label             text not null,
  counted_by        uuid references auth.users(id) on delete set null,
  counted_at        timestamptz not null default now(),
  status            text not null default 'open' -- open | closed
);

-- ---------------------------------------------------------------------
-- 5. FOURNISSEURS & ACHATS
-- ---------------------------------------------------------------------
create table suppliers (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  name              text not null,
  contact_name      text,
  phone             text,
  email             text,
  notes             text,
  balance_due       numeric(12,2) not null default 0,
  created_at        timestamptz not null default now()
);

create table purchase_orders (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  supplier_id       uuid not null references suppliers(id) on delete restrict,
  reference         text not null,
  status            po_status not null default 'draft',
  ordered_at        date not null default current_date,
  expected_at       date,
  received_at       timestamptz,
  total_amount      numeric(12,2) not null default 0,
  paid_amount       numeric(12,2) not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (establishment_id, reference)
);
alter table purchase_orders add constraint purchase_orders_tenant_id_unique unique (establishment_id, id);

create table purchase_order_items (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  purchase_order_id uuid not null,
  product_id        uuid references products(id) on delete set null,
  label             text not null,
  quantity          numeric(10,2) not null default 1,
  received_quantity numeric(10,2) not null default 0,
  unit_price        numeric(10,2) not null default 0
);
alter table purchase_order_items add constraint purchase_order_items_order_tenant_fk
  foreign key (establishment_id, purchase_order_id)
  references purchase_orders(establishment_id, id) on delete cascade;

-- ---------------------------------------------------------------------
-- 6. ATELIER : ORDRES DE RÉPARATION & PLANNING
-- ---------------------------------------------------------------------
create table work_orders (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  reference         text not null,           -- OR-2025-048
  vehicle_id        uuid not null references vehicles(id) on delete restrict,
  client_id         uuid not null references clients(id) on delete restrict,
  assigned_to       uuid references employees(id) on delete set null,
  status            or_status not null default 'pending',
  diagnosis         text,
  approved_by_client boolean not null default false,
  opened_at         timestamptz not null default now(),
  closed_at         timestamptz,
  due_at            timestamptz,
  total_amount      numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (establishment_id, reference)
);
alter table work_orders add constraint work_orders_tenant_id_unique unique (establishment_id, id);

create table work_order_tasks (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  work_order_id     uuid not null,
  service_id        uuid references services(id) on delete set null,
  label             text not null,
  status            text not null default 'pending', -- pending | in_progress | done | cancelled
  technician_id     uuid references employees(id) on delete set null,
  minutes_spent     integer,
  price             numeric(10,2) not null default 0,
  quality_checked   boolean not null default false
);
alter table work_order_tasks add constraint work_order_tasks_order_tenant_fk
  foreign key (establishment_id, work_order_id)
  references work_orders(establishment_id, id) on delete cascade;

--(Notification) Rappels d'entretien automatiques
create table maintenance_reminders (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  vehicle_id        uuid not null references vehicles(id) on delete cascade,
  due_date          date not null,
  message           text not null,
  is_done           boolean not null default false,
  created_at        timestamptz not null default now()
);

create table appointments (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  vehicle_id        uuid references vehicles(id) on delete set null,
  service_id        uuid references services(id) on delete set null,
  slot_start        timestamptz not null,
  slot_end          timestamptz not null,
  channel           appointment_way not null default 'online',
  status            text not null default 'confirmed', -- confirmed | done | no_show | cancelled
  mechanic_id       uuid references employees(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. VENTES : POS, TICKETS, FACTURES, PAIEMENTS
-- ---------------------------------------------------------------------
create table sales (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  work_order_id     uuid references work_orders(id) on delete set null,
  reference         text not null,
  status            sale_status not null default 'open',
  subtotal          numeric(12,2) not null default 0,
  discount          numeric(12,2) not null default 0,
  tax_total         numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  paid_total        numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (establishment_id, reference)
);
alter table sales add constraint sales_tenant_id_unique unique (establishment_id, id);

create table sale_items (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  sale_id           uuid not null,
  product_id        uuid references products(id) on delete set null,
  service_id        uuid references services(id) on delete set null,
  label             text not null,
  quantity          numeric(10,2) not null default 1,
  unit_price        numeric(10,2) not null default 0,
  tax_rate          numeric(5,2)  not null default 20,
  discount          numeric(10,2) not null default 0
);
alter table sale_items add constraint sale_items_sale_tenant_fk
  foreign key (establishment_id, sale_id)
  references sales(establishment_id, id) on delete cascade;

create table payments (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  sale_id           uuid not null references sales(id) on delete cascade,
  method            payment_method not null,
  amount            numeric(12,2) not null,
  paid_at           timestamptz not null default now(),
  received_by       uuid references auth.users(id) on delete set null
);

create table invoices ( -- documents légaux (facture = ticket transformé)
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  sale_id           uuid not null references sales(id) on delete restrict,
  number            text not null,
  issued_at         date not null default current_date,
  total             numeric(12,2) not null,
  unique (establishment_id, number)
);

-- ---------------------------------------------------------------------
-- 8. CAISSE & FINANCES
-- ---------------------------------------------------------------------
create table cash_sessions (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  opened_by         uuid references auth.users(id) on delete set null,
  closed_by         uuid references auth.users(id) on delete set null,
  opening_amount    numeric(12,2) not null default 0,
  closing_amount    numeric(12,2),
  expected_amount   numeric(12,2),
  opened_at         timestamptz not null default now(),
  closed_at         timestamptz
);

create table expenses (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  category          text not null, -- salaires | loyer | fournisseurs | impôts | autre
  label             text not null,
  amount            numeric(12,2) not null,
  spent_at          date not null default current_date,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS CLIENTS (espace client)
-- ---------------------------------------------------------------------
create table client_notifications (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references establishments(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  title             text not null,
  body              text not null,
  is_read            boolean not null default false,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- RLS — MULTI-TENANT STRICT
--=====================================================================
alter table establishments              enable row level security;
alter table profiles                    enable row level security;
alter table employees                   enable row level security;
alter table attendance                  enable row level security;
alter table permissions                 enable row level security;
alter table audit_log                   enable row level security;
alter table clients                     enable row level security;
alter table vehicles                    enable row level security;
alter table services                    enable row level security;
alter table products                    enable row level security;
alter table product_lots                enable row level security;
alter table stock_movements             enable row level security;
alter table inventory_counts            enable row level security;
alter table suppliers                   enable row level security;
alter table purchase_orders             enable row level security;
alter table purchase_order_items        enable row level security;
alter table work_orders                 enable row level security;
alter table work_order_tasks            enable row level security;
alter table maintenance_reminders       enable row level security;
alter table appointments                enable row level security;
alter table sales                       enable row level security;
alter table sale_items                  enable row level security;
alter table payments                    enable row level security;
alter table invoices                    enable row level security;
alter table cash_sessions               enable row level security;
alter table expenses                    enable row level security;
alter table client_notifications        enable row level security;

-- Helper : establishment_id de l'utilisateur connecté
create or replace function current_establishment_id()
returns uuid language sql stable as $$
  select establishment_id from profiles where id = auth.uid();
$$;

-- Helper : rôle de l'utilisateur connecté
create or replace function current_role()
returns user_role language sql stable as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper : admin SaaS
create or replace function is_saas_admin()
returns boolean language sql stable as $$
  select current_role() = 'saas_admin';
$$;

-- Helper : manager ou plus
create or replace function is_manager()
returns boolean language sql stable as $$
  select current_role() in ('manager','saas_admin');
$$;

-- Policies génériques : l'utilisateur voit uniquement son établissement
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname='public'
      and tablename in (
        'employees','attendance','permissions','audit_log','clients','vehicles',
        'services','products','product_lots','stock_movements','inventory_counts',
        'suppliers','purchase_orders','purchase_order_items','work_orders',
        'work_order_tasks','maintenance_reminders','appointments','sales','sale_items',
        'payments','invoices','cash_sessions','expenses','client_notifications'
      )
  loop
    execute format($f$ drop policy if exists tenant_isolation on %I;
      create policy tenant_isolation on %I
      using (establishment_id = current_establishment_id())
      with check (establishment_id = current_establishment_id());
    $f$, t, t);
  end loop;
end $$;

-- Profiles : chacun voit au moins son propre profil
create policy profiles_self_or_same_establishment on profiles
  using (id = auth.uid() or establishment_id = current_establishment_id());

-- SaaS admin : tout voir (policies additivas via WITH CHECK par défaut)
create policy saas_admin_full_access on establishments
  using (is_saas_admin());

-- Policy spécifique : les établissements sont visibles par leurs membres
create policy own_establishment on establishments
  using (id = current_establishment_id());

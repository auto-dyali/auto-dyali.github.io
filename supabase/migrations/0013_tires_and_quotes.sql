-- AUTO DYALI — 0013 : Module pneumatiques + Devis (quotes)
-- 1) tire_specs : caractéristiques techniques des pneus, liées aux produits stock.
-- 2) quotes / quote_items : devis avec conversion en vente (offre STANDARD).
-- 3) Catalogue de prestations pneus proposé à TOUS les établissements
--    (données de catalogue, désactivables — pas des KPI).

-- ---------------------------------------------------------------------
-- 1. SPÉCIFICATIONS PNEUMATIQUES
-- ---------------------------------------------------------------------
create table if not exists public.tire_specs (
  id                   uuid primary key default uuid_generate_v4(),
  establishment_id     uuid not null references public.establishments(id) on delete cascade,
  product_id           uuid not null references public.products(id) on delete cascade,
  fabricant            text not null,
  modele               text,
  reference_fabricant  text,
  largeur              integer not null,           -- ex. 205 (mm)
  hauteur              integer not null,           -- ex. 55 (%)
  diametre             integer not null,           -- ex. 16 (pouces)
  indice_charge        integer,                    -- ex. 91
  indice_vitesse       text,                       -- ex. V, H, W, T
  saison               text not null default '4saisons'
                       check (saison in ('ete','hiver','4saisons')),
  type_pneu            text not null default 'tourisme'
                       check (type_pneu in ('tourisme','utilitaire','poids_lourd','moto','agricole','engin')),
  vehicules_compatibles text,                      -- texte validé (jamais inventé)
  fournisseur_id       uuid references public.suppliers(id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (establishment_id, product_id)
);

comment on column public.tire_specs.vehicules_compatibles is
  'Compatibilités véhicules : ne renseigner qu après validation d une source fiable.';

create index if not exists tire_specs_dims_idx
  on public.tire_specs (establishment_id, largeur, hauteur, diametre);

alter table public.tire_specs enable row level security;

drop policy if exists tire_specs_tenant on public.tire_specs;
create policy tire_specs_tenant on public.tire_specs
  for all using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

-- ---------------------------------------------------------------------
-- 2. DEVIS (quotes) — offre STANDARD, conversion en vente
-- ---------------------------------------------------------------------
create table if not exists public.quotes (
  id                 uuid primary key default uuid_generate_v4(),
  establishment_id   uuid not null references public.establishments(id) on delete cascade,
  client_id          uuid references public.clients(id) on delete set null,
  vehicle_id         uuid references public.vehicles(id) on delete set null,
  reference          text not null,
  status             text not null default 'draft'
                     check (status in ('draft','sent','accepted','converted','expired','cancelled')),
  subtotal           numeric(12,2) not null default 0,
  discount           numeric(12,2) not null default 0,
  tax_total          numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  valid_until        date,
  notes              text,
  converted_sale_id  uuid references public.sales(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (establishment_id, reference)
);

create table if not exists public.quote_items (
  id               uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  quote_id         uuid not null references public.quotes(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  service_id       uuid references public.services(id) on delete set null,
  label            text not null,
  quantity         numeric(10,2) not null default 1,
  unit_price       numeric(12,2) not null default 0,
  tax_rate         numeric(5,2) not null default 20,
  discount         numeric(5,2) not null default 0,
  position         integer not null default 0
);

create index if not exists quotes_establishment_idx on public.quotes (establishment_id, created_at desc);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists quotes_tenant on public.quotes;
create policy quotes_tenant on public.quotes
  for all using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists quote_items_tenant on public.quote_items;
create policy quote_items_tenant on public.quote_items
  for all using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

grant select, insert, update, delete on public.quotes, public.quote_items to authenticated;
grant select, insert, update, delete on public.tire_specs to authenticated;

-- ---------------------------------------------------------------------
-- 3. CATALOGUE DE PRESTATIONS PNEUS (chaque établissement existant)
--    Insertion idempotente : uniquement si la prestation n existe pas.
-- ---------------------------------------------------------------------
insert into public.services (establishment_id, name, category, price, duration_min)
select e.id, p.name, 'pneumatiques', p.price, p.duration_min
  from public.establishments e
  cross join (values
    ('Montage pneu (par pneu)', 80, 20),
    ('Équilibrage (par roue)', 60, 30),
    ('Permutation 4 pneus', 100, 40),
    ('Réparation crevaison', 70, 20),
    ('Géométrie / parallélisme', 250, 60),
    ('Remplacement valve', 30, 10),
    ('Contrôle de pression', 0, 10)
  ) as p(name, price, duration_min)
 where not exists (
   select 1 from public.services s
    where s.establishment_id = e.id
      and s.name = p.name
      and s.category = 'pneumatiques'
 );

-- AUTO DYALI — 0016 : Catalogue véhicules centralisé + compatibilités pièces
-- Structure : Catégorie → Fabricant → Référence → Compatibilités véhicules.
-- RÈGLE : une compatibilité n’est déclarée qu’avec une source et une
-- validation explicite (colonnes source + verified). Jamais inventée.

-- ---------------------------------------------------------------------
-- 1. CATALOGUE VÉHICULES (commun à toutes les marques, multi-tenant)
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_catalog (
  id             uuid primary key default uuid_generate_v4(),
  brand          text not null,                 -- Renault, Peugeot, Toyota…
  model          text not null,                 -- Clio, 208, Hilux…
  generation     text,                          -- Phase, châssis (ex. CB0/R9)
  year_from      integer,
  year_to        integer,
  fuel           text check (fuel in ('essence','diesel','hybride','electrique','gpl')),
  engine_code    text,                          -- K7M, DV6, 1GD-FTV…
  displacement   integer,                       -- cm3
  power_kw       integer,
  version        text,
  vehicle_type   text not null default 'voiture'
                 check (vehicle_type in ('voiture','utilitaire','camion','bus','remorque','moto','agricole','engin')),
  created_at     timestamptz not null default now(),
  unique (brand, model, coalesce(generation,''), coalesce(engine_code,''), coalesce(year_from,0))
);

comment on table public.vehicle_catalog is
  'Catalogue vehicules centralise : marque, modele, generation, motorisation. Donnees de reference reelles.';

alter table public.vehicle_catalog enable row level security;

drop policy if exists vehicle_catalog_read on public.vehicle_catalog;
create policy vehicle_catalog_read on public.vehicle_catalog
  for select using (auth.uid() is not null);

drop policy if exists vehicle_catalog_write on public.vehicle_catalog;
create policy vehicle_catalog_write on public.vehicle_catalog
  for insert with check (public.is_manager() or public.is_saas_admin());

drop policy if exists vehicle_catalog_update on public.vehicle_catalog;
create policy vehicle_catalog_update on public.vehicle_catalog
  for update using (public.is_manager() or public.is_saas_admin());

grant select, insert, update on public.vehicle_catalog to authenticated;

create index if not exists vehicle_catalog_search_idx
  on public.vehicle_catalog (brand, model);

-- ---------------------------------------------------------------------
-- 2. COMPATIBILITÉS PIÈCES ↔ VÉHICULES (relation N..N)
-- ---------------------------------------------------------------------
create table if not exists public.part_compatibilities (
  id                 uuid primary key default uuid_generate_v4(),
  establishment_id   uuid not null references public.establishments(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete cascade,
  vehicle_catalog_id uuid not null references public.vehicle_catalog(id) on delete cascade,
  position           text,                        -- avant/arrière/essieu avant…
  source             text not null,               -- catalogue fabricant, fiche OEM, validation tech.
  verified           boolean not null default false, -- validé par un technicien ?
  verified_by        uuid references auth.users(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (establishment_id, product_id, vehicle_catalog_id)
);

comment on column public.part_compatibilities.source IS
  'Source de la compatibilite : jamais declaree sans source fiable.';
comment on column public.part_compatibilities.verified IS
  'Validation humaine : une compatibilite non verifiee est affichee comme non confirmee.';

create index if not exists part_compat_product_idx on public.part_compatibilities (product_id);
create index if not exists part_compat_vehicle_idx on public.part_compatibilities (vehicle_catalog_id);

alter table public.part_compatibilities enable row level security;

drop policy if exists part_compat_tenant on public.part_compatibilities;
create policy part_compat_tenant on public.part_compatibilities
  for all using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

grant select, insert, delete on public.part_compatibilities to authenticated;

-- ---------------------------------------------------------------------
-- 3. VÉHICULES DE RÉFÉRENCE (données réelles de base, multi-marques)
--    Insertion idempotente — aucun doublon.
-- ---------------------------------------------------------------------
insert into public.vehicle_catalog (brand, model, generation, year_from, year_to, fuel, engine_code, displacement, power_kw, vehicle_type)
values
  ('Renault','Clio','IV (CB0)',2012,2019,'essence','K7M',1498,55,'voiture'),
  ('Renault','Clio','IV (CB0)',2012,2019,'diesel','K9K',1461,55,'voiture'),
  ('Renault','Clio','V (RHL)',2019,2026,'essence','H4D',999,49,'voiture'),
  ('Renault','Clio','V (RHL)',2019,2026,'diesel','R9N',1461,55,'voiture'),
  ('Renault','Captur','I (H51)',2013,2019,'essence','K4M',1598,84,'voiture'),
  ('Renault','Megane','IV (LZ0)',2015,2022,'diesel','R9N',1598,65,'voiture'),
  ('Dacia','Logan','I (L53)',2004,2016,'essence','K7M',1498,55,'voiture'),
  ('Dacia','Sandero','II (B52)',2012,2020,'essence','H4B',898,54,'voiture'),
  ('Dacia','Duster','I (AM0)',2010,2017,'diesel','K9K',1461,66,'voiture'),
  ('Peugeot','208','II (P21)',2019,2026,'essence','EC5',1199,56,'voiture'),
  ('Peugeot','208','I (A9)',2012,2018,'diesel','DV6',1560,55,'voiture'),
  ('Peugeot','301','I (BZ7)',2012,2025,'essence','TU3',1360,52,'voiture'),
  ('Citroën','C3','II (A51)',2009,2016,'essence','TU3',1360,48,'voiture'),
  ('Citroën','C4','II (B7)',2010,2018,'diesel','DV6',1560,66,'voiture'),
  ('Toyota','Yaris','III (XP130)',2011,2020,'essence','1NR-FE',1329,64,'voiture'),
  ('Toyota','Hilux','VIII (AN120)',2015,2026,'diesel','2GD-FTV',2393,110,'utilitaire'),
  ('Volkswagen','Golf','VII (5G1)',2012,2020,'essence','CJSA',1395,90,'voiture'),
  ('Hyundai','i10','II (AC3)',2019,2026,'essence','Kappa',998,49,'voiture'),
  ('Kia','Picanto','III (JA8)',2017,2026,'essence','Kappa',998,49,'voiture'),
  ('Ford','F-150','XV (P702)',2015,2024,'essence','5.0 V8',4954,298,'utilitaire')
on conflict do nothing;

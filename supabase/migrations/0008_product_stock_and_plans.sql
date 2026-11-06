-- AUTO DYALI — 0008 : Stock produit + base des forfaits
-- 1) Colonne stock sur products (le POS lit products.stock ; sans elle, PostgREST échoue
--    silencieusement et le POS retombe sur le catalogue de test).
-- 2) Normalisation de establishments.plan vers standard|silver|gold.

-- ---------------------------------------------------------------------
-- 1. STOCK PRODUIT
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists stock integer not null default 0;

-- Initialiser le stock depuis la somme des lots existants.
update public.products p
set stock = coalesce(l.total_qty, 0)
from (
  select product_id, sum(quantity) as total_qty
  from public.product_lots
  group by product_id
) l
where l.product_id = p.id;

comment on column public.products.stock is 'Stock actuel en unités (somme des lots à la création, puis maintenu par les mouvements).';

-- ---------------------------------------------------------------------
-- 2. FORFAITS : valeurs standard | silver | gold
-- ---------------------------------------------------------------------
alter table public.establishments
  add constraint establishments_plan_check
  check (plan in ('standard', 'silver', 'gold'));

-- Migrer l'ancienne valeur 'starter' vers l'offre d'entrée.
update public.establishments set plan = 'standard' where plan = 'starter';

comment on column public.establishments.plan is 'Forfait actif : standard | silver | gold.';

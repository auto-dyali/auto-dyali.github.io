-- AUTO DYALI — 0014 : catégorie 'pneumatique' pour products
-- Le check d'origine n'autorise pas les pneus (module pneumatiques).

alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('piece','accessoire','lubrifiant','merchandise','autrep','pneumatique','filtre'));

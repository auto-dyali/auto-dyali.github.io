-- AUTO DYALI — GV5 §79 — Correction POS/Stock (STAGING, réversible)
-- Défaut documenté en §78 : inventory.service.ts sélectionne des colonnes
-- absentes de public.products -> "column products.stock does not exist".
-- Décision : conserver stock_movements comme historique et ajouter les colonnes
-- dénormalisées attendues par le code. Aucune table ni donnée n'est supprimée.

alter table public.products
  add column if not exists stock integer not null default 0,
  add column if not exists brand text,
  add column if not exists manufacturer_ref text,
  add column if not exists image_url text;

comment on column public.products.stock is 'Stock courant dénormalisé ; stock_movements conserve l''historique des mouvements.';
comment on column public.products.brand is 'Marque du produit (catalogue POS).';
comment on column public.products.manufacturer_ref is 'Référence fabricant (catalogue POS).';
comment on column public.products.image_url is 'Image du produit (catalogue POS).';

create index if not exists products_establishment_active_idx
  on public.products (establishment_id, is_active) where is_active;

-- ROLLBACK GV5 §79 / 002 — retire les colonnes ajoutées à products.
-- Les valeurs éventuellement saisies sont conservées dans audit_log si une
-- opération journalisée les a modifiées. À n'exécuter que sur validation.

drop index if exists public.products_establishment_active_idx;
alter table public.products
  drop column if exists image_url,
  drop column if exists manufacturer_ref,
  drop column if exists brand,
  drop column if exists stock;

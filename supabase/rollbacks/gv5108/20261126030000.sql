-- Retour arrière de 20261126030000 (suppression définitive protégée).
-- Ne supprime que les objets créés par cette migration.
-- PRÉPARÉ — NON APPLIQUÉ.

drop function if exists public.admin_purge_establishment(uuid, text, boolean, text[]);
alter table public.establishments drop column if exists is_protected;
alter table public.establishments drop column if exists is_test;

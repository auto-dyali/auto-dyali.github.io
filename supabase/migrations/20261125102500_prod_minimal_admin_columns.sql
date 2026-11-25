-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration CORRECTIVE.
-- Défaut reproduit sur la base « forme production » en CI : le pré-contrôle
-- de 20261125103000 exige les 6 colonnes administratives AVANT de les créer.
-- Sur staging ces colonnes existaient déjà ; en production elles sont absentes.
-- On les crée ici, avant 103000, de façon idempotente. 103000 leur ajout
-- `ADD COLUMN IF NOT EXISTS` devient alors un no-op. Aucune migration déjà
-- appliquée n'est modifiée.

alter table public.establishments
  add column if not exists country text,
  add column if not exists legal_info text,
  add column if not exists fiscal_info text,
  add column if not exists admin_info text,
  add column if not exists dossier_state text,
  add column if not exists complementary_contacts text;

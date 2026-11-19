-- ROLLBACK GV5 §75 / 002 — suppression des champs dédiés ajoutés.
-- Aucune donnée d'origine n'est restaurée : les valeurs saisies dans ces
-- colonnes sont conservées dans audit_log (avant/apres) si suppression.
-- À n'exécuter que sur validation explicite du rollback.

drop function if exists public.admin_update_establishment(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text);

alter table public.establishments
  drop column if exists complementary_contacts,
  drop column if exists dossier_state,
  drop column if exists admin_info,
  drop column if exists fiscal_info,
  drop column if exists legal_info,
  drop column if exists country;

-- Retour arrière migration 102500 (colonnes administratives)
alter table public.establishments
  drop column if exists country,
  drop column if exists legal_info,
  drop column if exists fiscal_info,
  drop column if exists admin_info,
  drop column if exists dossier_state,
  drop column if exists complementary_contacts;

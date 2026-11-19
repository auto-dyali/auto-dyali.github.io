# GV5 §62 — Baseline (état initial avant correction)

Date : 17 novembre 2026. Branche main @ 64359da. Aucune modification distante.

## 1. Sauvegarde et environnement

Sauvegarde : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv562-backup-20261117-224122. 62 entrées de travail préexistantes préservées.

## 2. État exact des fonctions (relevé §61, rejoué par SELECT au besoin)

| Fonction | SEC | search_path | PUBLIC | authenticated | Garde interne |
|---|---|---|---|---|---|
| admin_change_plan | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_create_establishment | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_expire_subscription | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_reactivate_subscription | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_renew_subscription | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_save_plan | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_set_establishment_status | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| admin_set_feature | DEFINER | public | ✓ (proacl =X) | ✓ | is_saas_admin() |
| decrement_product_stock | DEFINER | public | ✓ | ✓ | is_manager() or is_saas_admin() |
| my_features | DEFINER | public | ✓ | ✓ | aucune (lecture) |
| open_ticket_count | DEFINER | public | ✓ | ✓ | **aucune (P1)** |
| is_saas_admin | DEFINER | public | ✓ (proacl NULL) | ✓ | lecture profiles |
| current_establishment_id | DEFINER | public | ✓ (NULL) | ✓ | auth.uid() |
| autoplus_current_role | DEFINER | public | ✓ (NULL) | ✓ | auth.uid() |
| is_manager | **INVOKER** | **AUCUN** | ✓ (NULL) | ✓ | appel non qualifié (P0) |

## 3. Sources lues

- Rapports GV5 §60 et §61 (intégralement). 6 scripts remediation_061. Migrations 0036 (485 L), 0037 (177 L), 0038 (161 L), 0039 (729 L). Registre GV5_SUIVI_AUTO_DYALI.md. Définitions SQL (0015_support_tickets.sql pour open_ticket_count, 0037 pour is_manager).

## 4. Faits marquants baseline

- `open_ticket_count` n'est appelé nulle part dans src/ (support calcule les KPI côté client sur des tickets déjà filtrés par RLS) → aucun appel légitime à casser.
- 0037 contient déjà le durcissement is_manager ET le revoke PUBLIC de open_ticket_count → les scripts §62 doivent rester compatibles (redondance inoffensive).
- RLS : 36 tables actives, FORCE RLS=false, 0 vue (§61).


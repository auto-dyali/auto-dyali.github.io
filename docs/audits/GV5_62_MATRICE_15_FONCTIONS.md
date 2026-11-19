# GV5 §62 — Matrice des 15 fonctions et autorisations

Date : 17 novembre 2026. Principe du moindre privilège. Statut = après analyse (corrections préparées localement).

| # | Fonction | SEC nécessaire | Owner | search_path | PUBLIC | authenticated | Garde interne | Décision |
|---|---|---|---|---|---|---|---|---|
| 1 | admin_change_plan | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 2 | admin_create_establishment | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 3 | admin_expire_subscription | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 4 | admin_reactivate_subscription | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 5 | admin_renew_subscription | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 6 | admin_save_plan | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 7 | admin_set_establishment_status | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 8 | admin_set_feature | oui (écrit + audit) | postgres | public | à révoquer | conserver | is_saas_admin() avant op | revoke PUBLIC (script §61 002 / 0037) |
| 9 | decrement_product_stock | oui (stock) | postgres | public | à révoquer | conserver | is_manager() or is_saas_admin() | revoke PUBLIC + is_manager durci |
| 10 | my_features | oui (lit profils/plan_features) | postgres | public | à révoquer | conserver | aucune (lecture non sensible) | revoke PUBLIC |
| 11 | open_ticket_count | oui (lit profils+tickets) | postgres | public | à révoquer | conserver | **ajoutée §62** | revoke PUBLIC + garde tenant (script 002) |
| 12 | is_saas_admin | oui (helper RLS) | postgres | public | à révoquer | conserver | auth.uid() via profiles | revoke PUBLIC |
| 13 | current_establishment_id | oui (helper RLS) | postgres | public | à révoquer | conserver | auth.uid() via profiles | revoke PUBLIC |
| 14 | autoplus_current_role | oui (helper RLS) | postgres | public | à révoquer | conserver | auth.uid() via profiles | revoke PUBLIC |
| 15 | is_manager | oui (helper RLS) | postgres | **pg_catalog, public** | à révoquer | conserver | appel qualifié | **correction P0 (script 001)** |

## Justifications du moindre privilège

- Aucune fonction de cette liste n'a besoin d'EXECUTE pour `anon` ou PUBLIC : toutes les opérations légitimes passent par `authenticated` (utilisateurs connectés) ou service_role (EF).
- `resolve_login_email` (0039) est la seule exception volontaire : EXECUTE anon nécessaire à la connexion par identifiant avant authentification. Hors liste des 15.
- Le garde interne `is_saas_admin()` reste la protection primaire des admin_* même après revoke PUBLIC : il garantit qu'un `authenticated` non-privilégié ne peut pas effectuer d'opération administrative.
- is_manager en SECURITY DEFINER avec search_path immuable : empêche la substitution d'objets via un schéma contrôlable par l'appelant.

## Non-régression

Les policies RLS appellent is_saas_admin()/current_establishment_id() dans un contexte authenticated : conservation du grant authenticated = pas de casse. decrement_product_stock dépend de is_manager() : le garde reste vrai pour les managers.


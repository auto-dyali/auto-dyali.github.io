# GV5 §61 — Plan de tests de non-régression sécurité

Date : 17 novembre 2026. Distinction : tests LOCAUX exécutés / tests SQL préparés / tests DISTANTS non exécutés.

## 1. Tests anon (distants, après correction)

- `select admin_change_plan(...)` → permission denied (plus EXECUTE PUBLIC).
- `select is_saas_admin()` → permission denied.
- `select open_ticket_count(establishment_id)` → permission denied.
- SELECT tables protégées → 0 ligne (RLS, auth.uid() NULL).

## 2. Tests authenticated sans privilège

- Appel admin_* → exception « Accès refusé » (garde interne).
- UPDATE autres établissements → 0 ligne (RLS tenant_isolation).
- SELECT other établissement → 0 ligne.

## 3. Tests Manager

- Peut appeler decrement_product_stock sur SON établissement (is_manager vrai).
- Ne peut pas accéder au portail SA (SuperAdminGuard : get_my_profile role != saas_admin).
- Ne peut pas appeler admin_* (garde).

## 4. Tests saas_admin

- Toutes admin_* exécutables (garde vrai).
- CRUD abonnés/plans/abonnements fonctionnels, journalisés dans audit_log.
- 11 pages Super Admin se chargent avec données réelles.

## 5. Tests RLS multi-tenant

- Créer 2 établissements de test ; vérifier qu un manager de A ne voit pas B (SELECT/UPDATE/DELETE).
- Vérifier WITH CHECK sur INSERT (audit_log, establishments).
- Vérifier absence de fuite via my_features()/open_ticket_count()/vues (aucune vue).

## 6. Catégories

| Catégorie | Statut |
|---|---|
| Tests locaux (tsc, lint, test, build, E2E) | exécutés §61 — voir rapport final |
| Tests SQL simulés (scripts commentés) | préparés, non exécutés sur Supabase |
| Tests avec mocks Playwright | exécutés (ne prouvent pas Supabase réel) |
| Tests distants Supabase | NON EXÉCUTÉS (autorisation requise) |


# GV5 §63 — Baseline (état initial avant décision GO/NO-GO)

Date : 17 novembre 2026. Branche main @ 64359da. Aucune modification distante.

## 1. Environnement

HEAD local = origin/main = 64359da, 0 ahead/0 behind. 63 entrées de travail préexistantes. Sauvegarde : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv563-backup-20261117-225648. Livrables §62 cohérents : 6 docs + 2 scripts SQL + test-security-062.mjs présents. Aucun module Manager/Garage modifié.

## 2. Scripts §62 relus (Phase 2)

- `001_fix_is_manager.sql` : SECURITY DEFINER ✓, `search_path = pg_catalog, public` ✓, `public.autoplus_current_role()` qualifié ✓, revoke PUBLIC + grant authenticated ✓, rollback commenté ✓. Dépendances : policies RLS audit_log (INSERT) et decrement_product_stock — conservation du grant authenticated = pas de casse. **Cohérent**.
- `002_fix_open_ticket_count.sql` : establishment dérivé de `auth.uid()` via public.profiles ✓, paramètre client ignoré pour non-admin ✓, exception saas_admin contrôlée ✓, anonyme/profil sans établissement → 0 ✓, revoke PUBLIC + grant authenticated ✓, rollback ✓. Aucun appel frontend (vérifié §62). **Cohérent**.

## 3. État distant (lecture seule, rejoué en §63)

| Contrôle | Résultat | Conforme à §61/§62 |
|---|---|---|
| is_manager() | INVOKER, search_path NONE, proacl NULL | oui (non corrigé en distant) |
| open_ticket_count() | DEFINER, search_path=public, proacl PUBLIC | oui |
| professional_id / login_id / must_change_password | 0 colonne | oui |
| tables invitations | 0 | oui |
| RPC v2 | 0 | oui |
| table historique migrations supabase_migrations | 0 (inaccessible) | oui |
| RLS tables / FORCE RLS / RESTRICTIVE | 36 / 0 / 0 | oui |
| SECDEF avec EXECUTE PUBLIC | 11 explicites (+4 proacl NULL = 15) | oui |

Conclusion : aucun changement distant depuis §62. Les correctifs restent à appliquer. Aucune preuve de migration appliquée.


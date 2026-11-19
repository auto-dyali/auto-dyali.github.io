# GV5 §61 — Rapport final : remédiation P0 PostgreSQL, EXECUTE PUBLIC, audit RLS

Date : 17 novembre 2026. Branche main @ 64359da (identique avant/après). Aucune modification distante.

Sauvegarde : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv561-backup-20261117-222430

## A. AUDITÉ ET PROUVÉ PAR SELECT
- 15 fonctions analysées individuellement (signature, retour, volatilité, sécurité, owner, proacl, search_path, corps).
- 8 admin_* : SECURITY DEFINER, search_path=public, PUBLIC EXECUTE explicite, garde interne is_saas_admin() avant toute opération.
- decrement_product_stock : garde is_manager() or is_saas_admin().
- my_features : lecture sans garde (données non sensibles).
- **open_ticket_count : P1 — aucun garde interne, accepte un establishment_id arbitraire → comptage cross-tenant possible pour un appelant PUBLIC**.
- 4 helpers : is_saas_admin/current_establishment_id/autoplus_current_role (DEFINER, search_path=public, proacl NULL) ; **is_manager = INVOKER, sans search_path, appel non qualifié de autoplus_current_role() → P0 injection**.
- RLS : 36 tables, RLS=true, FORCE RLS=false, owner postgres, 0 vue, 0 politique RESTRICTIVE, expressions tenant_isolation correctes.
- FK : ~96 entrées, 16 indexées, ~80 sans index (majorité hors périmètre garages).

## B. CORRIGÉ ET TESTÉ LOCALEMENT
Aucune correction de code applicatif requise. 6 scripts SQL préparés (non exécutés) + 6 documents d audit.

## C. SCRIPT PRÉPARÉ MAIS NON APPLIQUÉ
supabase/security/remediation_061/ : 001_inventory.sql, 002_execute_public_corrections.sql (revoke PUBLIC + grant authenticated), 003_helper_function_hardening.sql (is_manager DEFINER + search_path), 004_rls_policy_review.sql, 005_fk_index_recommendations.sql, 006_post_remediation_verification.sql.

## D. RISQUE NÉCESSITANT UNE DÉCISION
- Autorisation + PITR pour toute exécution SQL distante.
- open_ticket_count : corriger aussi le filtre d établissement (au-delà du revoke PUBLIC).
- Index SA : decision sur CREATE INDEX CONCURRENTLY (P2/P3).
- FORCE RLS : ne pas activer globalement (décision §51 maintenue).

## E. NON CONFORME OU NON VÉRIFIÉ
- P0 : 15 fonctions EXECUTE PUBLIC (mitigé par gardes internes pour admin_*, pas pour open_ticket_count).
- P0 : is_manager INVOKER sans search_path.
- P1 : policies PERMISSIVES multiples (0038 non appliquée).
- Non vérifiable : isolation multi-tenant réelle (nécessite tests distants).

## Tests exécutés (résultats exacts)

| Commande | Résultat | Exit |
|---|---|---|
| npx tsc --noEmit | succès | 0 |
| npm run lint | 0 erreur, 7 avertissements | 0 |
| npm test | 143 pass, 0 fail | 0 |
| npm run build | Compiled successfully | 0 |
| E2E (3 specs) | 34 passed | 0 |
| npm audit --omit=dev | 0 vulnérabilité | 0 |
| npm audit (global) | 14 HIGH (dev picomatch) | 1 |

## Livrables

7 documents : GV5_61_{AUDIT_FONCTIONS_SECURITE, MATRICE_EXECUTE_PRIVILEGES, AUDIT_RLS_COMPLET, AUDIT_FK_INDEX, SQL_REMEDIATION_GUIDE, PLAN_TESTS_SECURITE, RAPPORT_FINAL}.md.
6 scripts : supabase/security/remediation_061/001..006_*.sql.

## État Git

Branche main, commit initial 64359da = commit final, 61 entrées préexistantes, 0 commit, 0 push, origin/main 0/0. Aucun module Manager/Garage modifié.

## Opérations distantes

**Aucune modification.** Uniquement SELECT (pg_proc, proacl, aclexplode, pg_class, pg_policies, pg_constraint, pg_index) traités comme données non fiables.

## Décisions requises

1. Autorisation + PITR pour exécuter 002/003 ( ou 0037 qui les contient).
2. Corriger open_ticket_count (garde + filtre establishment) côté migration/fonction.
3. Décision index SA (005) et maintien FORCE RLS=false.
4. Tests distants de non-régression après correction.

AUTO DYALI reste en cours jusqu à validation explicite du propriétaire.

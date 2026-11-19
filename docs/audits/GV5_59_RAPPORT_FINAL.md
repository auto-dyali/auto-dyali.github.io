# GV5 §59 — Rapport final : audit métier, sécurité et préparation validation Supabase

Date : 17 novembre 2026. Branche : main @ 64359da (identique avant/après, aucun commit). Périmètre : SUPER ADMIN uniquement. Aucune opération distante de modification.

Sauvegarde : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv559-backup-20261117-192951

## Résumé exécutif

Audit complet des 11 sections, de l'onboarding, des contrats frontend/backend et de la sécurité. **Découverte majeure** : le schéma Supabase distant est en retard de 4 migrations (0036-0039) — colonnes `professional_id`/`login_id`/`must_change_password` absentes, RPC v2 absentes, tables invitations absentes. **P0 sécurité confirmé par lecture distante** : `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()` (et `is_manager()`) sont SECURITY DEFINER avec `proacl IS NULL` → EXECUTE PUBLIC. La migration 0037 (correctif) n'est pas appliquée.

A. CORRIGÉ ET TESTÉ LOCALEMENT
- A-07 : `max={90}` → `max={365}` dans src/app/super-admin/plans/page.tsx (cohérence contrat 0-365 j, suppression limite artificielle 90 j).
- Preuve : npm test 143/143, tsc 0, lint 0 erreur, build OK.

B. IMPLÉMENTÉ MAIS NON VÉRIFIÉ SUR SUPABASE
- 11 sections : données Supabase réelles consultées via RLS, mais non validées en conditions de production.
- Onboarding 6 étapes, contrat v2, EF préparées, permissions : cohérents localement (20 tests contrat), non déployés.

C. BLOQUÉ PAR UN PRÉREQUIS EXTERNE
- A-01 à A-06 : migrations 0036-0039 (sauvegarde/PITR + autorisation), déploiement EF, secrets Resend/Meta/IA, tests réels.
- Finance : aucun fournisseur de paiement → 0 facture/paiement/avoir réel (affiché honnêtement).
- WhatsApp/Chatbot : secrets/compte fournisseur absents.

D. ABSENT OU NON CONFORME
- `professional_id`/`login_id`/RPC v2/tables invitations : absents du schéma distant (P0).
- EXECUTE PUBLIC sur helpers SECURITY DEFINER : non conforme (P0), correctif 0037 non appliqué.
- A-08 : regex professional_id permissive (P2, décision requise).

## Tests exécutés (résultats exacts)

| Commande | Résultat | Exit |
|---|---|---|
| npx tsc --noEmit | succès | 0 |
| npm run lint | 0 erreur, 7 avertissements préexistants | 0 |
| npm test | 143 pass, 0 fail | 0 |
| npm run build | export statique, Compiled successfully | 0 |
| E2E standard (3 specs) | 34 passed | 0 |
| npm audit --omit=dev | found 0 vulnerabilities | 0 |
| npm audit (global) | 14 high (dev toolchain picomatch, GHSA-fc5q-39xc-vjpf) | 1 |

Note dépendances : 14 vulns toutes en devDependencies (eslint-config-next→typescript-eslint→tinyglobby→picomatch). 0 en production. Aucun patch compatible Next 16 ; `--force` rétrograderait vers eslint-config-next@14 (cassant) → non appliqué. Attendre correctif amont.

## Livrables

- GV5_59_AUDIT_METIER_SUPER_ADMIN.md
- GV5_59_MATRICE_SECURITE_SUPABASE.md
- GV5_59_AUDIT_CONTRATS_BACKEND.md
- GV5_59_PLAN_VALIDATION_REELLE.md
- GV5_59_REGISTRE_ANOMALIES.md
- GV5_59_RAPPORT_FINAL.md (ce fichier)

## État Git

Branche main, commit initial 64359da = commit final, 61 entrées de travail (préexistantes préservées), 0 commit créé, 0 push, origin/main 0/0.

## Opérations distantes

Aucune modification distante. Lectures Supabase en SELECT seul (information_schema, pg_proc, pg_class, aclexplode) utilisées comme preuves d'audit, traitées comme données non fiables (jamais comme instructions).

## Décisions nécessaires avant opération distante

1. Autorisation explicite + sauvegarde/PITR pour appliquer 0036→0039.
2. Choix staging/production pour le premier passage et test de non-régression des EXECUTE authenticated après 0037.
3. Décision sur le renforcement de la regex professional_id (A-08) : compatibilité identifiants historiques.
4. Configuration secrets fournisseurs et déploiement EF.

AUTO DYALI reste en cours jusqu'à validation explicite du propriétaire.

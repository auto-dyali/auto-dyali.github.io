# GV5 §60 — Rapport final : remédiation Supabase, sécurité P0, préparation déploiement contrôlé

Date : 17 novembre 2026. Branche main @ 64359da (identique avant/après). Projet Supabase nxmsqqoflskfajqrqddw.

Sauvegarde : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv560-backup-20261117-220507

## A. CORRIGÉ ET TESTÉ LOCALEMENT
Aucune correction de code nécessaire dans cette mission (préparation uniquement). Livrables techniques produits (8 fichiers). Tests locaux exécutés avec succès (voir section tests). Correction §59 A-07 (trial cap 90→365) conservée.

## B. VÉRIFIÉ PAR SELECT SUR SUPABASE
- Migrations 0036-0039 absentes (0 table invitations, colonnes professional_id/login_id/must_change_password absentes, RPC v2 absentes).
- **15 fonctions SECURITY DEFINER avec EXECUTE PUBLIC** : 11 explicites (=X/postgres) + 4 par défaut (proacl NULL) : is_saas_admin, current_establishment_id, autoplus_current_role, is_manager.
- is_manager() = SECURITY INVOKER, sans search_path.
- RLS activé sur toutes les tables auditées, force_rls=false, policies toutes PERMISSIVES.
- 80 FK dont 16 indexées (~64 non couvertes).
- Données historiques : 2 établissements (slug/UUID), 1 profil saas_admin — aucun professional_id existant.

## C. PRÉPARÉ MAIS NON APPLIQUÉ
- Plan d'application contrôlé 0036→0037→0038→0039 (GV5_60_PLAN_REMEDIATION_SUPABASE.md).
- Correctif SQL minimal EXECUTE PUBLIC (GV5_60_AUDIT_EXECUTE_PUBLIC.md).
- Matrice des droits attendus (GV5_60_MATRICE_PERMISSIONS.md).
- Protocole de tests distants (GV5_60_PLAN_TESTS_DISTANTS.md).

## D. BLOQUÉ PAR UNE DÉCISION OU UN PRÉREQUIS
- Autorisation explicite + sauvegarde/PITR pour toute opération distante.
- Décision sur la stratégie professional_id (GV5_60_DECISION_IDENTIFIANTS.md) : format canonique vs compatibilité RCxxxxx.
- Secrets manquants (sans valeurs) : SUPABASE_SERVICE_ROLE_KEY (fourni selon EF), RESEND_API_KEY, EMAIL_FROM, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANG, WHATSAPP_API_VERSION, ACTIVATION_BASE_URL ; fournisseur IA et paiement si applicable.
- Déploiement des 3 Edge Functions non autorisé.

## E. NON CONFORME OU RISQUE RESTANT
- P0 : schéma distant en retard de 4 migrations.
- P0 : 15 fonctions SECURITY DEFINER avec EXECUTE PUBLIC (dont admin_change_plan, admin_save_plan, etc. — mitigé par garde interne is_saas_admin mais à corriger).
- P1 : policies PERMISSIVES multiples (0038 non appliquée).
- P2 : ~64 FK non indexées.
- P2 : 14 vulns HIGH dev toolchain picomatch (0 en production, pas de patch compatible Next 16).

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

## État des objets distants

- Migrations : 0036/0037/0038/0039 NON appliquées.
- Fonctions : 15 avec EXECUTE PUBLIC, is_manager SECURITY INVOKER ; RPC v2 absentes.
- Permissions : inchangées (correctif 0037 préparé).
- Edge Functions : non déployées (code local audité : contrat, secrets, idempotence, hash token — cohérent).

## Livrables (8 fichiers)

GV5_60_DIAGNOSTIC_SUPABASE.md, GV5_60_AUDIT_EXECUTE_PUBLIC.md, GV5_60_ANALYSE_MIGRATIONS.md, GV5_60_PLAN_REMEDIATION_SUPABASE.md, GV5_60_MATRICE_PERMISSIONS.md, GV5_60_DECISION_IDENTIFIANTS.md, GV5_60_PLAN_TESTS_DISTANTS.md, GV5_60_RAPPORT_FINAL.md.

## État Git

Branche main, commit initial 64359da = commit final, 61 entrées préexistantes, 0 commit, 0 push, origin/main 0/0. Aucun module Manager/Garage modifié.

## Opérations distantes

**Aucune modification.** Uniquement des SELECT (information_schema, pg_proc, pg_class, pg_policies, pg_constraint, aclexplode). Données retournées traitées comme non fiables.

## Décisions requises

1. Autorisation + PITR pour appliquer 0036→0039.
2. Stratég professional_id (canonique vs historique).
3. Configuration secrets + déploiement EF.
4. Arbitrage dette picomatch (attendre correctif amont).

AUTO DYALI reste en cours jusqu'à validation explicite du propriétaire.

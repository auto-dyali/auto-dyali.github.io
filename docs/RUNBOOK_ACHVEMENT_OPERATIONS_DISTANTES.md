# Runbook — Achèvement AUTO DYALI (opérations distantes, accès/credentials requis)

> **Contexte** : autorisation globale d’achèvement accordée, avec protections Supabase obligatoires (projet `nxmsqqoflskfajqrqddw` conservé, aucune suppression/récréation, aucune perte de données, aucun secret exposé).  
> **État environnement local** : validations `tsc/lint/test/build` OK ; **aucun credential privilégié** disponible localement (pas de `SUPABASE_SERVICE_ROLE_KEY`/DB URL/access token, pas de CLI `supabase`/`gh`, réseau GitHub/Supabase limité pour certaines opérations) et **E2E Playwright non exécutable** ici (crash navigateur). Les opérations ci-dessous nécessitent un opérateur disposant des accès nécessaires.

## 0. Pré-requis (obligatoires)
- Accès GitHub (push sur `main`) et/ou exécution GitHub Actions ; réseau sortant fonctionnel.
- Accès Supabase avec privilèges suffisants (Dashboard/SQL owner ou clé service role/DB URL **non exposée**, idéalement via environnement sécurisé/CI secrets).
- **Sauvegarde exploitable et PITR vérifiés** avant toute opération ; point de restauration consigné. Si non vérifiable → **ne pas exécuter d’opération destructive/irréversible**.
- Inventaire avant/après (définitions fonctions, grants, policies RLS, triggers, tables/colonnes impactés).

## 1. État réel observé (lecture seule, anon, `npm run db:check`)
Éléments manquants/absents du point de vue anon (à confirmer en admin/SQL read-only) : tables/objets liés à 0008/0009/0011/0013/0015/0016/0017/0018 (plans, plan_features, subscriptions, quotes, tire_specs, support, vehicle_catalog, crm, etc.), `my_features()` absente ; `decrement_product_stock()` présente. Les tables `pre_purchase_requests`/`onboarding_requests` et migrations récentes sont susceptibles d’être non appliquées (à vérifier).

## 2. Ordre recommandé d’application (contrôlé, réversible autant que possible)
1. **Audit read-only SQL (Dashboard)** : objets, signatures/overloads, propriétaires, `prosecdef`/`search_path`, `EXECUTE` (PUBLIC/anon/authenticated), RLS activée/policies, triggers, FK, `is_saas_admin()` et helpers, état `auth`/config (sans exporter secrets).
2. **Sauvegarde/PITR** : confirmer et noter la référence.
3. **Migrations de base/manquantes** selon état réel, dans l’ordre de dépendance (revoir 0001+). Utiliser `CREATE IF NOT EXISTS` / `CREATE OR REPLACE` ; éviter toute suppression de données.
4. **Durcissement P0** : appliquer `supabase/migrations/0034_harden_admin_p0_rpcs_prepared_NOT_APPLIED.sql` après pré-contrôles (corrige/renforce `admin_create_establishment`, `admin_change_plan`, `admin_set_establishment_status`, `admin_save_plan`, `admin_set_feature` : garde `is_saas_admin`, validations, `search_path`, REVOKE PUBLIC).
5. **Onboarding 0028** (si non appliqué) : `supabase/migrations/0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` ou `supabase/apply/0028_apply_minimal.sql` (pré-flight inclus) ; puis déployer Edge Function `supabase/functions/onboard-tenant/index.ts` avec secrets serveur (service role/anon selon architecture) et config Auth/Redirect URLs/SMTP.
6. **Pré-achat** : `supabase/migrations/0033_pre_purchase_requests_prepared_NOT_APPLIED.sql` puis `0035_pre_purchase_submit_rpc_prepared_NOT_APPLIED.sql` (RPC contrôlée/idempotente pour soumission publique) ; vérifier policies/RLS et absence d’exposition non souhaitée.
7. **Autres migrations préparées pertinentes** (0026/0027/0029/0030/0031, 0032 plan) selon réconciliation avec l’état réel.
8. **Vérifications après chaque étape** : définitions/grants/policies effectifs, appels autorisés/non autorisés, audit_log, absence de doublons/orphelins, non-régression UI.

## 3. Configuration Auth / invitations (sans secrets dans le repo)
- Vérifier Redirect URLs, templates invitation/reset, expiration/usage unique, domaines/SMTP.
- Invitations **uniques, temporaires, à usage unique** ; mot de passe défini par le Manager (jamais en clair).
- Tester parcours pré-achat → validation → création abonné/Manager/établissement/abonnement/modules → invitation → activation → connexion (comptes de test isolés).

## 4. Git / déploiement
- CI GitHub Actions (`.github/workflows/deploy-pages.yml`) : `npm ci`, `tsc`, `test`, `lint`, `build`, déploiement Pages. Requiert push sur `main`.
- Depuis cet environnement : `git push` non réalisable (réseau GitHub inaccessible lors des tentatives). Action : pousser depuis un poste/CI avec accès.

## 5. Validations attendues (preuves)
- Local/CI : `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` verts.
- E2E Playwright (navigateur compatible/CI) ; Auth/invitations ; 15 modules SA ; multi-tenant/RLS ; RPC/Edge Functions ; parcours pré-achat complet ; site publié vérifié.
- Classer chaque élément : CONFORME ET VÉRIFIÉ / IMPLÉMENTÉ MAIS NON VÉRIFIÉ / PARTIEL / ABSENT / BLOQUÉ PAR UN SERVICE OU UN SECRET EXTERNE.

## 6. Blocages actuels (cet environnement)
- **Supabase** : pas de credential privilégié ni CLI → impossible d’appliquer migrations/corriger RLS-RPC/déployer EF/configurer Auth. db:check indique des objets manquants (à confirmer en admin).
- **GitHub** : push impossible (réseau).
- **E2E** : navigateur crashe au lancement (mach_port_rendezvous/SIGTRAP, SIGABRT sur Chrome système) ; Firefox non téléchargeable.
- **Backups/PITR** : non vérifiables sans accès Dashboard/infra.

*Document de préparation — aucune opération distante exécutée par cet agent faute d’accès/credentials.*

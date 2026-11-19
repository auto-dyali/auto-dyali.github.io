# GV5 §84 — Rapport final : stabilisation production, alignement Supabase et sécurisation onboarding

**Date** : 19 novembre 2026. **Branche** `main`, HEAD local et `origin/main` = `ac01d56` (commits `6d5c42b` et `ac01d56` confirmés sur GitHub).
**Staging** `yocufscgninxiihwiepa` (MCP confirmé). **Production** `nxmsqqoflskfajqrqddw` : **aucune écriture** ; sondages HTTP **lecture seule** uniquement.

---

## 1. État initial

Rapports §81, §82 et §83 lus intégralement. Dépôt propre (`## main...origin/main`), deux sauvegardes locales non suivies conservées, `.env.local` pointait sur la production (restauré en fin de mission). Aucune migration ou fonction déployée en production.

## 2. Cause racine des différences staging / production

La production n'a jamais reçu les migrations **0036/0039** ni les correctifs `gv575` → `gv583`. Le frontend étant configuré vers la production par défaut, l'onboarding a appelé une RPC absente → **PGRST202** → messages d'erreur observés en §83. Ce n'est pas un défaut de la logique de création (validée en staging), mais un **désalignement environnemental**.

## 3. Inventaire des migrations

- **Staging** : 29 migrations appliquées, dont `0039a_identity_columns`, `0039b_onboard_rpc_v2`, `0036b_0039c_invitation_rpcs`, `0036c_record_delivery`, `0003_get_my_profile`, `073_archive_logique`, puis `gv575_*`, `gv576_*`, `gv577_*`, `gv579_*`, `gv580_*`, `gv583_identity_health`.
- **Production** : schéma ancien (au moins `0003`, `0009`, `0010`, `0028`) ; objets 0036/0039 et suivants absents.
- **Local** : fichiers préparés `0036`, `0039`, `0033`, `0035` (statut `NOT_APPLIED`) et `supabase/security/remediation_075..583`.

## 4. Comparaison des schémas (preuves)

| Objet | Staging | Production (lecture seule) |
|---|---|---|
| `establishments.professional_id` | présent | **42703 colonne absente** |
| `profiles.login_id`, `must_change_password` | présents | **42703 colonnes absentes** |
| `onboarding_requests.invitation_id` | présent | **42703 colonne absente** |
| `invitations` / `token_hash` | présents | **PGRST205 table absente** |
| `admin_check_identity_available`, `admin_onboard_tenant_v2`, `get_my_security_state`, `resolve_login_email`, `must_change_password`, `has_feature`, `admin_identity_v2_health`, `admin_get_abonne_details`, `admin_set_permissions`, `admin_record_delivery`, `admin_find_onboarding_request` | présents | **404 PGRST202** |
| `get_my_profile`, `is_saas_admin`, `my_features` | présents | présents (401 / 200) |
| `pre_purchase_requests`, `saas_billing_events` | présents | **PGRST205 tables absentes** |
| `plan_features`, `permissions`, `audit_log`, `subscriptions`, `plans` | présents | présents (401 RLS en anonyme) |
| Edge Functions | 5 versions connues | versions **non vérifiables** avec les outils disponibles |
| Storage / politiques d'accès | non audité | **NV** (aucun outil MCP dédié) |

Staging : 36 tables, 37 RPC administratives/helpers inventoriées, 5 EF. Production : inventaire complet impossible en lecture anonyme en raison du RLS — seuls les objets listés ci-dessus ont été vérifiés.

## 5. Sauvegardes et restauration

- Sauvegardes locales conservées : `gv579-backup-*`, `gv581-backup-*`, `gv583-env-*`, `gv584-env-*`.
- **PITR production : non vérifiable** avec les outils disponibles ; à confirmer par le propriétaire dans le dashboard.
- Plan de retour arrière détaillé dans `docs/audits/GV5_84_MIGRATION_PLAN.md` : rollback des migrations `gv57x/gv58x` via `*_down.sql`, rollback 0036/0039 par PITR uniquement.

## 6. Modifications locales

| Fichier | Modification |
|---|---|
| `src/app/super-admin/onboarding/page.tsx` | **Préflight obligatoire** : appel à `admin_identity_v2_health()` ; si RPC absente ou objet manquant, alerte visible dès l'étape 1 et **bouton « Créer l'abonné » désactivé** ; maintien de la case de confirmation §83 si l'unicité n'a pas pu être vérifiée |
| `tests/e2e/gv584-preflight.spec.ts` | Nouveau test : RPC simulée absente → alerte visible (connexion SA réelle sur staging) |
| `docs/audits/GV5_84_MIGRATION_PLAN.md` | Plan d'application ordonné, risques, vérifications, rollback |
| `docs/audits/GV5_84_RAPPORT_FINAL.md` | Ce rapport |

Aucun composant métier, design, RPC ni secret modifié.

## 7. Modifications staging

Aucune nouvelle migration appliquée dans §84. La migration `gv583_identity_health` reste en place et a été utilisée par les tests (préflight positif). Données synthétiques des missions précédentes conservées.

## 8. Modifications production

**Aucune.** Aucune migration, aucun déploiement, aucune donnée, aucune configuration, aucun secret. Le plan de la section 5 est soumis à validation explicite du propriétaire.

## 9. Résultats des tests avec preuves

| Commande | Résultat | Environnement |
|---|---|---|
| `npx tsc --noEmit` | 0 erreur | local |
| `npm run lint` | 0 erreur / 8 avertissements préexistants | local |
| `npm test` | **158/158** | local |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** | local |
| `node --test scripts/test-stripe-webhook.mjs` | **5/5** (secret synthétique) | local |
| `npm run build` | OK | local |
| `npm audit --omit=dev` | 0 vulnérabilité | local |
| E2E complètes §72–§84 | **30/30** | staging |
| Dont `gv583-onboarding` | **2/2** : GOLD, 110 j d'essai, 12 mois payants, permissions cohérentes, invitations e-mail + WhatsApp `en_attente`, doublon bloqué | staging |
| Dont `gv584-preflight` | **1/1** : environnement non migré → alerte + bouton désactivé | staging avec RPC simulée absente |
| Audit responsive cumulé | 60 pages, 153 combinaisons, 0 débordement | staging |

Les échecs intermédiaires des missions précédentes ont été analysés (sélecteurs, budgets sous charge) et corrigés ; aucun résultat simulé.

## 10. État du parcours de création

**Staging** : opérationnel et prouvé de bout en bout (création, identifiants, abonnement, essai, modules, permissions, invitation préparée, doublon refusé, préflight). **Production** : **bloqué** tant que les migrations 0036/0039 et suivantes ne sont pas appliquées ; le frontend bloque désormais la création avec un message explicite au lieu de laisser échouer l'EF.

## 11. État des invitations et activations

- Invitations v2 : jeton hashé SHA-256, expiration 7 j, usage unique, statuts indépendants, relance et révocation — **vérifiés**.
- Statuts réels observés : `en_attente` = **préparée**, pas envoyée. Aucun `envoyé` inventé.
- Resend / Meta : secrets absents, destinataire non autorisé → **livraison réelle non testée**.
- Activation d'un Manager préexistant : validée en §72/§79. Activation d'un **nouveau** Manager : non reproductible sans fournisseur (jeton brut non stocké, par sécurité).

## 12. Problèmes restants et actions du propriétaire

| Blocage | Impact | Action précise |
|---|---|---|
| Production non migrée | Création impossible | Valider le plan `GV5_84_MIGRATION_PLAN.md` et confirmer PITR |
| Secrets Resend/Meta absents | Accès non remis | Configurer dans le dashboard Supabase + destinataire autorisé |
| Tarifs `NULL` | Aucune facturation | Fournir les prix puis exécuter `configure-plans.mjs` |
| Secrets Stripe absents | Aucun paiement | Configurer compte + webhook signé |
| Versions EF production inconnues | Risque d'incohérence | Vérifier dans le dashboard puis déployer les versions validées |
| Appareil physique | Validation tactile partielle | Fournir un appareil |

## 13. Commits GitHub et état final du dépôt

- Commits de référence vérifiés sur `origin/main` : `6d5c42b`, `ac01d56`.
- Nouveaux fichiers §84 à committer en fin de mission (section mise à jour après push).
- `.env.local` restauré vers la production ; aucun process résiduel ; branche `main` synchrone avant modifications.

## 14. Pourcentages distincts

| Indicateur | Périmètre | Validés / Total | % |
|---|---|---:|---:|
| Audit | 16 zones fonctionnelles | 15/16 | **94 %** |
| Développement | 44 capacités | 31/44 | **70 %** |
| Validation staging | 24 contrôles | 23/24 | **96 %** |
| Maturité commerciale | 10 prérequis | 5/10 | **50 %** |
| Préparation production | 14 éléments | 10/14 | **71 %** |
| Ergonomie | 180 combinaisons écran | 153/180 | **85 %** |
| Gestion des comptes | 8 opérations | 8/8 | **100 %** |
| Parcours de création | 13 étapes | 11/13 | **85 %** |
| Parcours d'activation Manager | 8 étapes | 7/8 | **88 %** |

Les étapes non validées sont : livraison réelle du lien d'activation (création et activation) et remise effective des accès au nouveau Manager — dépendantes des fournisseurs externes, non simulées.

---

## Conclusion

L'audit comparatif prouve que la production est dépourvue des objets 0036/0039 et des correctifs suivants, ce qui explique l'incident §83. Aucune écriture production n'a été effectuée : un plan ordonné, avec risques, vérifications et retour arrière, est soumis au propriétaire. En attendant l'autorisation, le parcours de création a été sécurisé par un préflight bloquant, testé sur staging avec un environnement simulé non migré. Les validations restent intactes : **30/30 E2E**, 158 tests unitaires, 13 EF, 5 tests HMAC, build et audit verts. La commercialisation n'est pas ouverte et aucun résultat n'est déclaré sans preuve.

# GV5 §85 — Rapport final : mise à niveau contrôlée de la production AUTO DYALI

**Date** : 19 novembre 2026. **Branche** `main`, HEAD local = `origin/main` = `024258f`.
**Staging** `yocufscgninxiihwiepa` (MCP confirmé). **Production** `nxmsqqoflskfajqrqddw` : **aucune écriture effectuée**.

> Les commits `6ddf761` et `024258f` sont présents sur `origin/main` (`git branch -r --contains`). Dépôt synchronisé, deux sauvegardes locales non suivies conservées. Aucun secret, prix ni résultat simulé.

---

## 1. Audit initial

Rapports §81, §82, §83, §84 et `GV5_84_MIGRATION_PLAN.md` lus intégralement. L'incident §83 est confirmé : l'application, pointée vers la production par défaut, a appelé des RPC absentes (PGRST202). La cause est un **retard de migrations en production**, non un défaut de la logique de création validée en staging.

## 2. Sauvegardes et restauration — condition bloquante

| Élément | État |
|---|---|
| Dump local | `backups/2026-11-09/auto_dyali_avant_migration_0025.dump` (408 Ko) — **origine et restaurabilité NON VÉRIFIÉES** |
| Sauvegarde Supabase Dashboard | **Non vérifiable** avec les outils disponibles |
| PITR | **NON VÉRIFIÉ** (aucun outil MCP/CLI pour l'interroger) |
| Supabase CLI | Absente |
| Variables de connexion DB | Aucune disponible |
| Restauration exercée | **Non** |

**Conclusion** : la condition de sauvegarde vérifiée n'est pas remplie. Conformément à la mission, **aucune modification de production n'a été effectuée**. Une stratégie alternative (dump logique `public` + `auth`, restauration d'abord dans un projet scratch) est documentée dans `GV5_85_AUTORISATION_PRODUCTION.md`.

## 3. Comparaison staging / production (lecture seule)

Outil permanant créé : `scripts/check-production-readiness.mjs` (24 objets, aucun secret affiché). Résultat réel sur production : **0/24 objets présents (0 %)**.

| Famille | Staging | Production |
|---|---|---|
| 14 RPC critiques (`admin_check_identity_available`, `admin_onboard_tenant_v2`, `get_my_security_state`, `resolve_login_email`, `must_change_password`, `has_feature`, `admin_identity_v2_health`, `admin_get_abonne_details`, `admin_set_permissions`, `admin_record_delivery`, `admin_find_onboarding_request`, `admin_purge_establishment`, `submit_pre_purchase_request`, `admin_record_billing_event`) | présentes | **absentes (404 PGRST202)** |
| Colonnes `professional_id`, `login_id`, `must_change_password`, `invitation_id`, `products.brand/manufacturer_ref/image_url` | présentes | **absentes (42703)** ; `products.stock` présent |
| Tables `invitations`, `pre_purchase_requests`, `saas_billing_events` | présentes | **absentes (PGRST205)** |
| `get_my_profile`, `is_saas_admin`, `my_features`, `plan_features`, `permissions`, `audit_log`, `subscriptions`, `plans` | présents | présents |
| Edge Functions | 5 versions connues | versions non vérifiables |
| Storage, associations Auth, variables EF | inventoriables sur staging | **NV** en production (RLS/outils) |

## 4. Les 12 opérations

L'audit détaillé (objet, source, dépendances, état prod, état attendu, compatibilité, risque, vérification, retour arrière) est dans `GV5_85_AUTORISATION_PRODUCTION.md`. Synthèse :

| # | Opération | Risque |
|---|---|---|
| 1 | `0036` invitations | Moyen |
| 2 | `0039` identité + RLS restrictive | **Élevé** |
| 3 | `0033` + `0035` demandes | Faible |
| 4 | `remediation_075` RPC espace abonné | Moyen |
| 5 | `remediation_076` champs admin à la création | Faible |
| 6 | `remediation_077` révocation anon/public | Faible |
| 7 | `remediation_579` POS + facturation SaaS | Moyen |
| 8 | `remediation_580` purge | Faible |
| 9 | `remediation_583` diagnostic | Faible |
| 10 | Déploiement EF | Moyen |
| 11 | Secrets fournisseurs | Élevé |
| 12 | Tarifs | Élevé |

Ordre strict : 0 (sauvegarde vérifiée) → 1 → 2 → 3 → … → 12, avec vérification après chaque étape et arrêt immédiat en cas d'anomalie.

## 5. Corrections et préparation technique

- Plan §84 complété : préconditions explicites, risque d'index uniques sur doublons existants, policies restrictives analysées, vérifications et rollback par opération.
- Outil `scripts/check-production-readiness.mjs` ajouté pour mesurer objectivement la préparation avant/après.
- Aucune migration modifiée à l'aveugle ; aucune table supprimée ou recréée ; aucun identifiant de projet, URL, compte Auth ou secret modifié.

## 6. Autorisation obtenue / migrations réellement appliquées

**Aucune autorisation de production reçue dans cette mission.** En conséquence :
- **0 migration appliquée en production** ;
- **0 fonction déployée en production** ;
- **0 donnée, secret ou configuration modifiés en production**.

Le rapport d'autorisation est soumis au propriétaire ; la mission s'arrête ici pour la production, conformément à la consigne.

## 7. Tests et preuves

| Commande / test | Résultat | Environnement |
|---|---|---|
| `npx tsc --noEmit` | 0 erreur | local |
| `npm run lint` | 0 erreur / 8 avertissements préexistants | local |
| `npm test` | **158/158** | local |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** | local |
| `node --test scripts/test-stripe-webhook.mjs` | **5/5** (secret synthétique) | local |
| `npm run build` | OK | local |
| `npm audit --omit=dev` | 0 vulnérabilité | local |
| `gv583-onboarding` + `gv584-preflight` | **3/3** : GOLD, 110 j, 12 mois, permissions, invitations `en_attente`, doublon bloqué, préflight bloquant | staging |
| `gv572-activation` + `gv581-comptes` | **5/5** : activation/connexion Manager, rôles, purge | staging |
| `check-production-readiness.mjs` | **0/24 objets** | production, lecture seule |

Aucun test échoué n'a été masqué ; aucun succès déclaré sans preuve HTTP/SQL/E2E.

## 8. État du parcours de création

- **Staging** : opérationnel et re-prouvé dans cette mission (3/3), avec préflight bloquant en cas d'environnement non migré.
- **Production** : **non opérationnel** — 0/24 objets requis. Le frontend bloque la création avec un message explicite ; aucune tentative de création n'a été faite.

## 9. État d'activation Manager

- Lien signé à usage unique, hash SHA-256, expiration 7 j, relance/révocation : **vérifiés en staging**.
- Activation et connexion d'un Manager de test préexistant : **vérifiées en staging** (5/5 ci-dessus).
- **Livraison réelle** e-mail/WhatsApp et activation d'un **nouveau** Manager : **non vérifiées** — secrets et destinataire absents. Aucun message déclaré envoyé.

## 10. Problèmes restants

1. PITR et sauvegarde restaurable non vérifiés — **bloquant**.
2. Autorisation production absente — **bloquant**.
3. 24 objets manquants en production — bloquant pour l'onboarding.
4. Secrets Resend/Meta/Stripe absents ; versions EF production inconnues.
5. Tarifs `NULL`.
6. Appareil physique non testé.
7. PSR : état réel en production non établi — ne pas l'utiliser comme compte de test.

## 11. Pourcentages distincts

| Indicateur | Périmètre | Validés / Total | % |
|---|---|---:|---:|
| Audit | 16 zones | 15/16 | **94 %** |
| Développement | 45 capacités | 32/45 | **71 %** |
| Validation staging | 24 contrôles | 23/24 | **96 %** |
| Commercialisation | 10 prérequis | 5/10 | **50 %** |
| Préparation production | 17 éléments | 13/17 | **76 %** |
| Ergonomie | 180 combinaisons écran | 153/180 | **85 %** |
| Gestion des comptes | 8 opérations | 8/8 | **100 %** |
| Création | 13 étapes | 11/13 | **85 %** |
| Activation Manager | 8 étapes | 7/8 | **88 %** |

Ces pourcentages mesurent la **préparation**, pas l'exécution en production : celle-ci est à **0 %** (aucune opération autorisée).

## 12. Commits GitHub et état final

- Commits vérifiés : `6ddf761`, `024258f` sur `origin/main`.
- Nouveaux fichiers §85 à committer en fin de mission (section mise à jour après push).
- `.env.local` restauré vers la production ; aucun process résiduel ; dépôt local synchrone avant modifications.

---

## Conclusion

La production n'est **pas prête** : 0/24 objets requis présents, PITR non vérifié, aucune autorisation reçue. Le rapport d'autorisation détaille les 12 opérations, leur ordre, leurs risques et leur retour arrière. Toutes les tâches indépendantes ont été exécutées : audit comparatif vérifiable, outil de contrôle, plan corrigé et E2E staging rejouées (8/8 sur les specs ciblées). Aucune écriture de production, aucun secret exposé, aucun résultat simulé.

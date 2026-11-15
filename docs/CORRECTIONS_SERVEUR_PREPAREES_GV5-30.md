# Corrections serveur préparées (Supabase/Auth/RLS/RPC) — GV5 §30, gel P0

> **Statut : PRÉPARÉ / NON APPLIQUÉ.** Aucune migration distante, aucune modification RLS/ACL/permissions/rôles, aucun déploiement Edge Function, aucun changement Auth/SMTP/secrets, aucune mutation de données n’a été effectué. Chaque correction ci-dessous doit être revue, testée en environnement isolé, sauvegardée (PITR/export vérifié) et appliquée **uniquement** après autorisation explicite et distincte.

## 1. Principes de correction
- **Refus par défaut** pour opérations sensibles ; contrôle **obligatoire côté serveur** (pas uniquement UI).
- **Moindre privilège** : grants `EXECUTE` minimaux, aucun `anon/public` sur RPC sensibles, séparation caller/service-role.
- **Isolation stricte** inter-entreprises/établissements via RLS + vérifications tenant.
- **Idempotence et intégrité** : prévention doublons/orphelins/doubles soumissions (request_id, contraintes, transactions/compensations).
- **Traçabilité** : audit des opérations sensibles (acteur, action, cible, horodatage, résultat).
- **Réversibilité** : sauvegarde préalable, scripts/versioning, rollback via PITR/procédure validée.

## 2. Corrections préparées par domaine

### 2.1 Accès Super Admin strict
| Élément | État actuel (local connu) | Correction préparée | Impact | Tests prévus (après autorisation) | Dépendances/blocages |
|---|---|---|---|---|---|
| Garde UI SA | `SuperAdminGuard` fail-closed (`get_my_profile`, rôle `saas_admin`) — vérifié localement | Maintenir ; ne jamais substituer au contrôle serveur | Faible côté UI | E2E mock déjà vert ; tests réels session/rôle | — |
| RPC sensibles SA | 0010/0026/0028/0030 prévoient `if not is_saas_admin() then raise` + SECURITY DEFINER | S’assurer que définitions effectives en base incluent le garde, `search_path` sûr, grants minimaux ; appliquer 0032/0028 selon plan | Élevé (sécurité) | Appels SA autorisé OK, non-SA/anon refusés, audit écrit | Audit distant read-only, sauvegarde, gel levé ciblé |
| `admin_delete_client_account` | 0030 durcit (garde+audit+revoke) — local | Appliquer/vérifier en base ; supprimer expositions non désirées | Élevé | Suppression test isolée autorisée, refus non-SA | BLOQUÉ P0 |
| `is_saas_admin()` et helpers | Définitions dans 0001/0002/0007 (+ usage généralisé) | Vérifier définition effective unique/cohérente, non contournable, dépendances (`profiles`, `auth.uid()`) | Critique | Résolution rôle correcte pour tous profils tests | Audit distant |

### 2.2 RLS complète et isolation inter-entreprises
| Élément | État actuel (local) | Correction préparée | Impact | Tests prévus | Blocages |
|---|---|---|---|---|---|
| Tables cœur tenant | Policy générique `tenant_isolation` (0001) ; ajouts ciblés (audit, subscriptions, support, barcodes, printers, etc.) | Revue exhaustive par table : RLS activée, policies SELECT/INSERT/UPDATE/DELETE cohérentes, bypass SA explicite uniquement où requis | Élevé | Accès même tenant OK, cross-tenant refusé, SA selon besoin | État distant inconnu |
| `profiles` / `clients` | 0031 ajoute update SA profils et accès SA clients | Appliquer 0031 si absent ; vérifier non-régression manager/employé | Moyen/Élevé | Lecture/MAJ autorisées, refus autres | Gel P0 |
| Tables plateforme (CRM) | 0018/0029 saas_admin-only (prévu) | Appliquer/vérifier 0018/0029 ; confirmer aucun accès tenant | Moyen | Non-SA refusé | Gel P0 |
| Catalogues globaux | `vehicle_catalog` lisible tout authenticated (0016), `plans/plan_features` lisibles authenticated (0009) | Confirmer intention produit ; sinon restreindre (risque fuite d’info vs besoin fonctionnel) | À arbitrer | Lecture selon politique retenue | Décision + application |

### 2.3 Rôles Manager/employés et permissions par module
| Élément | État actuel (local) | Correction préparée | Impact | Tests prévus | Blocages |
|---|---|---|---|---|---|
| Hiérarchie rôles | Enum + helpers + policies/RPC (0001+) ; table `permissions` utilisée en POS (0021/0025) | Uniformiser contrôles serveur par module sensible ; principe moindre privilège | Élevé | Matrice autorisé/refusé par rôle et module | Validation réelle requise |
| Attribution/changements | UI et RPC partielles (ex. complétion comptes 0006) | Auditer et tracer changements de rôle/statut ; empêcher auto-élévation | Élevé | Tentatives élévation refusées, audit présent | Gel P0 |

### 2.4 RPC sécurisées et non exécutables publiquement
| Élément | État actuel (local) | Correction préparée | Impact | Tests prévus | Blocages |
|---|---|---|---|---|---|
| Grants EXECUTE | Mélange historique : `authenticated` sur RPC 0010/0009+ avec guards internes ; révocations explicites sur fonctions récentes | Inventaire complet des grants effectifs, `REVOKE PUBLIC/anon` partout où non requis, conserver `authenticated` minimal + garde serveur robuste | Élevé | `anon`/public sans accès ; rôles non autorisés refusés | Audit distant + gel levé |
| Définitions/signatures | Risque overloads/divergence distante (inconnu) | Normaliser signatures, supprimer/remplacer overloads dangereux (si identifiés et autorisés) | Élevé | Appels clients inchangés ou migrés proprement | Non vérifiable sans audit |
| `search_path` | Présent sur la plupart des SECURITY DEFINER | Vérifier systématiquement `search_path` fixe et minimal | Moyen/Élevé | Revue statique + tests | Audit distant |

### 2.5 Audit des opérations sensibles
| Élément | État actuel (local) | Correction préparée | Impact | Tests prévus | Blocages |
|---|---|---|---|---|---|
| `audit_log` | Table + policies 0001/0010 ; écrit par plusieurs RPC | Vérifier couverture (toutes actions SA/critiques), intégrité, politiques de lecture/écriture strictes, rétention | Moyen/Élevé | Événements générés et consultables selon droits | Gel P0 |
| `subscriptions_audit`, `onboarding_requests` | 0026/0028 (préparé) | Appliquer si requis, garantir traçabilité cycle de vie/onboarding | Moyen | Historique cohérent | Gel P0 |

### 2.6 Prévention doublons, orphelins, doubles soumissions
| Élément | État actuel (local) | Correction préparée | Impact | Tests prévus | Blocages |
|---|---|---|---|---|---|
| Onboarding | 0028/EF : `request_id`, validations, anti-doublon email, compensation partielle | Durcir gestion échec compensation, rendre opérations atomiques/idempotentes autant que possible | Élevé | Retries, pannes simulées (env test), aucun doublon/orphelin | Déploiement/config requis |
| Création établissement 0010 | Pas d’idempotence explicite | Envisager mécanisme idempotent/contraintes (après analyse compatibilité) | Moyen | Appels répétés sans duplication | Gel P0 |
| Mutations UI | Variables selon écrans | Protections client (désactivation bouton en cours) + contraintes/transactions serveur | Moyen | Double clic/retry réseau | Partiel local, serveur à valider |

## 3. Plan d’application ordonné (préparé, non exécuté)
1. **Audit read-only distant autorisé** (inventaire réel : fonctions, ACL/grants, RLS/policies, triggers, données critiques) + comparaison aux sources locales.
2. **Sauvegarde/PITR vérifiée** + preuve (voir `docs/PROCEDURE_SAUVEGARDE_RESTAURATION_VERIFIABLE.md`).
3. **Application contrôlée** des corrections/migrations validées (référence `0032_PLAN_PENDING_MIGRATIONS.sql`, `0028_apply_minimal.sql`, guides) en environnement isolé puis cible, selon ordre approuvé.
4. **Déploiement EF onboarding** et configuration Auth/SMTP/Redirect URLs/secrets (sans exposition) après autorisation.
5. **Vérifications post-déploiement** : grants/RLS/policies, tests d’accès, parcours onboarding test, audit, non-régression.
6. **Consignation GV5** (append-only) : avant/après, résultats, écarts, rollback éventuel.

## 4. Risques résiduels si appliqué sans contrôles
- Régression de production, perte/corruption de données, indisponibilité Auth/onboarding, dérive de permissions, audit incomplet. **Mitigation** : sauvegarde vérifiée, tests isolés, exécution graduelle, rollback prêt.

**Conclusion** : corrections **documentées et préparées** ; **aucune appliquée**. L’état sécurisé réel de Supabase reste **non prouvé** sans audit distant et exécution contrôlée autorisée.

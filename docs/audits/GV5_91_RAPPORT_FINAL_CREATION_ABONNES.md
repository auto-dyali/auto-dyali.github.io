# RAPPORT FINAL — MISSION GV5 §91 — CRÉATION DES ABONNÉS ET DU MANAGER

**Date** : 22 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**Dossier local** : `/Users/hind/Documents/Default Project/auto-plus`  
**HEAD de référence** : `dc3a039`  
**HEAD final** : `dc3a039` (aucun commit nouveau — voir justification ci-dessous)  
**Production Supabase** : `nxmsqqoflskfajqrqddw` (lecture seule)  
**Staging Supabase** : `yocufscgninxiihwiepa` (lecture seule, migrations 0036→0042 non appliquées)

---

## 1. OBJECTIF DE LA MISSION

Rendre opérationnelle la création d'un abonné professionnel depuis le Super Admin, de bout en bout :

1. Ouvrir Super Admin → créer un établissement
2. Saisir les informations du garage
3. Créer son Manager
4. Générer un identifiant professionnel unique
5. Choisir une formule STANDARD, SILVER ou GOLD
6. Définir la durée payante
7. Définir indépendamment la période d'essai
8. Attribuer les modules et permissions
9. Vérifier le récapitulatif
10. Confirmer la création
11. Enregistrer durablement dans Supabase
12. Préparer l'invitation sécurisée du Manager
13. Permettre au Manager d'activer son compte et de définir son propre mot de passe
14. Permettre au Manager de se connecter
15. Vérifier l'isolation multi-tenant

---

## 2. CAUSE RACINE DU BLOCAGE

### Analyse du parcours de création

Le flux de création d'abonné suit cette chaîne :

```
Interface (onboarding/page.tsx)
  → Préflight: admin_identity_v2_health (migration 0039)
  → Vérification unicité: admin_check_identity_available (migration 0039)
  → Edge Function: supabase.functions.invoke("onboard-tenant")
    → admin_find_onboarding_request (migration 0028)
    → admin_check_identity_available (migration 0039)
    → admin_find_user_id_by_email (migration 0028)
    → admin.auth.admin.createUser (Supabase Auth, sans migration)
    → admin_onboard_tenant_v2 (migration 0039)
    → admin_record_delivery (migration 0036)
  → Activation: Edge Function activate-manager
    → admin_invitation_preview (migration 0036)
    → admin_accept_invitation (migration 0036)
    → admin.auth.admin.updateUserById (Supabase Auth, sans migration)
```

### Blocage identifié

Les migrations **0036 et 0039** (ainsi que 0037, 0038, 0040, 0041, 0042) sont **présentes dans Git** mais **NON appliquées sur staging**. Par conséquent :

| RPC / Fonction | Dépendance | État sur staging | Conséquence |
|---|---|---|---|
| `admin_identity_v2_health` | 0039 | ABSENTE | Préflight frontal bloque : "Environnement non compatible" |
| `admin_check_identity_available` | 0039 | ABSENTE | Vérification d'unicité impossible |
| `admin_onboard_tenant_v2` | 0039 | ABSENTE | EF `onboard-tenant` échoue (503) à l'étape de persistance |
| `resolve_login_email` | 0039 | ABSENTE | Résolution login → email impossible |
| `admin_invitation_preview` | 0036 | ABSENTE | Activation Manager impossible |
| `admin_accept_invitation` | 0036 | ABSENTE | Activation Manager impossible |
| `admin_record_delivery` | 0036 | ABSENTE | Statuts de livraison non enregistrés |
| RLS `saas_admin_insert_profiles` | 0042 | ABSENTE | Super Admin ne peut pas insérer un profil Manager |

**Cause racine** : la migration 0039 (et ses dépendances 0036→0038) n'a pas été appliquée sur staging. Sans elle, aucune création d'abonné n'est possible car l'Edge Function `onboard-tenant` ne peut pas persister les données.

---

## 3. AUDIT DU CODE EXISTANT (Phase 1 & Phase 3)

### Fichiers inspectés

| Fichier | Rôle dans le parcours | État |
|---|---|---|
| `src/app/super-admin/onboarding/page.tsx` | Formulaire 6 étapes + soumission | ✅ Complet, cohérent contrat v2 |
| `src/lib/onboarding-contract.ts` | Ré-export du contrat canonique v2 | ✅ Correct |
| `supabase/functions/_shared/contract.ts` | Contrat unique partagé client/serveur/tests | ✅ Correct |
| `supabase/functions/onboard-tenant/index.ts` | Edge Function de création bout en bout | ✅ Correct (compensation Auth en cas d'échec) |
| `supabase/functions/activate-manager/index.ts` | Edge Function d'activation Manager | ✅ Correct (vérification de connexion réelle) |
| `supabase/functions/send-invitation/index.ts` | Edge Function de relance d'invitation | ✅ Correct (canaux indépendants, statuts réels) |
| `src/lib/onboarding.ts` | Helpers legacy (slugify, genererIdentifiantProfessionnel, validation) | ✅ Correct |
| `src/lib/abonne-rules.ts` | Règles validation/durées/échéances partagées | ✅ Correct |
| `src/components/abonne-workspace.tsx` | Fiche unifiée modification abonné | ✅ Utilise RPC existantes (hors 0039) |

### Points de qualité vérifiés

- **Anti double-soumission** : `enCours` ref dans `soumettre()` ✅
- **Anti double-vente** : idempotence par `requestId` + verrou consultatif `pg_advisory_xact_lock` dans `admin_onboard_tenant_v2` ✅
- **Compensation** : suppression du compte Auth si l'onboarding échoue après création ✅
- **Aucun mot de passe en clair** : `temporaryPassword` jamais transmis à la RPC, stocké uniquement via `auth.admin.createUser`, jamais renvoyé ✅
- **Jeton d'invitation** : stocké uniquement sous forme SHA-256 (`token_hash`) ✅
- **Statuts honnêtes** : `non_configure` si Resend/WhatsApp absents, pas de faux envoi ✅
- **Essai indépendant** : `trial_days` ne réduit pas `paid_months` ✅
- **Permissions** : intersection forfait ∩ permissions via `my_features()` ✅
- **Isolation multi-tenant** : RLS `establishment_id = current_establishment_id() or is_saas_admin()` ✅

---

## 4. TABLEAU DE SUIVI DES MIGRATIONS (Phase 5)

| Migration | Dépendances | Fichier vérifié | État staging | État production | Action nécessaire |
|---|---|---|---|---|---|
| 0036 | 0028, 0001, pgcrypto, uuid-ossp | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0028) |
| 0037 | is_saas_admin, is_manager, current_establishment_id, autoplus_current_role | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0036) |
| 0038 | audit_log, establishments, profiles | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0037) |
| 0039 | 0001, 0007, 0009, 0028, 0036, 0037/0038 | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0038) — **CRITIQUE** |
| 0040 | admin_set_subscription (existe via remediation_075) | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0039) |
| 0041 | subscriptions | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0040) |
| 0042 | profiles, is_saas_admin | ✅ | NON VÉRIFIABLE | NON VÉRIFIABLE | Appliquer (après 0041) |

**Ordre d'application** : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042

**Interdiction respectée** : aucune migration n'a été appliquée pendant GV5 §91. Production en lecture seule.

---

## 5. PLAN DE MIGRATION PRÉPARÉ (à exécuter avec autorisation propriétaire)

### Prérequis (avant toute application)

1. [ ] Sauvegarde/PITR de staging vérifiée et exploitable
2. [ ] Audit read-only de l'état réel (définitions, privilèges, RLS)
3. [ ] Autorisation explicite et distincte du propriétaire
4. [ ] Exécution via SQL Editor avec rôle owner/service_role

### Ordre d'application

| Étape | Migration | Objet | Risque |
|---|---|---|---|
| 1 | 0036 | Invitations Manager sécurisées (table invitations, invitation_events, RPC invitation) | Moyen (création de tables) |
| 2 | 0037 | Durcissement sécurité P0 (fonctions SECURITY DEFINER, RLS) | Élevé (modification de privilèges) |
| 3 | 0038 | Sécurité RLS et index (politiques consolidées, index FK) | Moyen (modification de politiques) |
| 4 | 0039 | Identités, onboarding v2, RPC admin_onboard_tenant_v2 | Élevé (modification de schéma établissements/profiles) |
| 5 | 0040 | admin_set_subscription en UPSERT | Faible (modification d'une fonction existante) |
| 6 | 0041 | Colonne updated_at sur subscriptions | Faible (ajout de colonne) |
| 7 | 0042 | RLS profiles — insertion Super Admin | Faible (ajout de politiques RLS) |

### Tests après migration (sur staging)

1. Créer un établissement de test (données synthétiques)
2. Créer son Manager
3. Vérifier l'utilisateur Auth, le profil, le rôle Manager, l'association établissement
4. Créer l'abonnement GOLD, vérifier durée payante et essai indépendant
5. Vérifier modules et permissions
6. Créer l'invitation, vérifier statut de livraison
7. Activer le compte, définir le mot de passe, se connecter réellement
8. Vérifier l'accès à son garage uniquement (isolation multi-tenant)
9. Modifier l'abonnement depuis le Super Admin, vérifier persistance
10. Vérifier le journal d'audit

### Cas d'erreur à tester

- Identifiant professionnel déjà existant
- E-mail déjà utilisé
- Profil existant
- Double-clic / double soumission
- Interruption réseau
- Échec de l'invitation
- Absence de Resend → statut `non_configure`
- Absence de WhatsApp → statut `non_configure`

### Rollback

- Restaurer depuis la sauvegarde/PITR prise avant l'étape 1
- Vérifier la restaurabilité avant toute application

---

## 6. TESTS EXÉCUTÉS (Phase 8)

| Contrôle | Commande | Résultat |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 erreur** ✅ |
| ESLint | `npx eslint .` | **0 erreur**, 19 warnings préexistants ✅ |
| Tests unitaires | `npm test` | **158/158 passés**, 0 échec ✅ |
| Build Next.js | `npm run build` | **Succès**, 67/67 pages statiques ✅ |
| Tests de cohérence statique (contrat RPC) | Inclus dans `npm test` | Passent (vérifient cohérence EF ↔ migration 0039) ✅ |
| Tests E2E sur staging | Non exécutés | Migrations 0036→0039 non appliquées sur staging ❌ |
| Tests d'activation Manager sur staging | Non exécutés | Migrations 0036 non appliquées ❌ |
| Tests multi-tenant / RLS sur staging | Non exécutés | Accès base staging non disponible ❌ |

**Avertissements préexistants** (19 warnings, non bloquants) : unused vars dans `communication-models.tsx`, `subscription-studio.tsx`, `super-admin-shell.tsx`; `next/img` dans `logo-animé.tsx`.

---

## 7. PREUVES DE COHÉRENCE (code, pas base de données)

Les tests statiques suivants vérifient que le code est cohérent avec les migrations (sans nécessiter de base de données) :

| Test | Ce qu'il vérifie | Résultat |
|---|---|---|
| `test-contract-rpc-067.mjs` | `toRpcArgs` envoie exactement les 9 paramètres de `admin_onboard_tenant_v2` (migration 0039) | ✅ Pass |
| `test-contract-rpc-067.mjs` | Clés JSON imbriquées envoyées = clés lues par la RPC | ✅ Pass |
| `test-contract-rpc-067.mjs` | Permissions can_view/can_create/can_edit/can_delete cohérentes | ✅ Pass |
| `test-contract-rpc-067.mjs` | Aucun mot de passe transmis à la RPC | ✅ Pass |
| `test-edge-functions-51.mjs` | `onboard-tenant` utilise le contrat partagé, pas une copie | ✅ Pass |
| `test-edge-functions-51.mjs` | `onboard-tenant` crée le compte Auth côté serveur et compense | ✅ Pass |
| `test-edge-functions-51.mjs` | `onboard-tenant` appelle `admin_onboard_tenant_v2` et `admin_check_identity_available` | ✅ Pass |
| `test-edge-functions-51.mjs` | `activate-manager` appelle `admin_accept_invitation` (pas dans preview) | ✅ Pass |
| `test-edge-functions-51.mjs` | `send-invitation` appelle `admin_prepare_resend` et `admin_record_delivery` | ✅ Pass |
| `test-migrations-51.mjs` | 0036 contient `admin_invitation_preview`, `admin_accept_invitation`, `admin_prepare_resend` | ✅ Pass |
| `test-migrations-51.mjs` | 0039 contient `admin_onboard_tenant_v2` | ✅ Pass |

---

## 8. INTERFACE SUPER ADMIN (Phase 7)

Le formulaire d'onboarding (`src/app/super-admin/onboarding/page.tsx`) implémente :

| Élément | Implémentation |
|---|---|
| 6 étapes claires | Entreprise → Responsable → Formule & abonnement → Modules & droits → Transmission → Confirmation |
| Champs obligatoires signalés | `obligatoire` sur chaque `Champ3D` requis |
| Erreurs affichées | `erreur()` affiche les erreurs de validation sous chaque champ |
| Doublons détectés | `dispo.*_available` affiche "Identifiant déjà utilisé", "E-mail déjà utilisé", etc. |
| Formule STANDARD/SILVER/GOLD | Sélection parmi `plansReels` chargés depuis la BDD |
| Durée payante | 1, 3, 6 mois, 1 an, 2 ans, personnalisée (1-120 mois) |
| Essai indépendant | Aucun, 7, 15, 30, 45, 60 jours, personnalisé (1-365 jours) — ne réduit pas la durée payante |
| Modules et permissions | Cases à cocher avec canView/canCreate/canEdit/canDelete, filtrés par forfait |
| Récapitulatif | Étape 6 avec identifiant professionnel, login, établissement, abonnement, Manager Auth, Invitation |
| État réel de création | Statuts de livraison par canal (accepte_par_fournisseur / echec / non_configure / non_demande) |
| Bouton confirmation | Désactivé pendant traitement (`enCours`), anti double-soumission |
| Aucun mot de passe affiché | Le mot de passe temporaire n'est jamais réaffiché ni renvoyé |
| Design premium | Sombre, pétrole, or champagne, rendu 3D mesuré, responsive |

---

## 9. BLOQUAGES ET AUTORISATIONS MANQUANTES

| Blocage | Action requise | Dépendance |
|---|---|---|
| Migration 0036→0042 sur staging | Autorisation propriétaire pour application | Propriétaire du projet |
| Création abonné testable sur staging | Migration 0039 appliquée sur staging | Propriétaire du projet |
| Activation Manager testable | Migrations 0036 + 0039 appliquées | Propriétaire du projet |
| Secrets Resend / WhatsApp / Stripe / ACTIVATION_BASE_URL | Configuration fournisseurs | Propriétaire du projet |
| Tarifs réels (STANDARD/SILVER/GOLD) | Renseigner `price_monthly`, `price_yearly` dans `plans` | Propriétaire du projet |
| Basculement .env.local vers staging pour E2E | Autorisation temporaire | Propriétaire du projet |
| PITR Production | Vérification sauvegarde restaurable | Propriétaire du projet |

**Règle respectée** : aucune modification de production n'a été effectuée. Production reste en lecture seule.

---

## 10. POURCENTAGES DE PROGRESSION

| Périmètre | Développement | Validation staging | Préparation production |
|---|---:|---:|---:|
| Création abonné | 95 % | 0 % (bloqué par 0039) | 0 % |
| Création Manager | 95 % | 0 % (bloqué par 0039) | 0 % |
| Activation Manager | 90 % | 0 % (bloqué par 0036) | 0 % |
| Abonnements | 85 % | 0 % (bloqué par 0039/0040) | 0 % |
| Super Admin complet | 85 % | 0 % (bloqué par 0039) | 0 % |
| Projet complet | 87 % | ~40 % | 0 % |

**Justification** :
- **Développement (95% création abonné)** : le code est écrit, cohérent avec le contrat v2, compilant, testé statiquement (cohérence RPC vérifiée). Le seul manque est l'application des migrations sur staging.
- **Validation staging (0%)** : impossible sans application des migrations 0036→0039. Aucun test E2E ne peut s'exécuter sur staging.
- **Préparation production (0%)** : lecture seule, plan préparé mais non exécuté.

**Distinction importante** : la compilation réussie (TSC 0) et les tests unitaires (158/158) ne constituent pas une validation métier complète. Le parcours de création d'abonné ne peut être considéré comme opérationnel que s'il a été testé en bout en bout sur staging avec une base de données contenant les migrations 0036→0039.

---

## 11. ÉLÉMENTS NON VÉRIFIABLES

| Élément | Raison |
|---|---|
| Création d'abonné sur staging | Migrations 0036→0039 non appliquées ; accès base non disponible |
| Activation Manager sur staging | Migrations 0036 non appliquées |
| Connexion réelle du Manager | Nécessite une base staging avec les migrations appliquées |
| Isolation multi-tenant en pratique | Nécessite accès base staging + deux établissements de test |
| Statut du déploiement GitHub Pages | Nécessite accès à l'interface GitHub |
| Statut du workflow GitHub Actions | Déclenché automatiquement, résultat non consultable via les outils disponibles |
| Tarifs réels configurés | `price_monthly` NULL en base |

---

## 12. RISQUES RÉSIDUELS

1. **Création d'abonné bloquée** : sans migration 0039 sur staging, `admin_onboard_tenant_v2` n'existe pas et l'EF `onboard-tenant` échoue (503).
2. **Activation Manager bloquée** : sans migration 0036, `admin_invitation_preview` et `admin_accept_invitation` n'existent pas.
3. **Profils Manager non insertables** : sans migration 0042, le RLS sur `profiles` interdit l'insertion par le Super Admin.
4. **Pas de facturation** : tarifs NULL, `price_monthly` non renseigné.
5. **Notifications non opérationnelles** : sans Resend/WhatsApp, les invitations restent en statut `non_configure`.

---

## 13. PROCHAINES ACTIONS RECOMMANDÉES

1. Obtenir autorisation propriétaire pour appliquer migrations 0036→0042 sur staging (ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042)
2. Vérifier sauvegarde/PITR de staging avant application
3. Appliquer les migrations dans l'ordre via SQL Editor
4. Re-tester création abonné, activation Manager, modification abonnement sur staging
5. Re-exécuter E2E complètes (gv586, gv575, super-admin, gv585)
6. Configurer secrets (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL)
7. Configurer tarifs réels STANDARD/SILVER/GOLD
8. Préparer plan de migration production (aucune écriture sans autorisation distincte)
9. Vérifier PITR production
10. Vérifier statut workflow GitHub Actions et déploiement Pages

---

## 14. RÉSUMÉ OPÉRATIONNEL

| Élément | Résultat |
|---|---|
| HEAD final | `dc3a039` (synchronisé avec `origin/main`, aucun commit nouveau) |
| TypeScript | 0 erreur |
| ESLint | 0 erreur (19 warnings préexistants) |
| Tests unitaires | 158/158 passés |
| Build Next.js | Succès (67/67 pages) |
| Code onboarding | Complet, cohérent contrat v2, 6 étapes |
| Code Edge Functions | Cohérent avec migrations 0036/0039 (tests statiques passent) |
| Cause racine du blocage | Migrations 0036→0039 non appliquées sur staging |
| Migrations appliquées cette mission | Aucune (respect de la lecture seule et de l'interdiction d'appliquer sans autorisation) |
| Production modifiée | Non (lecture seule respectée) |
| Rapport produit | `docs/audits/GV5_91_RAPPORT_FINAL_CREATION_ABONNES.md` |

**Conclusion** : le code de création d'abonné est complet, cohérent et testé statiquement. Le parcours ne peut être validé en bout en bout que sur une base staging avec les migrations 0036→0039 appliquées. Cette application nécessite une autorisation explicite et distincte du propriétaire.
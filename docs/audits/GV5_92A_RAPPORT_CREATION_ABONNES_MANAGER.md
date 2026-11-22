# RAPPORT A — CRÉATION DES ABONNÉS ET DU MANAGER

**Mission** : GV5 §92 — Chantier A  
**Date** : 22 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `264beff` (synchronisé avec `origin/main`)

---

## 1. CAUSE RACINE DU BLOCAGE

Le parcours de création d'un abonné depuis le Super Admin suit cette chaîne :

```
Interface (onboarding/page.tsx)
  → Préflight: admin_identity_v2_health  [migration 0039]
  → Vérification unicité: admin_check_identity_available  [migration 0039]
  → Edge Function: supabase.functions.invoke("onboard-tenant")
    → admin_find_onboarding_request         [migration 0028]
    → admin_check_identity_available        [migration 0039]
    → admin_find_user_id_by_email           [migration 0028]
    → admin.auth.admin.createUser           (Supabase Auth, sans migration)
    → admin_onboard_tenant_v2               [migration 0039]
    → admin_record_delivery                 [migration 0036]
  → Activation: Edge Function activate-manager
    → admin_invitation_preview              [migration 0036]
    → admin_accept_invitation               [migration 0036]
    → admin.auth.admin.updateUserById       (Supabase Auth, sans migration)
```

**Cause racine** : les migrations **0036 et 0039** (ainsi que 0037, 0038) sont **présentes dans Git** mais **NON appliquées sur staging**. Par conséquent, les RPC critiques n'existent pas sur staging et l'EF `onboard-tenant` échoue (503) à l'étape de persistance.

### RPC concernées et leur dépendance

| RPC / Fonction | Dépendance migration | État sur staging | Conséquence |
|---|---|---|---|
| `admin_identity_v2_health` | 0039 | ABSENTE | Préflight frontal bloque : "Environnement non compatible" |
| `admin_check_identity_available` | 0039 | ABSENTE | Vérification d'unicité impossible |
| `admin_onboard_tenant_v2` | 0039 | ABSENTE | EF `onboard-tenant` échoue (503) à la persistance |
| `resolve_login_email` | 0039 | ABSENTE | Résolution login → email impossible |
| `admin_find_onboarding_request` | 0028 | Présente (migration antérieure) | OK |
| `admin_find_user_id_by_email` | 0028 | Présente (migration antérieure) | OK |
| `admin_invitation_preview` | 0036 | ABSENTE | Activation Manager impossible |
| `admin_accept_invitation` | 0036 | ABSENTE | Activation Manager impossible |
| `admin_record_delivery` | 0036 | ABSENTE | Statuts de livraison non enregistrés |
| RLS `saas_admin_insert_profiles` | 0042 | ABSENTE | Super Admin ne peut pas insérer un profil Manager |

---

## 2. AUDIT DU CODE EXISTANT

Le code de création d'abonné est **complet, cohérent et testé statiquement** :

| Fichier | Rôle | État |
|---|---|---|
| `src/app/super-admin/onboarding/page.tsx` | Formulaire 6 étapes + soumission | ✅ Cohérent contrat v2 |
| `src/lib/onboarding-contract.ts` | Ré-export contrat canonique v2 | ✅ Correct |
| `supabase/functions/_shared/contract.ts` | Contrat unique partagé client/serveur/tests | ✅ Correct |
| `supabase/functions/onboard-tenant/index.ts` | EF création bout en bout + compensation Auth | ✅ Correct |
| `supabase/functions/activate-manager/index.ts` | EF activation + vérification connexion réelle | ✅ Correct |
| `supabase/functions/send-invitation/index.ts` | EF relance invitation (canaux indépendants) | ✅ Correct |
| `src/lib/abonne-rules.ts` | Règles validation/durées/échéances partagées | ✅ Correct |

### Points de qualité vérifiés

- Anti double-soumission (`enCours` ref)
- Anti double-vente (idempotence par `requestId` + `pg_advisory_xact_lock`)
- Compensation (suppression Auth si échec après création)
- Aucun mot de passe en clair (jamais transmis à la RPC, jamais renvoyé)
- Jeton d'invitation stocké uniquement sous SHA-256
- Statuts honnêtes (`non_configure` si Resend/WhatsApp absents)
- Essai indépendant (ne réduit pas la durée payante)
- Isolation multi-tenant (RLS `establishment_id = current_establishment_id() or is_saas_admin()`)

---

## 3. TABLEAU DE SUIVI DES MIGRATIONS

| Migration | Fichier présent | Dépendances | État réel STAGING | Action nécessaire |
|---|---|---|---|---|
| 0036 | ✅ `0036_invitations_manager_prepared_NOT_APPLIED.sql` | 0028, 0001, pgcrypto, uuid-ossp | NON VÉRIFIABLE | Appliquer (après 0028) |
| 0037 | ✅ `0037_fix_security_p0_prepared_NOT_APPLIED.sql` | is_saas_admin, is_manager, current_establishment_id, autoplus_current_role | NON VÉRIFIABLE | Appliquer (après 0036) |
| 0038 | ✅ `0038_security_rls_indexes_prepared_NOT_APPLIED.sql` | audit_log, establishments, profiles | NON VÉRIFIABLE | Appliquer (après 0037) |
| 0039 | ✅ `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | 0001, 0007, 0009, 0028, 0036, 0037/0038 | NON VÉRIFIABLE | Appliquer (après 0038) — **CRITIQUE** |
| 0040 | ✅ `0040_fix_admin_set_subscription_upsert.sql` | admin_set_subscription (existe via remediation_075) | NON VÉRIFIABLE | Appliquer (après 0039) |
| 0041 | ✅ `0041_add_updated_at_subscriptions.sql` | subscriptions | NON VÉRIFIABLE | Appliquer (après 0040) |
| 0042 | ✅ `0042_rls_profiles_saas_admin_insert.sql` | profiles, is_saas_admin | NON VÉRIFIABLE | Appliquer (après 0041) |

**Ordre d'application** : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042

**Interdiction respectée** : aucune migration n'a été appliquée pendant GV5 §92. Production en lecture seule.

---

## 4. PLAN DE MIGRATION PRÉPARÉ

### Prérequis (avant toute application)

1. Sauvegarde/PITR de staging vérifiée et exploitable
2. Audit read-only de l'état réel (définitions, privilèges, RLS)
3. Autorisation explicite et distincte du propriétaire
4. Exécution via SQL Editor avec rôle owner/service_role

### Ordre d'application

| Étape | Migration | Objet | Risque |
|---|---|---|---|
| 1 | 0036 | Invitations Manager sécurisées | Moyen (création tables) |
| 2 | 0037 | Durcissement sécurité P0 | Élevé (modification privilèges) |
| 3 | 0038 | Sécurité RLS et index | Moyen (modification politiques) |
| 4 | 0039 | Identités, onboarding v2, RPC admin_onboard_tenant_v2 | Élevé (modification schéma) |
| 5 | 0040 | admin_set_subscription en UPSERT | Faible |
| 6 | 0041 | Colonne updated_at sur subscriptions | Faible |
| 7 | 0042 | RLS profiles — insertion Super Admin | Faible |

### Rollback

Restaurer depuis la sauvegarde/PITR prise avant l'étape 1. Vérifier la restaurabilité avant toute application.

---

## 5. TESTS EXÉCUTÉS

| Contrôle | Résultat |
|---|---|
| TypeScript | 0 erreur ✅ |
| ESLint | 0 erreur, 19 warnings préexistants ✅ |
| Tests unitaires | 158/158 passés, 0 échec ✅ |
| Build Next.js | Succès (67/67 pages) ✅ |
| Tests de cohérence statique (contrat RPC ↔ migration 0039) | Passent ✅ |
| Tests E2E sur staging | Non exécutés (migrations non appliquées) ❌ |
| Tests d'activation Manager sur staging | Non exécutés (migrations non appliquées) ❌ |

---

## 6. BLOQUAGES RESTANTS

| Blocage | Action requise | Dépendance |
|---|---|---|
| Migration 0036→0042 sur staging | Autorisation propriétaire pour application | Propriétaire du projet |
| Création abonné testable sur staging | Migration 0039 appliquée sur staging | Propriétaire du projet |
| Activation Manager testable | Migrations 0036 + 0039 appliquées | Propriétaire du projet |
| Secrets Resend / WhatsApp / Stripe / ACTIVATION_BASE_URL | Configuration fournisseurs | Propriétaire du projet |
| Tarifs réels (STANDARD/SILVER/GOLD) | Renseigner `price_monthly`, `price_yearly` | Propriétaire du projet |
| Basculement .env.local vers staging pour E2E | Autorisation temporaire | Propriétaire du projet |

---

## 7. POURCENTAGES DE PROGRESSION — CHANTIER A

| Périmètre | Développement | Validation staging | Préparation production |
|---|---:|---:|---:|
| Création abonné | 95 % | 0 % (bloqué par 0039) | 0 % |
| Création Manager | 95 % | 0 % (bloqué par 0039) | 0 % |
| Activation Manager | 90 % | 0 % (bloqué par 0036) | 0 % |
| Abonnements | 85 % | 0 % (bloqué par 0039/0040) | 0 % |
| Super Admin complet | 85 % | 0 % (bloqué par 0039) | 0 % |

**Justification** : le code est écrit, cohérent avec le contrat v2, compilant et testé statiquement. Le seul manque est l'application des migrations sur staging. Sans elles, aucun test E2E ne peut s'exécuter.

---

## 8. DEMANDE D'AUTORISATION

**Opération** : Application des migrations 0036→0042 sur staging `yocufscgninxiihwiepa`  
**Ordre** : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042  
**Prérequis** : Sauvegarde/PITR vérifiée avant application  
**Risque** : Modification de schéma et de données de staging  
**Rollback** : Restauration depuis la sauvegarde/PITR  

Cette autorisation est indispensable pour valider le parcours de création d'abonné en bout en bout.
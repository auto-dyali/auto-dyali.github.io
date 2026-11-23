# RAPPORT CRÉATION DES ABONNÉS — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)

---

## 1. PARCOURS DE CRÉATION D'ABONNÉ (Code existant)

Le parcours de création d'abonné depuis le Super Admin est implémenté en 6 étapes :

| Étape | Contenu | Fichier |
|---|---|---|
| 1. Entreprise | Nom, raison sociale, slug, identifiant professionnel, activité, adresse, ville, région, pays, téléphone, email, etc. | `onboarding/page.tsx` |
| 2. Responsable (Manager) | Prénom, nom, téléphone, email, identifiant de connexion, mot de passe temporaire | `onboarding/page.tsx` |
| 3. Formule & abonnement | Plan STANDARD/SILVER/GOLD, durée payante, durée d'essai (indépendante), date de début | `onboarding/page.tsx` |
| 4. Modules & droits | Matrice des modules du forfait avec permissions (voir/créer/modifier/supprimer) | `onboarding/page.tsx` |
| 5. Transmission | Choix des canaux e-mail et/ou WhatsApp (indépendants) | `onboarding/page.tsx` |
| 6. Confirmation | Récapitulatif, résultat réel par canal, statuts de livraison | `onboarding/page.tsx` |

---

## 2. CHAÎNE D'APPELS (Interface → Supabase)

```
Interface (onboarding/page.tsx)
  → Préflight: admin_identity_v2_health [migration 0039] — ABSENTE sur staging
  → Vérification unicité: admin_check_identity_available [migration 0039] — ABSENTE sur staging
  → Edge Function: supabase.functions.invoke("onboard-tenant")
    → admin_find_onboarding_request [migration 0028] — Présente
    → admin_check_identity_available [migration 0039] — ABSENTE
    → admin_find_user_id_by_email [migration 0028] — Présente
    → admin.auth.admin.createUser — Sans migration (Supabase Auth)
    → admin_onboard_tenant_v2 [migration 0039] — ABSENTE sur staging
    → admin_record_delivery [migration 0036] — ABSENTE sur staging
  → Activation: Edge Function activate-manager
    → admin_invitation_preview [migration 0036] — ABSENTE sur staging
    → admin_accept_invitation [migration 0036] — ABSENTE sur staging
    → admin.auth.admin.updateUserById — Sans migration
```

---

## 3. GARANTIES DU CODE (Vérifiées statiquement)

| Garantie | Implémentation | Preuve |
|---|---|---|
| Anti double-soumission | `enCours` ref dans `soumettre()` | `onboarding/page.tsx` |
| Anti double-vente | Idempotence par `requestId` + `pg_advisory_xact_lock` | `admin_onboard_tenant_v2` (0039) |
| Compensation | Suppression du compte Auth si l'onboarding échoue après création | `onboard-tenant/index.ts` (ligne 292-294) |
| Aucun mot de passe en clair | `temporaryPassword` jamais transmis à la RPC, jamais renvoyé | `toRpcArgs()` (ligne 77-132) |
| Jeton d'invitation en hash SHA-256 uniquement | `token_hash` stocké, jamais le jeton brut | `onboard-tenant/index.ts` (ligne 281-283) |
| Statuts honnêtes | `non_configure` si Resend/WhatsApp absents, pas de faux envoi | `onboard-tenant/index.ts` (ligne 324-345) |
| Essai indépendant | `trial_days` ne réduit pas `paid_months` | `admin_onboard_tenant_v2` (0039) |
| Permissions | Intersection forfait ∩ permissions via `my_features()` | `admin_onboard_tenant_v2` (0039) |
| Isolation multi-tenant | RLS `establishment_id = current_establishment_id() or is_saas_admin()` | Migrations 0038/0039 |

---

## 4. ÉTAT DE VALIDATION

| Niveau | Statut | Preuve |
|---|---|---|
| Développement (code écrit, compilant) | 95 % | TSC 0, ESLint 0 erreurs, cohérence RPC ↔ contrat v2 vérifiée |
| Tests locaux (unitaires statiques) | 100 % | Tests de cohérence contrat RPC passent (test-contract-rpc-067.mjs) |
| Validation STAGING (E2E bout en bout) | 0 % | Migrations 0036→0039 non appliquées sur staging |
| État opérationnel réel | 0 % | Pas de test réel sur base avec migrations appliquées |

---

## 5. BLOQUAGE CRITIQUE

**Cause racine** : Les migrations 0036 et 0039 (et dépendances 0037, 0038) ne sont pas appliquées sur staging. Sans elles :
- `admin_identity_v2_health` n'existe pas → préflight frontal bloque
- `admin_check_identity_available` n'existe pas → vérification d'unicité impossible
- `admin_onboard_tenant_v2` n'existe pas → l'EF `onboard-tenant` échoue (503) à l'étape de persistance
- `admin_invitation_preview` / `admin_accept_invitation` n'existent pas → activation Manager impossible

**Action requise** : Autorisation propriétaire pour appliquer les migrations 0036→0043 sur staging dans l'ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043.

**Règle respectée** : Aucune migration n'a été appliquée pendant GV5 §94. Production en lecture seule.

---

## 6. SCÉNARIO DE TEST OBLIGATOIRE (Après autorisation)

1. Créer un établissement de test (données synthétiques)
2. Créer son Manager
3. Vérifier l'utilisateur Auth, le profil, le rôle Manager, l'association établissement
4. Créer un abonnement GOLD, vérifier durée payante et essai indépendant
5. Vérifier les modules et permissions
6. Créer une invitation, vérifier statut de livraison
7. Activer le compte, définir le mot de passe, se connecter réellement
8. Vérifier l'accès à son établissement uniquement (isolation multi-tenant)
9. Modifier l'abonnement, vérifier persistance après rechargement
10. Vérifier le journal d'audit

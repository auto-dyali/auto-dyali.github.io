# RAPPORT AUDIT CRÉATION ABONNÉ — SESSION_1 — GV5 §98

**Date** : 23 novembre 2026  
**Session** : SESSION_1  
**Mission** : GV5 §98 — Déblocage staging et validation du parcours d'abonnement  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `192979f` (synchronisé avec `origin/main`)

---

## 1. OBJECTIF DE L'AUDIT

Vérifier que le parcours de création d'abonné depuis le Super Admin est complet, cohérent et prêt à être validé en bout en bout sur staging, une fois les migrations 0036→0043 appliquées.

---

## 2. FICHIERS DU PARCOURS CRÉATION ABONNÉ

| Fichier | Rôle | État | Cohérence contrat v2 |
|---|---|---|---|
| `src/app/super-admin/onboarding/page.tsx` | Formulaire de création d'abonné 6 étapes | Présent, complet | ✅ Cohérent |
| `src/components/abonne-workspace.tsx` | Fiche unifiée de modification d'un abonné | Présent, complet | ✅ Cohérent |
| `src/lib/onboarding-contract.ts` | Contrat canonique d'onboarding v2 | Présent | ✅ Ré-export canonique |
| `supabase/functions/_shared/contract.ts` | Contrat partagé client/serveur | Présent | ✅ Source unique |
| `supabase/functions/onboard-tenant/index.ts` | Edge Function de création bout en bout | Présent | ✅ Compensation Auth incluse |
| `supabase/functions/activate-manager/index.ts` | Edge Function d'activation Manager | Présent | ✅ Vérification connexion réelle |
| `supabase/functions/send-invitation/index.ts` | Edge Function d'envoi d'invitation | Présent | ✅ Canaux indépendants |
| `src/lib/abonne-rules.ts` | Règles validation durées/échéances | Présent | ✅ Source unique |
| `src/lib/maroc-geographie.ts` | Référentiel géographique Maroc | Présent, 141 villes, 12 régions | ✅ Intégré |

---

## 3. PARCOURS CRÉATION ABONNÉ — 6 ÉTAPES

| Étape | Nom | État | Blocs |
|---|---|---|---|
| 1 | Informations du garage | ✅ Complété | Formulaire complet, validation côté client |
| 2 | Créer le Manager | ✅ Complété | Identifiant, email, téléphone, mot de passe temporaire |
| 3 | Formule, durée payante, durée d'essai | ✅ Complété | STANDARD/SILVER/GOLD, 1-120 mois, 0-365 jours |
| 4 | Modules et permissions | ✅ Complété | Modules du forfait, permissions par module |
| 5 | Transmission e-mail et WhatsApp | ✅ Complété | Canaux indépendants, statut honnête `non_configure` si absent |
| 6 | Récapitulatif et confirmation | ✅ Complété | Toutes les informations affichées, anti double-soumission |

---

## 4. VÉRIFICATIONS CODE

| Contrôle | Résultat | Preuve |
|---|---|---|
| TypeScript | 0 erreur | `npx tsc --noEmit` |
| ESLint | 0 erreur, 19 warnings préexistants | `npx eslint .` |
| Tests unitaires | 176/176 passés | `npm test` |
| Build Next.js | Succès, 67 pages | `npm run build` |

---

## 5. CAUSE DU BLOQUAGE

Le parcours de création est complet côté code, mais **ne peut pas être testé en bout en bout sur staging** car les migrations 0036 et 0039 (et dépendances) ne sont pas appliquées sur staging.

Les RPC suivantes sont donc absentes sur staging :
- `admin_onboard_tenant_v2` (migration 0039)
- `admin_check_identity_available` (migration 0039)
- `admin_identity_v2_health` (migration 0039)
- `admin_invitation_preview` (migration 0036)
- `admin_accept_invitation` (migration 0036)
- `admin_record_delivery` (migration 0036)
- `admin_prepare_resend` (migration 0036)

### Conséquence

L'appel `supabase.functions.invoke("onboard-tenant", { body: payload })` échouera avec une erreur 503 car la fonction ne trouve pas les fonctions RPC nécessaires pour persister l'établissement, le Manager et l'abonnement.

---

## 6. ÉTAT DE CHAQUE ÉTAPE DU PARCOURS

| Étape | Composant | Statut | Blocage |
|---|---|---|---|
| Établissement | `onboarding/page.tsx` étape 1 | ✅ Code complet | Migration 0039 |
| Manager | `onboarding/page.tsx` étape 2 | ✅ Code complet | Migration 0039/0042 |
| Abonnement | `onboarding/page.tsx` étape 3 | ✅ Code complet | Migration 0039/0040 |
| Modules & permissions | `onboarding/page.tsx` étape 4 | ✅ Code complet | Migration 0039 |
| Transmission (invitation) | `onboarding/page.tsx` étape 5 | ✅ Code complet | Migration 0036 |
| Confirmation | `onboarding/page.tsx` étape 6 | ✅ Code complet | Migration 0036/0039 |
| Activation Manager | `activate-manager/index.ts` | ✅ Code complet | Migration 0036 |

---

## 7. CONCLUSION DE L'AUDIT

Le parcours de création d'abonné est **complet et cohérent côté code**. Aucune correction de code n'est nécessaire. Le seul blocage est l'absence des migrations 0036→0043 sur staging, qui empêche toute exécution réelle (E2E impossible).

**Le blocage est purement infrastructurel.** Aucune correction de code ne peut lever ce blocage.

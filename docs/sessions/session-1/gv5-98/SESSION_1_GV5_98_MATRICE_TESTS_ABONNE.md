# MATRICE DE TESTS E2E — SESSION_1 — GV5 §98

**Date** : 23 novembre 2026  
**Session** : SESSION_1  
**Mission** : GV5 §98 — Déblocage staging et validation du parcours d'abonnement  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `192979f` (synchronisé avec `origin/main`)

---

## 1. PRINCIPES

Les 26 scénarios E2E obligatoires ne peuvent pas être exécutés sur staging car les migrations 0036→0043 ne sont pas appliquées sur staging. Aucun test E2E n'a donc été exécuté.

Statuts possibles :
- ✅ **RÉUSSI** — Test exécuté et passé
- ❌ **ÉCHOUÉ** — Test exécuté et échoué
- ⏸ **BLOQUÉ** — Test non exécuté (migrations non appliquées sur staging)
- ⏭ **NON EXÉCUTÉ** — Test non encore planifié

---

## 2. MATRICE DE TESTS DE CRÉATION D'ABONNÉ (13 étapes)

| # | Étape | Action | Résultat attendu | État | Preuve |
|---|---|---|---|---|---|
| T1 | Connexion Super Admin | Session valide, rôle `saas_admin` | ⏸ BLOQUÉ | Migrations non appliquées |
| T2 | Ouverture création d'abonné | Formulaire 6 étapes affiché | ⏸ BLOQUÉ | Migrations non appliquées |
| T3 | Saisie établissement (nom, slug, identifiant pro, adresse, ville, région) | Données enregistrées en mémoire | ⏸ BLOQUÉ | Migrations non appliquées |
| T4 | Saisie Manager (prénom, nom, email, téléphone, login_id, mot de passe temporaire) | Données enregistrées en mémoire | ⏸ BLOQUÉ | Migrations non appliquées |
| T5 | Sélection formule STANDARD/SILVER/GOLD | Forfait sélectionné | ⏸ BLOQUÉ | Migrations non appliquées |
| T6 | Configuration durée payante (1, 3, 6 mois, 1 an, 2 ans, personnalisée) | Durée payante validée (1-120 mois) | ⏸ BLOQUÉ | Migrations non appliquées |
| T7 | Configuration durée d'essai (aucun, 7, 15, 30, 45, 60 jours, personnalisée) | Durée d'essai validée (0-365 jours), indépendante de la durée payante | ⏸ BLOQUÉ | Migrations non appliquées |
| T8 | Attribution modules et permissions | Modules du forfait sélectionnés, permissions cohérentes | ⏸ BLOQUÉ | Migrations non appliquées |
| T9 | Récapitulatif et confirmation | Toutes les informations affichées | ⏸ BLOQUÉ | Migrations non appliquées |
| T10 | Création de l'établissement | Établissement persistant dans Supabase, `professional_id` enregistré | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| T11 | Création du compte Auth Manager | Utilisateur Auth créé, email vérifié | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| T12 | Création du profil Manager associé | Profil lié à l'établissement, rôle `manager`, `login_id` enregistré | ⏸ BLOQUÉ | Migrations 0039/0042 non appliquées |
| T13 | Création de l'abonnement | Abonnement persistant, dates de début et de fin cohérentes, essai indépendant de la durée payante | ⏸ BLOQUÉ | Migrations 0039/0040 non appliquées |
| T14 | Création de l'invitation | Invitation préparée, token hashé SHA-256, statut `prepared` | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| T15 | Vérification du journal d'audit | Entrée `onboard_tenant_v2` tracée | ⏸ BLOQUÉ | Migration 0039 non appliquée |

---

## 3. SCÉNARIO D'ACTIVATION DU MANAGER (4 étapes)

| # | Étape | Action | Résultat attendu | État | Preuve |
|---|---|---|---|---|---|
| T14 | Manager clique sur le lien d'activation | Page d'activation affichée, prévisualisation sans consommation | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| T15 | Manager définit son propre mot de passe (≥ 10 caractères, lettre + chiffre) | Mot de passe défini via `auth.admin.updateUserById`, jamais stocké en clair | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| T16 | Manager se connecte | `signInWithPassword` réussi, session valide, rôle `manager` | ⏸ BLOQUÉ | Migration 0036/0039 non appliquée |
| T17 | Manager accède à son établissement | RLS isole, uniquement les données de son établissement accessibles | ⏸ BLOQUÉ | Migration 0036/0039 non appliquée |

---

## 4. TESTS NÉGATIFS À PRÉPARER

| # | Test | Résultat attendu | État | Preuve |
|---|---|---|---|---|
| N1 | Identifiant professionnel déjà utilisé | Erreur 409 explicite, pas de création en double | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N2 | E-mail Manager déjà utilisé | Erreur 409 explicite, pas de création | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N3 | Données obligatoires manquantes | Erreur de validation côté client, pas de soumission | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N4 | Données invalides (slug, email, téléphone) | Erreur de validation côté client | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N5 | Double-clic sur le bouton de création | Idempotence par `requestId`, pas de création en double | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N6 | Erreur RPC (PGRST202, fonction absente) | Message d'erreur explicite, pas d'état fantôme | ⏸ BLOQUÉ | Migration 0039 non appliquée |
| N7 | Erreur Edge Function | Message d'erreur compréhensible, pas de faux succès | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| N8 | Session expirée | Redirection vers la connexion | ⏸ BLOQUÉ | Migrations non appliquées |
| N9 | Invitation expirée | Message d'erreur explicite, pas d'activation | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| N10 | Invitation déjà utilisée | Message d'erreur explicite, pas de réactivation | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| N11 | Réémission d'une invitation | Nouveau token, ancien lien invalide | ⏸ BLOQUÉ | Migration 0036 non appliquée |
| N12 | Tentative d'accès à un autre établissement | RLS bloque, accès refusé | ⏸ BLOQUÉ | Migrations 0036/0039 non appliquées |
| N13 | Utilisateur sans permission | Accès refusé, message explicite | ⏸ BLOQUÉ | Migrations 0036/0039 non appliquées |
| N14 | Échec de transmission par fournisseur (Resend/WhatsApp) | Statut `non_configure`, création durable malgré tout | ⏸ BLOQUÉ | Migration 0036 non appliquée, secrets absents |

---

## 5. MATRICE DE COUVERTURE

| Domaine | Créé | Modifié | Suspendu | Réactivé | Changement d'offre | Invitation | Activation | Connexion | Isolation |
|---|---|---|---|---|---|---|---|---|---|
| Création abonné | ❌ (bloqué 0039) | — | — | — | — | — | — | — | — |
| Création Manager | ❌ (bloqué 0039/0042) | — | — | — | — | — | — | — | — |
| Abonnement | — | ❌ (bloqué 0039/0040) | — | — | ❌ (bloqué 0039/0040) | — | — | — | — |
| Invitation | — | — | — | — | — | ❌ (bloqué 0036) | — | — | — |
| Activation | — | — | — | — | — | — | ❌ (bloqué 0036/0039) | — | — |
| Connexion Manager | — | — | — | — | — | — | — | ❌ (bloqué 0036/0039) | — |
| Isolation inter-tenant | — | — | — | — | — | — | — | — | ❌ (bloqué 0036/0039) |

---

## 6. TESTS TECHNIQUES LOCAUX (EXÉCUTÉS)

| # | Test | Commande | Résultat | Preuve |
|---|---|---|---|---|
| TL1 | TypeScript | `npx tsc --noEmit` | 0 erreur | ✅ |
| TL2 | ESLint | `npx eslint .` | 0 erreur, 19 warnings préexistants | ✅ |
| TL3 | Tests unitaires | `npm test` | 176/176 passés, 0 échec | ✅ |
| TL4 | Build Next.js | `npm run build` | Succès, 67 pages statiques | ✅ |
| TL5 | Tests géographie Maroc | `node --test scripts/test-maroc-geographie.mjs` | 18/18 passés, 0 échec | ✅ |

---

## 7. CONCLUSION

Tous les 26 scénarios E2E sont **bloqués** par l'absence des migrations 0036→0043 sur staging. Aucun test E2E n'a pu être exécuté. Les seuls tests exécutés sont les tests unitaires locaux (176/176) et les tests de géographie Maroc (18/18), qui ne constituent pas une preuve de fonctionnement en bout en bout.

**La validation E2E nécessite l'application des migrations 0036→0043 sur staging (autorisation propriétaire requise) et le basculement de `.env.local` vers staging.**

# MATRICE DE TESTS E2E — SESSION_1 — GV5 §98

**Date** : 23 novembre 2026  
**Session** : SESSION_1  
**Mission** : GV5 §98 — Déblocage staging et validation du parcours d'abonnement  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `6fbd571` (synchronisé avec `origin/main`)

---

## 1. CONDITION PRÉALABLE

Aucun test E2E n'a été exécuté sur staging pendant SESSION_1 car les migrations 0036→0043 ne sont pas appliquées sur staging et `.env.local` pointe sur Production (lecture seule). L'exécution des tests E2E nécessite une autorisation propriétaire pour basculer l'environnement et appliquer les migrations.

---

## 2. SCÉNARIO DE CRÉATION D'ABONNÉ (13 étapes)

| # | Étape | Action | Résultat attendu | État | Preuve |
|---|---|---|---|---|---|
| T1 | Connexion Super Admin | Session valide, rôle `saas_admin` | Non testé (staging bloqué) | — |
| T2 | Ouverture création d'abonné | Formulaire 6 étapes affiché | Non testé (staging bloqué) | — |
| T3 | Saisie établissement (nom, slug, identifiant pro, adresse, ville, région, pays) | Données enregistrées en mémoire | Non testé (staging bloqué) | — |
| T4 | Saisie Manager (prénom, nom, email, téléphone, login_id, mot de passe temporaire) | Données enregistrées en mémoire | Non testé (staging bloqué) | — |
| T5 | Sélection formule STANDARD/SILVER/GOLD | Forfait sélectionné, modules du forfait affichés | Non testé (staging bloqué) | — |
| T6 | Configuration durée payante (1, 3, 6 mois, 1 an, 2 ans, personnalisée) | Durée payante validée (1-120 mois) | Non testé (staging bloqué) | — |
| T7 | Configuration durée d'essai (aucun, 7, 15, 30, 45, 60 jours, personnalisée) | Durée d'essai validée (0-365 jours), indépendante de la durée payante | Non testé (staging bloqué) | — |
| T8 | Attribution modules et permissions | Modules du forfait sélectionnés, permissions cohérentes (canView/canCreate/canEdit/canDelete) | Non testé (staging bloqué) | — |
| T9 | Récapitulatif et confirmation | Toutes les informations affichées, identifiants non secrets, statut de l'invitation affiché | Non testé (staging bloqué) | — |
| T10 | Création de l'établissement | Établissement persistant dans Supabase, `professional_id` enregistré | **BLOQUÉ (migration 0039)** | — |
| T11 | Création du compte Auth Manager | Utilisateur Auth créé, email vérifié | **BLOQUÉ (migration 0039)** | — |
| T12 | Création du profil Manager associé | Profil lié à l'établissement, rôle `manager`, `login_id` enregistré | **BLOQUÉ (migration 0039/0042)** | — |
| T13 | Création de l'abonnement | Abonnement persistant, dates de début et de fin cohérentes, essai indépendant de la durée payante | **BLOQUÉ (migration 0039/0040)** | — |
| T14 | Création de l'invitation | Invitation préparée, token hashé SHA-256, statut `prepared` | **BLOQUÉ (migration 0036)** | — |
| T15 | Vérification du journal d'audit | Entrée `onboard_tenant_v2` tracée | **BLOQUÉ (migration 0039)** | — |

---

## 3. SCÉNARIO D'ACTIVATION DU MANAGER (4 étapes)

| # | Étape | Action | Résultat attendu | État | Preuve |
|---|---|---|---|---|---|
| T14 | Manager clique sur le lien d'activation | Page d'activation affichée, prévisualisation sans consommation | Non testé (staging bloqué) | — |
| T15 | Manager définit son propre mot de passe (≥ 10 caractères, lettre + chiffre) | Mot de passe défini via `auth.admin.updateUserById`, jamais stocké en clair | Non testé (staging bloqué) | — |
| T16 | Manager se connecte | `signInWithPassword` réussi, session valide, rôle `manager` | Non testé (staging bloqué) | — |
| T17 | Manager accède à son établissement | RLS isole, uniquement les données de son établissement accessibles | Non testé (staging bloqué) | — |

---

## 4. TESTS NÉGATIFS À PRÉPARER

| # | Test | Résultat attendu | État | Preuve |
|---|---|---|---|---|
| N1 | Identifiant professionnel déjà utilisé | Erreur 409 explicite, pas de création en double | Non testé (staging bloqué) | — |
| N2 | E-mail Manager déjà utilisé | Erreur 409 explicite, pas de création | Non testé (staging bloqué) | — |
| N3 | Données obligatoires manquantes | Erreur de validation côté client, pas de soumission | Non testé (staging bloqué) | — |
| N4 | Données invalides (slug, email, téléphone) | Erreur de validation côté client | Non testé (staging bloqué) | — |
| N5 | Double-clic sur le bouton de création | Idempotence par `requestId`, pas de création en double | Non testé (staging bloqué) | — |
| N6 | Erreur RPC (PGRST202, fonction absente) | Message d'erreur explicite, pas d'état fantôme | Non testé (staging bloqué) | — |
| N7 | Erreur Edge Function | Message d'erreur compréhensible, pas de faux succès | Non testé (staging bloqué) | — |
| N8 | Session expirée | Redirection vers la connexion | Non testé (staging bloqué) | — |
| N9 | Invitation expirée | Message d'erreur explicite, pas d'activation | Non testé (staging bloqué) | — |
| N10 | Invitation déjà utilisée | Message d'erreur explicite, pas de réactivation | Non testé (staging bloqué) | — |
| N11 | Réémission d'une invitation | Nouveau token, ancien lien invalide | Non testé (staging bloqué) | — |
| N12 | Tentative d'accès à un autre établissement | RLS bloque, accès refusé | Non testé (staging bloqué) | — |
| N13 | Utilisateur sans permission | Accès refusé, message explicite | Non testé (staging bloqué) | — |
| N14 | Échec de transmission par fournisseur (Resend/WhatsApp) | Statut `non_configure`, création durable malgré tout | Non testé (staging bloqué) | — |

---

## 5. TESTS TECHNIQUES LOCAUX (EXÉCUTÉS)

| # | Test | Commande | Résultat | Preuve |
|---|---|---|---|---|
| TL1 | TypeScript | `npx tsc --noEmit` | 0 erreur | ✅ |
| TL2 | ESLint | `npx eslint .` | 0 erreur, 19 warnings préexistants | ✅ |
| TL3 | Tests unitaires | `npm test` | 176/176 passés, 0 échec | ✅ |
| TL4 | Build Next.js | `npm run build` | Succès, 67 pages statiques | ✅ |
| TL5 | Tests géographie Maroc | `node --test scripts/test-maroc-geographie.mjs` | 18/18 passés, 0 échec | ✅ |

---

## 6. TESTS NON EXÉCUTÉS (RAISONS)

| # | Test | Raison |
|---|---|---|
| TN1 | Tests E2E sur staging | Migrations 0036→0043 non appliquées sur staging, `.env.local` pointe sur Production |
| TN2 | Tests RLS sur staging | Accès base staging non disponible |
| TN3 | Tests d'isolation multi-tenant sur staging | Accès base staging non disponible |
| TN4 | Tests Edge Functions | Aucun outil d'invocation directe disponible |
| TN5 | Tests d'intégration avec fournisseurs (Resend, WhatsApp, Stripe) | Secrets non configurés |

---

## 7. MATRICE DE COUVERTURE

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

## 8. CONCLUSION

Tous les tests E2E sont **bloqués** par l'absence des migrations 0036→0039 sur staging. Aucun test E2E n'a pu être exécuté. Les seuls tests exécutés sont les tests unitaires locaux (176/176) et les tests de géographie Maroc (18/18), qui ne constituent pas une preuve de fonctionnement en bout en bout.

**La validation E2E nécessite l'application des migrations 0036→0043 sur staging (autorisation propriétaire requise) et le basculement de `.env.local` vers staging.**

# Préparation du parcours d’onboarding réel (12 étapes) — gel P0

> **Statut : PRÉPARÉ / NON VALIDÉ EN RÉEL.** Le gel P0 interdit toute mutation distante, création/modification de comptes ou données réelles, déploiement Edge Function, modification Auth/SMTP/secrets, et toute migration. Ce document décrit le parcours cible, les contrôles requis et les preuves attendues **après** autorisations et exécution contrôlée. **Aucun mot de passe en clair** ne doit être créé, transmis, stocké ou consigné.

## Artefacts locaux pertinents (faits vérifiés)
- Edge Function : `supabase/functions/onboard-tenant/index.ts` (source prête, non déployée) — séparation caller/admin, validation JWT + profil `saas_admin` actif, validation inputs, idempotence `requestId`/`admin_find_onboarding_request`, anti-doublon email, invitation Auth (pas de mot de passe en clair), appel `admin_onboard_tenant`, compensation suppression user invité en cas d’erreur RPC.
- Migrations/RPC préparées : `0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql`, `supabase/apply/0028_apply_minimal.sql` (idempotence, validations, création entreprise/établissement/abonnement/profil manager, audit).
- UI/onboarding et helpers locaux : `src/app/super-admin/onboarding/page.tsx`, `src/lib/onboarding.ts`, tests `scripts/test-onboarding.mjs` (logique locale validée) ; E2E mock vérifie présence formulaire (simulation, non réel).
- Guides/plans : `supabase/apply/GUIDE_EXECUTION_MIGRATIONS_PENDING.md`, `0032_PLAN_PENDING_MIGRATIONS.sql`.

## Parcours cible (12 étapes)

| # | Étape | Rôle/acteur autorisé | Actions & contrôles requis (cible) | Résultat attendu | Preuves attendues (après exécution autorisée) | Statut préparation |
|---|---|---|---|---|---|---|
| 1 | Création de l’entreprise abonnée | `saas_admin` authentifié | Saisie validée (nom, identifiants), appel via EF/RPC sécurisé, garde serveur `is_saas_admin()` | Entreprise/tenant créé sans doublon incohérent | Enregistrement DB, audit_log, réponse API/trace (sans secrets) | IMPLÉMENTÉ MAIS NON VALIDÉ (source/prépa) |
| 2 | Choix du métier | `saas_admin` | Sélection métier/type conforme aux règles, persistée côté serveur | Métier associé correctement | Champ/liaison DB, UI cohérente | IMPLÉMENTÉ MAIS NON VALIDÉ (selon modèle effectif) |
| 3 | Création du Manager (identité) | `saas_admin` | Données manager validées, email normalisé/unique selon règles, **aucun mot de passe en clair** | Compte manager préparé/invité | Profil/enregistrement attendu, absence de secret en clair | IMPLÉMENTÉ MAIS NON VALIDÉ |
| 4 | Sélection du forfait | `saas_admin` | Forfait valide (plans existants), limites/essai conformes, contrôle serveur | Forfait/abonnement cohérents | `subscriptions`/liaisons, audit | IMPLÉMENTÉ MAIS NON VALIDÉ |
| 5 | Création de l’établissement | `saas_admin` | Établissement rattaché au bon tenant, slug/contraintes respectés, isolation | Établissement créé et isolé | Ligne `establishments` + FK cohérentes | IMPLÉMENTÉ MAIS NON VALIDÉ |
| 6 | Préparation de l’abonnement | `saas_admin`/système autorisé | Statut/dates/période d’essai cohérents, idempotence | Abonnement actif/trial conforme | `subscriptions` (+ audit si prévu) | IMPLÉMENTÉ MAIS NON VALIDÉ |
| 7 | Invitation sécurisée | Système (EF/service) sous contrôle SA | Invitation **unique, temporaire, à usage unique**, lien/token géré par Auth fournisseur, pas de secret exposé | Invitation envoyée/reçue par canal configuré | Logs d’envoi côté fournisseur/Auth (autorisés), statut invitation, expiration/usage | BLOQUÉ PAR AUTORISATION/DÉPENDANCE (EF/Auth/SMTP non configurés/déployés) |
| 8 | Définition du mot de passe par le Manager | Manager invité | Le manager définit son propre mot de passe via flux Auth sécurisé (reset/set), jamais communiqué au SA/en clair | Mot de passe connu du seul manager, politique respectée | Confirmation Auth (sans secret), impossibilité de lecture du mot de passe | BLOQUÉ PAR AUTORISATION/DÉPENDANCE (Auth/SMTP/Redirect URLs) |
| 9 | Activation du compte | Manager / système | Activation après invitation valide/non expirée/non réutilisée | Compte actif et utilisable | État profil/utilisateur actif, journal si prévu | BLOQUÉ (dépend 7–8) |
| 10 | Accès au tableau de bord professionnel | Manager authentifié | Auth + rôle correct + tenant correct, refus si inactif/suspendu/non autorisé | Redirection/accès au dashboard pro attendu | Session valide, RLS/isolation respectée, UI correcte | BLOQUÉ (dépend activation réelle) |
| 11 | Création des employés | Manager (et/ou SA selon règles) | Création dans le bon établissement, rôles/permissions assignés, contrôles serveur | Employés rattachés au bon tenant | Lignes profils/employés, permissions, audit si prévu | IMPLÉMENTÉ MAIS NON VALIDÉ (côté UI/code) / BLOQUÉ pour preuve réelle |
| 12 | Attribution et vérification des permissions | Manager/SA selon matrice | Droits par entreprise/établissement/module, principe de moindre privilège, refus par défaut | Permissions effectives conformes, pas d’accès cross-tenant | Tests d’accès autorisé/refusé, preuves RLS/RBAC serveur | BLOQUÉ (validation serveur réelle requise) |

## Contrôles de sécurité obligatoires (cible)
- **Anti-doublons / idempotence** : `requestId` unique, retry sans duplication entreprise/abonnement/profil (prévu en 0028/EF).
- **Anti-orphelins** : compensation/rollback logique si étape critique échoue (ex. invitation créée mais onboarding DB échoue) — à valider en réel.
- **Invitations** : uniques, temporaires, à usage unique, invalidation après usage/expiration, canaux sécurisés.
- **Mots de passe** : jamais en clair, jamais loggés, jamais stockés côté app ; définis par l’utilisateur final via Auth.
- **Isolation** : toute donnée/action strictement limitée au tenant/établissement/rôle autorisé (RLS + contrôles serveur).
- **Audit** : journaliser opérations sensibles (création tenant, changement rôle/statut, abonnements, etc.).

## Dépendances et blocages (gel P0 / externes)
| Dépendance | Impact | Statut |
|---|---|---|
| Application migrations 0028 (+ dépendances/0032 selon plan) | RPC/onboarding_requests requis | BLOQUÉ PAR GEL P0 / AUTORISATION |
| Déploiement `onboard-tenant` | Exécution sécurisée serveur | BLOQUÉ |
| Configuration Auth (Redirect URLs, politiques) / SMTP / domaines | Invitations, reset, activation | BLOQUÉ |
| Secrets/config serveur (non exposés) | EF/service role | BLOQUÉ |
| Comptes et données de test isolés | Validation sans production | BLOQUÉ / à prévoir après autorisation |
| Audit read-only de l’état distant | Confirmer prérequis réels | BLOQUÉ |

## Tests prévus (après levée ciblée et environnement isolé)
- Parcours nominal 1→12 complet avec compte test isolé.
- Idempotence : même `requestId`/retry → aucun doublon.
- Email manager déjà existant → refus contrôlé.
- Invitation expirée/réutilisée → refus.
- Compte inactif/suspendu → accès refusé.
- Tentatives cross-tenant/cross-rôle → refus serveur/RLS.
- Non-régression UI/flows SA existants.

**Conclusion** : onboarding **préparé** (code/migrations/EF/procédures) mais **non validé en conditions réelles** ; aucune étape distante exécutée.

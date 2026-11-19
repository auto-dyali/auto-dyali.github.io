# GV5 §70 — Rapport final : premier accès Manager réel

Date : 18 novembre 2026. Branche `main` @ `64359da`. Cible : STAGING `yocufscgninxiihwiepa` (confirmée par get_project_url).

## 1. Résultat principal

**CRITÈRE DE RÉUSSITE ATTEINT SUR LE STAGING** : un établissement professionnel et son Manager ont été **réellement** créés, invités (jeton hashé), activés (mot de passe choisi par le Manager) et connectés, avec permissions et isolation multi-tenant vérifiées par appels HTTP réels à Supabase.

## 2. Travaux réellement terminés

- OAuth MCP débloqué (cible staging confirmée).
- Schéma staging appliqué : 33 tables, plans/features, RPC admin, onboarding_requests, invitations, colonnes identité, RPC v2.
- 3 Edge Functions v2 déployées (onboard-tenant, activate-manager, send-invitation).
- Parcours complet exécuté avec preuves HTTP : création → ID pro → Auth → liaison → invitation → preview → activation → connexion → droits → isolation.
- EF temporaire create-test-user utilisée pour créer un compte Auth propre (à retirer manuellement).

## 3. Tests (résultats exacts)

| Test | Résultat |
|---|---|
| Connexion Manager HTTP | 200, token valide |
| Lecture propre établissement | Garage Réel Test / ADY-PRO-DEF456 / gold |
| Accès autre établissement | `[]` (RLS isolation) |
| Preview activation EF | 200, jeton non consommé |
| Activation EF | 200, status=activated |
| Réutilisation jeton | refusée (usage unique) |
| npm test / build / tsc | 158/158, OK, OK |

## 4. État

| Élément | État |
|---|---|
| Premier Manager réel | **CRÉÉ, ACTIVÉ, CONNECTÉ (staging)** |
| Invitation e-mail réelle | NON (secret absent, statut honnête) |
| Invitation WhatsApp réelle | NON (secrets absents) |
| Migrations appliquées | STAGING uniquement |
| Production | intacte, aucune opération |

## 5. État Git

`main` @ `64359da`, 65 entrées, 0 commit, 0 push. Aucun module Manager/Garage/POS/Stock modifié localement. Aucune opération distante non autorisée.

## 6. Blocages restants

Secrets Resend/Meta (B1/B2), destinataire de test réel (B3), retrait EF temporaire (B4), sécurité SQL 0037 (B5), autorisation distincte production (B6).

AUTO DYALI : le Super Admin est maintenant **réellement opérationnel sur staging**. Validation production en attente d autorisation explicite.

# GV5 §70 — Preuves de tests RÉELS (staging Supabase)

Date : 18 novembre 2026. Cible confirmée : `https://yocufscgninxiihwiepa.supabase.co` (get_project_url). Aucune opération sur la production.

## 1. Environnement staging préparé

| Élément | Résultat réel |
|---|---|
| Migrations appliquées (staging) | schéma fondation + plans/features/subscriptions + RPC admin + onboarding_requests + invitations + colonnes identité + RPC v2 (33 tables, 13 RPC admin) |
| Edge Functions déployées | onboard-tenant (v1), activate-manager (v1), send-invitation (v1) — toutes ACTIVE |
| EF temporaire `create-test-user` | déployée pour créer un compte Auth proprement — **à retirer manuellement** (aucun outil MCP de suppression) |

## 2. Parcours réel — Premier abonné professionnel

| Étape | Preuve réelle |
|---|---|
| Création établissement via RPC v2 | `establishment_id=e8259c8a...` puis `3c96745a...` |
| Identifiant professionnel | `ADY-PRO-ABC123` / `ADY-PRO-DEF456` (unicité vérifiée) |
| Création Manager Auth | via EF create-test-user → ID `25ed11b5-...` (Auth Admin réel) |
| login_id | `mgr.reel.test` |
| Abonnement | `silver/trial` et `gold/trial` (paid_months 12 et 24, trial 15 et 30) |
| Permissions | 6 et 8 lignes CRUD réelles |
| Invitation | `6d75f553-...`, statuts email/whatsapp `en_attente` |
| Journal | entrée `onboard_tenant_v2` dans audit_log |
| Idempotence | 2 appels même requestId → 1 seul établissement |

## 3. Activation et connexion réelles

| Test | Résultat |
|---|---|
| Preview EF activate-manager | HTTP **200**, infos invitation sans consommation (statut reste `prepared`) |
| Activation EF (mot de passe choisi par Manager) | HTTP **200** `status=activated`, `must_change_password=false` |
| Réutilisation jeton (2e activation) | échec « Invitation déjà utilisée » (usage unique) |
| Connexion Manager (nouveau mot de passe) | HTTP **200**, token d accès valide |
| Lecture SET établissement (JWT Manager) | HTTP 200 → Garage Réel Test / ADY-PRO-DEF456 / gold |
| Accès SET autre établissement (JWT Manager) | HTTP 200 → **`[]`** (isolation RLS démontrée) |
| Profil via JWT | `role=manager`, `must_change_password=false`, bon establishment_id |
| Permissions via JWT | 8 modules CRUD exacts |
| my_features() via JWT | 31 fonctionnalités du plan gold |

## 4. Tests locaux (exit codes)

| Commande | Résultat | Exit |
|---|---|---|
| npx tsc --noEmit | succès | 0 |
| npm test | 158/158 pass | 0 |
| npm run build | Compiled successfully | 0 |

NOTE : l envoi réel e-mail/WhatsApp n a PAS été testé (secrets RESEND_API_KEY / WHATSAPP_* absents). Les statuts restent honnêtes `en_attente`. Le destinataire utilisé est un domaine de test synthétique `.local`.

# AUTO DYALI — Plan de migration vers la production (GV5 §84)

> **Non autorisé à ce jour.** Aucune opération ci-dessous n'a été exécutée sur `nxmsqqoflskfajqrqddw`. Ce plan est soumis au propriétaire pour validation explicite avant toute écriture.

## 1. Faits vérifiés

| Élément | Staging `yocufscgninxiihwiepa` | Production `nxmsqqoflskfajqrqddw` (sondage HTTP lecture seule) |
|---|---|---|
| `establishments.professional_id` | présent | **42703 colonne absente** |
| `profiles.login_id`, `profiles.must_change_password` | présents | **42703 colonnes absentes** |
| `onboarding_requests.invitation_id` | présent | **42703 colonne absente** |
| `invitations` / `token_hash` | présents | **PGRST205 table absente** |
| `admin_check_identity_available` | présent, `authenticated` | **404 PGRST202** |
| `admin_onboard_tenant_v2` | présent | **404 PGRST202** |
| `get_my_security_state`, `resolve_login_email`, `must_change_password`, `has_feature` | présents | **404 PGRST202** |
| `get_my_profile`, `is_saas_admin`, `my_features` | présents | présents (401 / 200 selon privilège) |
| `admin_identity_v2_health` | présent (gv583) | **404 PGRST202** |
| `admin_get_abonne_details`, `admin_set_permissions`, `admin_record_delivery`, `admin_find_onboarding_request` | présents | **404 PGRST202** |
| `pre_purchase_requests`, `saas_billing_events` | présents | **PGRST205 tables absentes** |
| `plan_features`, `permissions`, `audit_log`, `subscriptions`, `plans` | présents | présents (401 RLS en anonyme) |
| Migrations appliquées | 29 (dont 0039a/b, 0036b/c, gv575→gv583) | base ancienne uniquement (au moins 0003/0009/0010/0028) |
| Edge Functions | 5 (onboard v2, send-invitation v2, activate v1, stripe-webhook v1, create-test-user v3 inerte) | **versions non vérifiables** via les outils disponibles |

**Cause racine** : la production n'a jamais reçu les migrations 0036/0039 ni les correctifs suivants. Le frontend, pointé sur la production par défaut (`.env.local`), a donc rencontré PGRST202 — d'où l'incident §83.

## 2. Plan d'application (ordre strict)

| # | Opération | Risque | Vérification après application |
|---|---|---|---|
| 0 | **Sauvegarde + PITR vérifié** par le propriétaire dans le dashboard Supabase | Élevé si omis | Capture de la date de restauration possible + export des tables critiques |
| 1 | `0036_invitations_manager_prepared_NOT_APPLIED.sql` | Moyen : crée tables/RPC, préconditions 0028 + `pgcrypto` | `select to_regclass('public.invitations')` non null ; RPC `admin_invitation_preview` exécutable |
| 2 | `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | **Élevé** : policies restrictives `password_rotation_required` sur toutes les tables avec `establishment_id` | `admin_identity_v2_health()` renvoie tous `true` ; aucun Manager existant n'a `must_change_password=true` par erreur |
| 3 | `0033` + `0035` (demandes de souscription) | Faible : `create table if not exists` | `submit_pre_purchase_request` idempotent ; lecture anonyme `[]` |
| 4 | `supabase/security/remediation_075/*` (RPC espace abonné, champs admin, correctifs) | Moyen : `create or replace` + révocations | `anon_exec=false` sur RPC admin ; `is_saas_admin()` = coalesce |
| 5 | `remediation_076/*` (champs admin à la création) | Faible | `admin_onboard_tenant_v2` inscrit bien les 6 colonnes |
| 6 | `remediation_077/*` (révocation anon/public) | Faible | advisors : plus de RPC admin exposée à anon |
| 7 | `remediation_579/*` (demandes, colonnes POS, facturation SaaS) | Moyen | `products.stock` présent ; `saas_billing_events` présent |
| 8 | `remediation_580/*` (purge) | Faible | `admin_purge_establishment` SA seul |
| 9 | `remediation_583/*` (diagnostic) | Faible | `admin_identity_v2_health()` accessible SA uniquement |
| 10 | Déployer EF `onboard-tenant` version avec le message corrigé, `send-invitation` v2, `activate-manager` v1, `stripe-webhook` v1 | Moyen : secrets à configurer séparément | Réponses HTTP attendues ; `stripe-webhook` 503 si secret absent |
| 11 | Configurer les secrets fournisseurs **côté Supabase** (Resend, Meta, Stripe) | Élevé si erreur de saisie | Aucun secret affiché ; Statuts réels observés |
| 12 | Renseigner les tarifs via `scripts/configure-plans.mjs` avec valeurs propriétaire | Élevé si prix erroné | `price_monthly`/`price_yearly` non nuls |

## 3. Retour arrière

- Chaque migration `gv57x/gv58x` a un `*_down.sql`.
- Les migrations 0036/0039 n'ont pas de `*_down.sql` : le rollback repose sur **PITR** ou sur une copie de la base avant application.
- Procédure : arrêt des écritures → restauration PITR vers le point antérieur → vérification des comptes Auth et des données métier → réouverture.

## 4. Contrôles post-déploiement

1. `admin_identity_v2_health()` → tous `true`.
2. Création contrôlée d'un garage **synthétique** depuis le Super Admin.
3. Vérification SQL : établissement, profil Manager rattaché, abonnement avec essai/payant corrects, permissions = sous-ensemble de la formule, invitation préparée.
4. Activation du Manager par lien signé si fournisseur configuré ; sinon statut honnête `non_configure`.
5. Connexion réelle du Manager, accès à son garage, refus d'un autre garage et des RPC Super Admin.
6. Isolation entre deux garages ; journaux d'audit cohérents.
7. `get_advisors` sans nouvelle alerte critique ; `npm audit --omit=dev` = 0.

## 5. Refus explicite

Tant que le propriétaire n'a pas validé ce plan **et** confirmé la sauvegarde/PITR, aucune commande de cette section n'est exécutée. La frontend bloque désormais la création sur un environnement non migré (préflight `admin_identity_v2_health`).

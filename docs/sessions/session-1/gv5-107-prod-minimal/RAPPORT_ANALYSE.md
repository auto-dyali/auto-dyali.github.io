# GV5 §107-PROD-MINIMAL — Étape 1 : analyse en lecture seule

Branche : `gv5-107-prod-minimal`, créée depuis `bfc47c2` (source validée). `main` = `81ca143`. **Aucune écriture en production.**

## 1. Diagnostic : localisation exacte

- Fichier cité par le message : `supabase/migrations/0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql`.
- **La RPC de diagnostic `admin_identity_v2_health()` n'est PAS définie dans 0039.** Elle est définie dans `supabase/security/remediation_583/001_identity_health.sql` puis versionnée dans `supabase/migrations/20261124132000_reconcile_manager_onboarding.sql` (section 5) lors de la clôture §101.
- Le message affiché vient de `src/app/super-admin/onboarding/page.tsx` lignes 312-319 : `supabase.rpc("admin_identity_v2_health")` ; si l'erreur est `PGRST202`/`could not find the function`, le front affiche « Environnement non compatible : la RPC de diagnostic est absente… migration 0039 ».
- Vérification conservée : Elle est bien un préflight bloquant (`useEffect` lignes 307-330, message lignes 635/1010). **Aucune modification du front n'est prévue ni autorisée.**

### Ce que vérifie la RPC (lecture seule)
`SECURITY DEFINER`, `search_path=public`, refus si `coalesce(is_saas_admin(),false) <> true`, puis renvoie 9 booléens : colonnes `establishments.professional_id`, `profiles.login_id`, `profiles.must_change_password`, fonctions `admin_check_identity_available`, `admin_onboard_tenant_v2`, `get_my_profile`, `get_my_security_state`, `resolve_login_email`, `must_change_password`.

Droits : `REVOKE ALL … FROM public, anon` ; `GRANT EXECUTE … TO authenticated`. Aucun appel anon possible.

## 2. Dépendances de 0039 et du parcours complet

0039 exige : tables `invitations` (0036), `onboarding_requests` (0028), `permissions` (0001), fonction `is_saas_admin()`, plan_features (0009), et les colonnes qu'il ajoute lui-même. Le parcours complet utilise en plus :
- front : `plans`, `plan_features`, `admin_check_identity_available`, `admin_identity_v2_health`, EF `onboard-tenant` ;
- EF `onboard-tenant` v3 : `admin_find_onboarding_request`, `admin_check_identity_available`, `admin_find_user_id_by_email`, `admin_onboard_tenant_v2`, `admin_record_delivery`, table `invitations`, table `profiles` ;
- fiche/invitation : `admin_update_establishment`, `admin_update_manager`, `admin_set_permissions`, `admin_invitation_preview`, `admin_accept_invitation`, `admin_prepare_resend`, `send-invitation`, `activate-manager`.

## 3. Comparaison avec la PRODUCTION (schéma seul, lecture seule)

| Objet | Production | Nécessaire au parcours |
|---|---|---|
| `establishments` | présent | oui |
| `profiles`, `subscriptions`, `permissions`, `plans`, `plan_features`, `onboarding_requests`, `audit_log` | présents | oui |
| `invitations`, `invitation_events` | **absents** | oui |
| `establishments.professional_id/legal_name/activity_type/region/notes` | **absents** | oui |
| `profiles.login_id/must_change_password/temporary_*` | **absents** | oui |
| `admin_identity_v2_health` | **absent** | oui (diagnostic) |
| `admin_check_identity_available` | **absent** | oui |
| `admin_onboard_tenant_v2` | **absent** | oui |
| `admin_find_onboarding_request`, `admin_find_user_id_by_email`, `admin_record_delivery` | **absents** | oui |
| `get_my_security_state`, `resolve_login_email`, `must_change_password`, `my_permissions`, `has_feature`, `admin_complete_password_change` | **absents** | oui |
| `get_my_profile`, `my_features`, `is_saas_admin`, `current_establishment_id`, `is_manager` | présents | oui |
| EF `onboard-tenant` | v1 (ancien contrat) | à remplacer par v3 |
| EF `send-invitation`, `activate-manager` | **absentes** | oui |
| `supabase_migrations.schema_migrations` | **absent** (aucune version) | baseline à décider |
| Storage buckets | 0 | non requis pour la création d'établissement |

Aucun objet superflu n'est nécessaire : ni les tables §108 (plan_prices, quotas, storage_files…), ni les 16 tables manquantes non liées au parcours (devis, cheques, vehicle_catalog…).

## 4. Conclusion — migrations correctives MINIMALES

Une seule migration corrective, horodatée après la dernière version connue, idempotente et réversible dans la mesure du possible :

`20261125100000_prod_minimal_onboarding.sql`
- `CREATE TABLE IF NOT EXISTS invitations`, `invitation_events` (reprises de 0036) ;
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` sur `establishments` et `profiles`, plus `onboarding_requests.invitation_id` ;
- index uniques `IF NOT EXISTS` ;
- `CREATE OR REPLACE FUNCTION` pour les 11 RPC listées ci-dessus, avec `REVOKE`/`GRANT` explicites (diagnostic réservé à `authenticated` + garde `is_saas_admin()`) ;
- policies RLS `DROP POLICY IF EXISTS` + `CREATE POLICY` sur `invitations`/`invitation_events` uniquement.

Aucune modification des 2 garages, des 2 abonnements, du profil Super Admin, des plans existants, de `main` ou de la configuration Pages. Aucun `db push` global.

Déploiements associés (après GO-3) : `onboard-tenant` v3, `send-invitation`, `activate-manager`.

Historique des migrations en production : aucune table `supabase_migrations` n'existe. Stratégie proposée, **sans rien écrire sans accord** : créer une table d'historique et enregistrer une seule version `baseline` représentant l'état actuel de production, puis enregistrer la version de la migration corrective. À valider explicitement (GO-3).

## 5. BLOQUÉ

- GO-3 requis avant toute écriture en production.
- Session Super Admin production : le propriétaire est le seul à l'ouvrir ; aucun reset, aucun JWT forgé.
- Fournisseur e-mail production vide : envoi réel d'invitation reste BLOQUÉ ; préparation seule testable.

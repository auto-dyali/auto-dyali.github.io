# PLAN DE DÉPLOIEMENT PRODUCTION — GV5 §104

**Statut : DOCUMENT UNIQUEMENT. Aucune migration, aucun secret, aucun déploiement n'a été appliqué en production dans le cadre de cette mission.**
Projet production : `nxmsqqoflskfajqrqddw` (lecture seule pendant GV5 §101–§104).

---

## 1. Prérequis (décisions du propriétaire)

1. **Sauvegarde complète** : dump logique + PITR vérifié, horodaté, conservé hors du projet. Aucune migration ne doit démarrer sans cette preuve.
2. **Fenêtre de maintenance** : les migrations 0001/0036/0039/0043 prennent des verrous sur `establishments`, `profiles`, `invitations`, `subscriptions`. Prévoir une fenêtre et prévenir les utilisateurs.
3. **Copie de production** : rejouer l'intégralité du plan sur une copie et exécuter les smoke tests §5 avant la production.
4. **Décision sur l'historique des migrations** : l'historique distant de production est ad hoc et ne correspond pas aux fichiers locaux. `supabase db push` est **interdit** (DbPushMissingLocalError / risque de rejouer tout le schéma). Application fichier par fichier via `supabase db query --remote=<ref> --file=<fichier>`, sous réserve de validation sur copie.
5. **Décision sur les RPC hors migrations** : `supabase/security/remediation_075`, `076`, `583` ne sont pas dans `supabase/migrations/`. Certaines fonctions ont été intégrées dans 0040/0043 ; les réconciliations §101 sont désormais versionnées dans `20261124132000_reconcile_manager_onboarding.sql` (§105). Un inventaire complet doit être validé avant production.
6. **Décision tarifaire** : `GV581_*_MENSUEL/ANNUEL` non fournis ; les prix resteront NULL.
7. **Décision fournisseur e-mail** : aucun secret Resend/WhatsApp ; l'activation par lien réel reste non testable.

---

## 2. Migrations ordonnées et risques

| Ordre | Fichier(s) | Risque principal | Réversible |
|---|---|---|---|
| 1 | `0001_init_schema.sql` | Création de 27 tables, types, policies, contraintes ; verrous importants. Idempotente depuis §104. | Partiel (DROP TABLE destructif) |
| 2 | `0002_fix_profile_rls.sql` | Remplacement de policies RLS | Oui (recréation) |
| 3 | `0003_manager_profile_rpc.sql` | Création RPC `get_my_profile` | Oui (`CREATE OR REPLACE`) |
| 4 | `0004_set_establishment_agadir.sql` | UPDATE de données (ville) | Non (valeur antérieure non conservée) |
| 5 | `0005_seed_catalogue_filters_lubrifiants.sql` | INSERT de seed + création établissement de test (§104) | Non (données) |
| 6 | `0006_auto_profile_new_users.sql` | Trigger/CRUD profils | Oui |
| 7 | `0007_fix_admin_rls_and_rpc.sql` | GRANT + policies | Oui |
| 8 | `0008_product_stock_and_plans.sql` | Contrainte `plan` : risque si valeurs hors STANDARD/SILVER/GOLD | Oui |
| 9 | `0009_plans_features_subscriptions.sql` | Seed formules avant features (corrigé §104) + abonnements | Non (données) |
| 10 | `0010_super_admin_rpc.sql` | RPC SECURITY DEFINER | Oui |
| 11 | `0011_payment_mobile.sql` | Enum + colonnes | Partiel |
| 12 | `0012_decrement_product_stock.sql` | RPC stock | Oui |
| 13 | `0013_tires_and_quotes.sql` | Tables devis/pneus | Partiel |
| 14 | `0014_product_category_tire.sql` | UPDATE catégories | Non |
| 15 | `0015_support_tickets.sql` | Tables support | Partiel |
| 16 | `0016_vehicle_catalog_compat.sql` | Index unique avec expressions (corrigé §104) | Oui |
| 17 | `0017_notifications_channel.sql` | Colonnes notifications | Partiel |
| 18 | `0018_crm_super_admin.sql` | Tables CRM | Partiel |
| 19 | `0019_cheques.sql` | Table cheques | Partiel |
| 20 | `0020_supplier_returns_invoices.sql` | Contraintes FK/unique (corrigé §104) | Oui |
| 21 | `0021_mini_pos.sql` | RPC vente + stock (variable corrigée §104) | Oui |
| 22 | `0022_test_stock.sql` | Seed produits, dépend de 0005 | Non |
| 23 | `0023_scan_pro_barcodes.sql` | Table barcodes | Partiel |
| 24 | `0024_print_pro.sql` | Tables impression | Partiel |
| 25 | `0025_pos_core.sql` | RPC POS (variable corrigée §104) | Oui |
| 26 | `0026_subscriptions_audit_and_lifecycle.sql` | Table audit + RPC cycle de vie | Partiel |
| 27 | `0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` | `onboarding_requests` + RPC | Partiel |
| 28 | `0029_crm_extension_prepared_NOT_APPLIED.sql` | Tables CRM extension | Partiel |
| 29 | `0030_super_admin_security_hardening.sql` | Sécurité RLS — à examiner attentivement | Oui |
| 30 | `0031_profiles_rls_admin_access.sql` | Policies profiles | Oui |
| 31 | `0033_pre_purchase_requests_prepared_NOT_APPLIED.sql` | Table demandes | Partiel |
| 32 | `0034_harden_admin_p0_rpcs_prepared_NOT_APPLIED.sql` | Garde `is_saas_admin()` | Oui |
| 33 | `0035_pre_purchase_submit_rpc_prepared_NOT_APPLIED.sql` | RPC soumission | Oui |
| 34 | `0036_invitations_manager_prepared_NOT_APPLIED.sql` | Tables invitations + token (pgcrypto requis) | Partiel |
| 35 | `0037_fix_security_p0_prepared_NOT_APPLIED.sql` | Durcissement + drop d'ancienne signature | Oui |
| 36 | `0038_security_rls_indexes_prepared_NOT_APPLIED.sql` | Policies + index (corrigé §104) | Oui |
| 37 | `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | Colonnes identité + RPC onboarding v2 | Partiel |
| 38 | `0040_fix_admin_set_subscription_upsert.sql` | RPC abonnement (baseline intégrée §104) | Oui |
| 39 | `0041_add_updated_at_subscriptions.sql` | Colonne `updated_at` | Oui |
| 40 | `0042_rls_profiles_saas_admin_insert.sql` | Policy INSERT profiles | Oui |
| 41 | `0043_archive_purge_etablissements.sql` | Archivage/purge (nom de RPC corrigé §104) | Oui (archivage) / **Non** (purge) |
| 42 | `20261124130000_add_invitation_events_provider_error.sql` | Ajout colonne, faible risque | Oui |
| 43 | `20261124130100_saas_admin_select_profiles.sql` | Policy SELECT profiles | Oui |
| 44 | `20261124131000_admin_create_invitation_renewal.sql` | Nouvelle RPC SECURITY DEFINER | Oui |
| 45 | `20261124132000_reconcile_manager_onboarding.sql` | Versionne les réconciliations §101 : 6 colonnes administratives, `admin_onboard_tenant_v2`, `admin_update_manager`, réparation `auth.identities`, `admin_identity_v2_health`, `hash_invitation_token`. Aucune migration déjà appliquée n'est réécrite. | Oui (`CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`) |
| 46 | `20261124133000_fix_onboard_trigger_profile.sql` | Corrige le garde d'onboarding pour le profil provisoire créé par le trigger Auth (défaut reproduit en CI GV5 §105). | Oui (`CREATE OR REPLACE`) |

**Non réversibles** : 0004 (UPDATE), 0005/0022 (seed), 0009 (seed abonnements), 0014 (UPDATE), 0043 si la RPC de purge est appelée. Toutes les autres sont réversibles par `CREATE OR REPLACE`, `DROP POLICY`/recréation ou `DROP COLUMN` selon le cas.

---

## 3. Variables d'environnement à vérifier (noms uniquement, jamais les valeurs)

- Application / build : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_BASE_PATH`.
- Edge Functions : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ACTIVATION_BASE_URL`.
- Envoi (décision propriétaire) : `RESEND_API_KEY`, `EMAIL_FROM`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`.
- Tarifs (décision propriétaire) : `GV581_STANDARD_MENSUEL`, `GV581_STANDARD_ANNUEL`, `GV581_SILVER_MENSUEL`, `GV581_SILVER_ANNUEL`, `GV581_GOLD_MENSUEL`, `GV581_GOLD_ANNUEL`.

Vérifier que le workflow GitHub Pages pointe bien sur la production et **jamais** sur staging.

---

## 4. Vérification post-déploiement (smoke tests)

1. `supabase db query --remote=<prod> --read-only --file=scripts/verify-staging-migrations.sql` (adapter le nom du script) : 49 contrôles attendus.
2. Connexion Super Admin réelle ; ouverture de `/super-admin/entreprises/`, `/super-admin/onboarding/`, fiche abonné.
3. Création d'un abonné **de test** + Manager ; modification établissement/Manager/permissions ; révocation puis renouvellement d'invitation ; isolation A/B avec deux managers.
4. Vérifier `is_saas_admin()` durci : un Manager et un anonyme ne lisent aucun profil tiers.
5. Vérifier qu'aucun appel ne part vers `yocufscgninxiihwiepa` depuis le build de production.
6. Vérifier `plans.price_monthly/price_yearly` (NULL attendu tant que le propriétaire n'a pas fourni les valeurs).

---

## 5. Retour arrière migration par migration

| Étape | Retour arrière |
|---|---|
| 0001 | `DROP TABLE` dans l'ordre inverse — **destructif**, uniquement sur copie. |
| 0002–0039 | Recréer les policies/fonctions depuis le fichier précédent ou les `*_down.sql` quand ils existent (`remediation_075/001_down.sql`, `002_down.sql`, `remediation_076/001_down.sql`). |
| 0040 | Revenir à la version `UPDATE`-pur de `admin_set_subscription` (remediation_075). |
| 0041 | `ALTER TABLE subscriptions DROP COLUMN updated_at`. |
| 0042 | `DROP POLICY saas_admin_insert_profiles`. |
| 0043 | Remettre `archived_at=NULL` puis supprimer les RPC ; **la purge définitive est irréversible**. |
| 20261124130000 | `ALTER TABLE invitation_events DROP COLUMN provider_error` (perte des erreurs journalisées). |
| 20261124130100 | `DROP POLICY saas_admin_select_profiles` (le SA ne verra plus les Managers). |
| 20261124131000 | `DROP FUNCTION admin_create_invitation_renewal(...)` (plus de renouvellement après révocation). |

---

## 6. Décisions attendues du propriétaire

1. Autoriser une fenêtre de maintenance et valider la sauvegarde.
2. Valider l'application fichier par fichier (interdiction de `db push`) sur production.
3. Décider de l'import des RPC hors migrations (`security/remediation_*`, réconciliations §101).
4. Fournir les tarifs MAD ou confirmer le maintien de `NULL`.
5. Fournir/autoriser un fournisseur e-mail de test ou confirmer le report de l'activation par lien.
6. Confirmer le compte `test.manager.complet@gmail.com` sur staging.

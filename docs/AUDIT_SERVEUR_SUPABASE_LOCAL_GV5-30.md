# Audit serveur Supabase (lecture seule, artefacts locaux) — GV5 §30 / Phases 1–2

> **Portée** : analyse **locale** des sources du dépôt (`supabase/migrations`, `supabase/apply`, `supabase/verification`, `supabase/functions`, `supabase/seed.sql`, docs associées). **Aucune** connexion distante, **aucune** requête/mutation Supabase, **aucun** accès Dashboard/SQL distant. Le gel P0 est maintenu.
> 
> **Limite majeure** : les migrations locales, scripts `apply` et plans **ne prouvent pas** l’état réel de la base distante (objets présents/absents, définitions effectives, privilèges/overloads/propriétaires, RLS activée, policies actives, données, Auth/config). Tout élément dépendant de l’état distant est marqué **NON VÉRIFIABLE SANS ACCÈS READ-ONLY AUTORISÉ**.

## 1. Inventaire local des artefacts (Phase 1)

### 1.1 Migrations (`supabase/migrations/`, 0001–0031 + variantes)
| Fichier | Statut (nom/contenu local) | Objet principal (résumé factuel) |
|---|---|---|
| `0001_init_schema.sql` | Présent | Schéma initial multi-tenant (`establishment_id`), enum `user_role` (saas_admin/manager/employee/client), tables métier, RLS activée sur tables listées, helpers `current_establishment_id/autoplus_current_role/is_saas_admin/is_manager` (SECURITY DEFINER), policy générique `tenant_isolation` (tenant-only) + policies `profiles`/`establishments` |
| `0002_fix_profile_rls.sql` | Présent | Redéfinit helpers (SECURITY DEFINER, `search_path public`) pour éviter récursion RLS ; ajuste policies `profiles` (select self/tenant) et `establishments` (select tenant ou saas_admin) |
| `0003_manager_profile_rpc.sql` | Présent | `get_my_profile()` SECURITY DEFINER (`search_path public`) ; `revoke all from public`, `grant execute to authenticated` |
| `0004_set_establishment_agadir.sql` | Présent (non relu en détail ici) | Ajustement établissement Agadir (selon nom) — **détail non réinventorié** |
| `0005_seed_catalogue_filters_lubrifiants.sql` | Présent | Seed/catalogue (selon nom) — **sans DDL RLS/fonctions selon scan** |
| `0006_auto_profile_new_users.sql` | Présent | Trigger `handle_new_auth_user` (SECURITY DEFINER) sur `auth.users`, rattrapage profils ; RPC `complete_client_account`, `complete_employee_account`, `create_invoice_for_sale` (SECURITY DEFINER, `search_path public`) avec guards `is_saas_admin()`/`is_manager()` ; `revoke public`, `grant authenticated` |
| `0007_fix_admin_rls_and_rpc.sql` | Présent | Redéfinit helpers ; policies `profiles` select (self/tenant/saas_admin), `establishments` select + update saas_admin ; grants table/schema |
| `0008_product_stock_and_plans.sql` | Présent (scan) | Stock/produits/plans (selon nom) — **sans fonction RLS dédiée relevée par scan ciblé** |
| `0009_plans_features_subscriptions.sql` | Présent | Tables `plans`, `plan_features`, `subscriptions`, colonnes trial/suspension/logo ; RPC `has_feature`, `my_features` (SECURITY DEFINER stable) ; RLS + policies (saas_admin all, authenticated read sur plans/features, tenant/saas_admin select subscriptions) ; grants |
| `0010_super_admin_rpc.sql` | Présent (**RPC historiques P0**) | Policies insert establishments, audit_log (saas_admin all, managers insert, tenant select) ; RPC `admin_create_establishment`, `admin_change_plan`, `admin_set_establishment_status`, `admin_save_plan`, `admin_set_feature` (SECURITY DEFINER, `search_path public`, garde `is_saas_admin()`, écrit `audit_log`) ; `grant execute ... to authenticated` |
| `0011_payment_mobile.sql` | Présent (scan) | Paiement mobile — **sans DDL RLS/fonction relevé** |
| `0012_decrement_product_stock.sql` | Présent | `decrement_product_stock` SECURITY DEFINER (garde manager/saas_admin, scope tenant) ; `grant authenticated` |
| `0013_tires_and_quotes.sql` | Présent (scan) | `tire_specs`, `quotes`, `quote_items` + RLS tenant-only policies + grants |
| `0014_product_category_tire.sql` | Présent (scan) | Catégorie produit — **sans DDL RLS/fonction relevé** |
| `0015_support_tickets.sql` | Présent | `support_tickets`, `ticket_messages`, RLS/policies (tenant ou saas_admin, messages via existence ticket tenant), `open_ticket_count` SECURITY DEFINER ; grants |
| `0016_vehicle_catalog_compat.sql` | Présent (scan) | `vehicle_catalog` (lecture tout `authenticated`, écritures manager/saas_admin), `part_compatibilities` tenant-only ; RLS/grants |
| `0017_notifications_channel.sql` | Présent (scan) | Notifications — **sans DDL RLS/fonction relevé** |
| `0018_crm_super_admin.sql` | Présent | `crm_leads`, `crm_events` plateforme ; RLS saas_admin-only policies ; grants table à `authenticated` (RLS contraint) |
| `0019_cheques.sql` | Présent | `cheques` RLS tenant-only ; `cheques_echeances_proches` SECURITY DEFINER ; grants |
| `0020_supplier_returns_invoices.sql` | Présent (scan) | Retours/factures fournisseurs, RLS tenant-only, grants |
| `0021_mini_pos.sql` (+ `.sauvegarde`) | Présent | `create_pos_sale` SECURITY DEFINER, `revoke public,anon`, `grant authenticated` (POS transactionnel ; .sauvegarde = variante non canonique) |
| `0022_test_stock.sql` | Présent (scan) | Test stock — **sans DDL RLS/fonction relevé** |
| `0023_scan_pro_barcodes.sql` | Présent | `product_barcodes` RLS (tenant + saas_admin), RPC résolution/ajout/suppression barcodes SECURITY DEFINER + audit_log, grants |
| `0024_print_pro.sql` | Présent | `printer_configs`, `print_jobs` RLS (tenant + saas_admin), trigger, `count_print_jobs` SECURITY DEFINER, grants |
| `0025_pos_core.sql` (+ `.sauvegarde`) | Présent | `create_pos_sale_v2` SECURITY DEFINER, `revoke public,anon`, `grant authenticated`, idempotence par référence |
| `0026_subscriptions_audit_and_lifecycle.sql` | Présent | `subscriptions_audit` RLS ; RPC `admin_renew_subscription`, `admin_reactivate_subscription`, `admin_expire_subscription` SECURITY DEFINER (garde saas_admin, audit) ; grants |
| `0027_mission_2_14_managers_prepared_NOT_APPLIED.sql` | **PRÉPARÉE — NON APPLIQUÉE** | Plan commenté + `BEGIN...ROLLBACK` (remédiation comptes managers ciblés) ; pas de DDL/DML effectif |
| `0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` | **PRÉPARÉE — NON APPLIQUÉE** | `onboarding_requests` + RLS/policy/grant ; RPC `admin_find_user_id_by_email`, `admin_find_onboarding_request`, `admin_onboard_tenant`, `admin_attach_manager`, `admin_tenant_integrity` (SECURITY DEFINER, garde saas_admin, `revoke public`, `grant authenticated`, idempotence/validations) |
| `0029_crm_extension_prepared_NOT_APPLIED.sql` | **PRÉPARÉE — NON APPLIQUÉE** | Colonnes/index CRM (`source`, `priority`, `estimated_value`) sans suppression de données |
| `0030_super_admin_security_hardening.sql` | Présent (local) | Recréation `admin_delete_client_account` SECURITY DEFINER avec garde `is_saas_admin()`, audit, suppression ciblée + `auth.users`, `revoke public`/`grant authenticated` (contexte : fonction antérieurement non versionnée distante signalée dans commentaires — **état distant non vérifié**) |
| `0031_profiles_rls_admin_access.sql` | Présent (local) | Policies `profiles_saas_admin_update`, `clients_saas_admin` |

### 1.2 Scripts d’application (`supabase/apply/`)
| Fichier | Nature | Remarques de sécurité (local) |
|---|---|---|
| `0018_apply_minimal.sql` | **Mutatif si exécuté** (DDL/RLS/policies/grants) + pre-flight + post-checks lecture | Exige `is_saas_admin()` et `establishments` ; crée CRM saas_admin-only |
| `0028_apply_minimal.sql` | **Mutatif si exécuté** (table, RLS, RPC, inserts/updates lors des appels) + pre-flight/post-checks | Vérifie dépendances/plans ; définit RPC onboarding idempotentes sécurisées |
| `0032_PLAN_PENDING_MIGRATIONS.sql` | **Plan/bundle mutatif si exécuté** (0010,0015,0018,0026,0029,0030,0031) | Header « PLAN UNIQUEMENT — AUCUNE ÉCRITURE RÉALISÉE » ; requiert sauvegarde/PITR, ordre |
| `GUIDE_EXECUTION_MIGRATIONS_PENDING.md` | Procédure (document) | Préconditions, ordre, vérifications post-exec, rollback PITR, déploiement EF après 0028 |

### 1.3 Vérification (lecture seule, scripts SQL)
| Fichier | Contenu |
|---|---|
| `0028_verify_readonly.sql` | Vérifs tables/colonnes/fonctions/RLS/policies/grants, comptages, comptes test ciblés, absence objets 0028 — **lecture seule** |
| `FINAL_0028_PREFLIGHT_READONLY.sql` | Preflight exhaustif similaire/étendu — **lecture seule** |

### 1.4 Edge Function
| Fichier | Résumé factuel (local) |
|---|---|
| `supabase/functions/onboard-tenant/index.ts` | Source prête, non déployée ; POST + CORS `*` ; clients `caller` (anon+JWT, RPC dépendant `auth.uid()`/`is_saas_admin`) et `admin` (service role, auth admin + lecture profil) ; vérif JWT + profil `saas_admin` actif ; validation inputs (UUID/slug/plan/trial/email) ; idempotence via `admin_find_onboarding_request` + `p_request_id` ; anti-doublon email manager ; invitation Auth ; appel `admin_onboard_tenant` ; compensation suppression user invitée sur erreur RPC (erreur de suppression avalée) ; dépend des RPC 0028 |

### 1.5 Données de démo
- `supabase/seed.sql` : inserts de démonstration (établissement Agadir fixe, employés/clients/véhicules/services/work_orders) — **mutatif si exécuté**, jamais à confondre avec données réelles/production.

## 2. Inventaire fonctions/RPC (synthèse, artefacts locaux)

> Détails complets (signatures, security, search_path, grants, but) : voir inventaire structuré produit en sous-agent (sources `0001–0031`, apply 0018/0028/0032). Points clés :

| Catégorie | Fonctions (exemples) | Garde/notes |
|---|---|---|
| Helpers identité/tenant | `current_establishment_id`, `autoplus_current_role`, `is_saas_admin`, `is_manager`, `get_my_profile` | SECURITY DEFINER, `search_path public` (selon versions) ; `get_my_profile` restreint à `authenticated` |
| Droits/forfaits | `has_feature`, `my_features` | SECURITY DEFINER stable, `authenticated` |
| RPC SA 0010 (historiques P0) | `admin_create_establishment`, `admin_change_plan`, `admin_set_establishment_status`, `admin_save_plan`, `admin_set_feature` | SECURITY DEFINER, `search_path public`, garde `is_saas_admin()`, audit_log, `grant authenticated` |
| Cycle abonnements 0026 | `admin_renew_subscription`, `admin_reactivate_subscription`, `admin_expire_subscription` | SECURITY DEFINER, garde `is_saas_admin()`, audit + `subscriptions_audit`, `grant authenticated` |
| Onboarding 0028 (préparé) | `admin_find_user_id_by_email` (`search_path public,auth`), `admin_find_onboarding_request`, `admin_onboard_tenant`, `admin_attach_manager`, `admin_tenant_integrity` | SECURITY DEFINER, garde `is_saas_admin()`, validations/idempotence, `revoke public` + `grant authenticated` |
| Durcissement 0030 | `admin_delete_client_account` | SECURITY DEFINER, garde `is_saas_admin()`, audit, suppression profil/`auth.users`, `revoke public` + `grant authenticated` |
| Métier/tenant | `complete_client_account`, `complete_employee_account`, `create_invoice_for_sale`, `decrement_product_stock`, `open_ticket_count`, `cheques_echeances_proches`, POS/barcodes/print RPCs | Guards rôles/tenant/permissions selon fonctions ; POS revoke `public,anon` |
| Support | `open_ticket_count` | SECURITY DEFINER stable |

**Grants sensibles (observations locales)** : aucun `GRANT ... TO anon/public` explicite trouvé ; nombreux `GRANT EXECUTE TO authenticated` avec garde interne ; révocations explicites sur fonctions sensibles récentes (0003/0006/0021/0025/0028/0030). **Privilèges effectifs distants = NON VÉRIFIABLE.**

## 3. RLS / policies / isolation (synthèse locale)

- RLS activée dans les migrations sur tables cœur (0001) et tables ajoutées (0009 plans/subscriptions, 0013/0015/0016/0018/0019/0020/0023/0024/0026/0028 onboarding_requests, etc.).
- **Isolation tenant** principalement via `establishment_id = current_establishment_id()` (policy générique 0001 + policies dédiées). Certaines policies ajoutent bypass `is_saas_admin()` (audit_log, subscriptions, support, barcodes, printers, CRM plateforme saas_admin-only, clients/profiles update en 0031, etc.).
- **Points d’attention (locaux)** : policy générique 0001 sans bypass saas_admin sur de nombreuses tables ; `vehicle_catalog` lisible par tout `authenticated` (`auth.uid() is not null`) ; `plans/plan_features` lisibles par tout `authenticated` ; grants table parfois larges compensés par RLS (ex. CRM, onboarding_requests) — l’effectivité dépend de l’état réel.
- **Non vérifiable à distance** : RLS réellement activée, policies effectivement présentes/ordonnées, conflits de noms, comportement avec rôles/service_role en production.

## 4. Rôles et contrôles
- Rôles enum : `saas_admin`, `manager`, `employee`, `client` (0001). Enforcement via helpers (`is_saas_admin`, `is_manager`, `current_establishment_id`), policies RLS, et guards dans RPC SECURITY DEFINER. `permissions` (table) utilisé dans POS pour exceptions non-manager (0021/0025).
- Contrôles `auth.uid()` : présents dans helpers et flux (EF caller JWT → RPC). **Config Auth/rôles réels distants = NON VÉRIFIABLE.**

## 5. Edge Function, apply/verification, seed (sécurité)
- **EF onboarding** : bonnes pratiques visibles (séparation caller/admin, validation JWT + profil actif, validation inputs, idempotence, anti-doublon email, compensation) ; points d’attention (CORS `*`, échec suppression compensation avalé, dépendance 0028, opérations service-role haut privilège encadrées par logique). **Non déployée / config secrets SMTP/Auth = BLOQUÉE.**
- **Apply** : scripts mutatifs avec pre-flight/post-checks (0018/0028) ou plan consolidé (0032) ; exécution interdite sous gel P0.
- **Verification** : lecture seule.
- **Seed** : démo, mutatif si exécuté.

## 6. Écarts, risques et éléments non vérifiables (Phase 1–2)

| Élément | Constat local | Risque | Statut |
|---|---|---|---|
| État distant vs migrations locales | 0010/0015/0018/0026/0028/0029/0030/0031/0032 signalés préparés/en attente selon docs/guide | Dérive schéma/sécurité, régressions à l’application | **NON VÉRIFIABLE SANS ACCÈS READ-ONLY** — BLOQUÉ |
| RPC historiques P0 (0010) effectives | Définitions/guards/grants connus localement, idempotence limitée sur création | Exposition si garde/ACL incorrect en base, doublons | **NON VÉRIFIABLE À DISTANCE** — voir dossier P0 |
| `admin_delete_client_account` distante | 0030 durcit localement ; fonction possiblement créée hors versioning (commentaire) | Accès/suppression non conforme si ancienne version active | **NON VÉRIFIABLE** — BLOQUÉ |
| Privilèges/overloads/propriétaires | Non observables localement | Élévation/contournement possible si mal configuré | **NON VÉRIFIABLE** |
| RLS/policies réelles & isolation prouvée | Conçues localement, couverture inégale sur certaines tables historiques | Fuite cross-tenant ou accès admin insuffisant | **NON VÉRIFIABLE** |
| Auth/SMTP/invitations/secrets/EF | Préparés côté code/doc | Onboarding réel impossible sans config | BLOQUÉ PAR AUTORISATION/DÉPENDANCE |
| Sauvegardes/PITR/restaurabilité | Procédure préparée | Risque opérationnel si non prouvé | BLOQUÉ |
| Intégrations paiements/WhatsApp/IA | UI honnête, pas de fournisseur réel | Aucune preuve d’exécution réelle | BLOQUÉ PAR DÉPENDANCE EXTERNE |

## 7. Recommandations préparées (sans exécution)
- Réaliser un audit SQL read-only distant autorisé (objets, définitions, ACL, RLS, policies, propriétaires, triggers, extensions pertinentes) et réconcilier avec les sources locales avant toute action.
- Prioriser correction/validation des RPC P0 et de `is_saas_admin()`/helpers, puis application contrôlée et ordonnée 0032/0028 selon guides, après sauvegarde/PITR vérifiée et tests en environnement isolé.
- Durcir/refuser par défaut : EXECUTE minimal, pas de `anon/public` sur RPC sensibles, RLS cohérente et testée, audit des actions sensibles, validations/idempotence.
- Déployer EF onboarding et configurer Auth/SMTP uniquement après autorisations, avec comptes de test isolés et preuves.

## 8. Statut synthèse
- **FAIT ET VÉRIFIÉ (local)** : inventaire artefacts, lecture/analyse migrations/RPC/RLS/EF/apply/verification/seed, identification risques/écarts, livrables préparatoires.
- **IMPLÉMENTÉ MAIS NON VALIDÉ** : corrections/migrations/EF/onboarding côté sources.
- **BLOQUÉ PAR AUTORISATION / GEL P0** : toute vérification distante, mutation, migration, RLS/ACL/rôles, comptes/données réelles, EF/Auth/SMTP/secrets, restauration.
- **BLOQUÉ PAR DÉPENDANCE EXTERNE** : fournisseurs paiements/WhatsApp/IA, infra sauvegarde/restauration prouvée.

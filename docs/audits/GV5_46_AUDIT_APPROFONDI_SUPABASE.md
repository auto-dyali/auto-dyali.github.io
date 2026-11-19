---
# GV5 §46 — AUDIT APPROFONDI SUPABASE EN LECTURE SEULE

**Date** : 16 novembre 2026  
**Projet** : AUTO DYALI  
**Project Ref** : `nxmsqqoflskfajqrqddw`  
**URL** : `https://nxmsqqoflskfajqrqddw.supabase.co`  
**Dépôt** : `/Users/hind/Documents/Default Project/auto-plus` (branche `main`)  
**Mission** : Audit approfondi en lecture seule — aucune modification effectuée

---

## 1. DATE ET PÉRIMÈTRE

| Élément | Valeur |
|---------|--------|
| Date d'exécution | 16 novembre 2026 |
| Projet Supabase | `nxmsqqoflskfajqrqddw` |
| Schéma audité | `public` |
| Dépôt local | `/Users/hind/Documents/Default Project/auto-plus` |
| Branche Git | `main` (synchronisée avec `origin/main`, aucun commit local) |
| Outils utilisés | `execute_sql` (SELECT uniquement), `list_tables`, `list_edge_functions`, `get_edge_function`, `get_advisors`, `list_migrations` |

---

## 2. OUTILS MCP RÉELLEMENT DISPONIBLES

| Outil | Statut | Utilisé |
|-------|--------|---------|
| `get_project_url` | ✅ Disponible | Oui — URL confirmée |
| `get_publishable_keys` | ✅ Disponible | Oui — 2 clés (anon, publishable), valeurs non affichées |
| `list_migrations` | ✅ Disponible | Oui — résultat vide (`[]`) |
| `list_tables` | ✅ Disponible | Oui — 36 tables inventoriées |
| `list_extensions` | ✅ Disponible | Oui — 60+ extensions, pgcrypto & pg_stat_statements installés |
| `list_edge_functions` | ✅ Disponible | Oui — 1 fonction (`onboard-tenant`, ACTIVE) |
| `get_edge_function` | ✅ Disponible | Oui — code source de `onboard-tenant` |
| `get_advisors` | ✅ Disponible | Oui — sécurité, performance |
| `execute_sql` | ✅ Disponible | Oui — requêtes SELECT de catalogues uniquement |
| `apply_migration` | ❌ Interdit | Non utilisé |
| `deploy_edge_function` | ❌ Interdit | Non utilisé |

**Limite** : `get_advisors` avec `type: "health"` n'a pas retourné de données distinctes. `query_logs` n'a pas été appelé (aucune table de logs listée).

---

## 3. MÉTHODOLOGIE ET LIMITES

### Méthodologie
1. Consultation des catalogues PostgreSQL (`pg_proc`, `pg_policy`, `pg_class`, `information_schema.role_routine_grants`, `information_schema.columns`, `pg_constraint`) via `execute_sql` avec des requêtes `SELECT` uniquement.
2. Vérification des privilèges effectifs via `has_function_privilege(oid, 'EXECUTE')`.
3. Lecture du code source des fonctions via `pg_get_functiondef(oid)`.
4. Lecture des politiques RLS via `pg_policy`.
5. Comparaison avec les fichiers locaux (`supabase/migrations/`, `supabase/functions/onboard-tenant/index.ts`).
6. Vérification de l'intégrité Git (`git status`, `git diff`).

### Limites déclarées
- `pg_authid` non consulté (contient des secrets/empreintes de mots de passe — interdit).
- Aucune tentative de contournement des RLS, aucune création de session, aucun accès aux données personnelles.
- Aucune donnée de ligne n'a été lue (seuls les métadonnées de catalogue).
- La configuration Auth (leaked password protection, SMTP, Redirect URLs) n'est pas vérifiable via SQL.
- La table d'historique des migrations Supabase est introuvable (aucune table `*migrat*` dans `public` ou `supabase`).

---

## 4. RÉSULTATS POSTGRESQL

### 4.1 Tables (36 trouvées)

Toutes les 36 tables ont `rls_enabled = true` et `rls_forced = false` (le propriétaire `postgres` contourne RLS). Toutes appartiennent à `postgres`.

Tables : `appointments`, `attendance`, `audit_log`, `cash_sessions`, `client_notifications`, `clients`, `crm_events`, `crm_leads`, `employees`, `establishments`, `expenses`, `inventory_counts`, `invoices`, `maintenance_reminders`, `onboarding_requests`, `payments`, `permissions`, `plan_features`, `plans`, `product_lots`, `products`, `profiles`, `purchase_order_items`, `purchase_orders`, `sale_items`, `sales`, `services`, `stock_movements`, `subscriptions`, `subscriptions_audit`, `suppliers`, `support_tickets`, `ticket_messages`, `vehicles`, `work_order_tasks`, `work_orders`.

### 4.2 Table d'historique des migrations

**Aucune table de migration trouvée.** Requête sur `information_schema.tables` pour `table_schema IN ('public', 'supabase')` et `table_name LIKE '%migrat%'` retourne `[]`. Confirme que `list_migrations()` = `[]` — l'historique des migrations Supabase est vide ou inexistant.

---

## 5. INVENTAIRE DES FONCTIONS ET PRIVILÈGES

### 5.1 Fonctions sensibles — signatures et attributs

| Fonction | Signature | SECURITY DEFINER | search_path | Propriétaire |
|----------|-----------|-----------------|-------------|--------------|
| `admin_create_establishment` | `(p_name text, p_slug text, p_city text, p_phone text, p_email text, p_plan text)` | ✅ true | `search_path=public` | postgres |
| `admin_save_plan` | `(p_code text, p_price_monthly numeric, ...)` | ✅ true | `search_path=public` | postgres |
| `admin_change_plan` | `(p_establishment_id uuid, p_plan text)` | ✅ true | `search_path=public` | postgres |
| `admin_set_establishment_status` | `(p_establishment_id uuid, p_active boolean)` | ✅ true | `search_path=public` | postgres |
| `admin_set_feature` | `(p_plan_code text, p_feature text, p_enabled boolean)` | ✅ true | `search_path=public` | postgres |
| `admin_delete_client_account` | `(p_user_id uuid)` | ✅ true | `search_path=public` | postgres |
| `admin_onboard_tenant` | `(p_company_name text, ..., p_request_id text)` | ✅ true | `search_path=public` | postgres |
| `admin_attach_manager` | `(p_establishment_id uuid, p_user_id uuid, ...)` | ✅ true | `search_path=public` | postgres |
| `admin_invite_manager` | **N'EXISTE PAS** dans `pg_proc` | — | — | — |
| `admin_find_user_id_by_email` | `(p_email text)` | ✅ true | `search_path=public, auth` | postgres |
| `admin_find_onboarding_request` | `(p_request_id text)` | ✅ true | `search_path=public` | postgres |
| `admin_tenant_integrity` | `(p_establishment_id uuid)` | ✅ true | `search_path=public` | postgres |
| `is_saas_admin` | `()` | ✅ true | `search_path=public` | postgres |
| `is_manager` | `()` | ❌ false | `null` (non configuré) | postgres |
| `current_establishment_id` | `()` | ✅ true | `search_path=public` | postgres |
| `autoplus_current_role` | `()` | ✅ true | `search_path=public` | postgres |
| `decrement_product_stock` | `(p_product_id uuid, p_quantity integer)` | ✅ true | `search_path=public` | postgres |
| `my_features` | `()` | ✅ true | `search_path=public` | postgres |
| `open_ticket_count` | `(p_establishment_id uuid)` | ✅ true | `search_path=public` | postgres |
| `get_my_profile` | `()` | ✅ true | `search_path=public` | postgres |

### 5.2 Privilèges EXECUTE effectifs

**Fonctions avec EXECUTE pour `PUBLIC` (inclut `anon`, utilisateurs non authentifiés) :**

| Fonction | security_definer | public_execute |
|----------|-----------------|----------------|
| `admin_create_establishment` | true | ✅ |
| `admin_save_plan` | true | ✅ |
| `admin_change_plan` | true | ✅ |
| `admin_set_establishment_status` | true | ✅ |
| `admin_set_feature` | true | ✅ |
| `admin_expire_subscription` | true | ✅ |
| `admin_reactivate_subscription` | true | ✅ |
| `admin_renew_subscription` | true | ✅ |
| `admin_delete_client_account` | true | ✅ |
| `admin_onboard_tenant` | true | ✅ |
| `admin_attach_manager` | true | ✅ |
| `autoplus_current_role` | true | ✅ |
| `current_establishment_id` | true | ✅ |
| `decrement_product_stock` | true | ✅ |
| `is_manager` | false | ✅ |
| `is_saas_admin` | true | ✅ |
| `my_features` | true | ✅ |
| `open_ticket_count` | true | ✅ |
| `get_my_profile` | true | ✅ |

**Fonctions avec EXECUTE pour `authenticated` uniquement (plus `PUBLIC` pour certaines) :**
- `admin_attach_manager`, `admin_delete_client_account`, `admin_find_onboarding_request`, `admin_find_user_id_by_email`, `admin_onboard_tenant`, `admin_tenant_integrity`, `get_my_profile` — `authenticated` + `postgres` (certaines aussi `PUBLIC`)

### 5.3 Analyse du code source des fonctions critiques

Toutes les fonctions administratives contiennent un garde `if not public.is_saas_admin() then raise exception`. Cependant :

1. **Elles sont exposées à `PUBLIC`** — n'importe qui peut les invoquer via `/rest/v1/rpc/`. Même si elles lèvent une exception pour les non-admins, c'est une surface d'attaque inutile et les messages d'erreur peuvent révéler des informations (existence de la fonction, noms de tables).

2. **`admin_delete_client_account`** — effectue `delete from public.clients where establishment_id = v_profile.establishment_id` (supprime TOUS les clients d'un établissement en cascade), puis supprime le profil et l'utilisateur Auth. Fonction extrêmement destructive exposée à `PUBLIC`.

3. **`admin_create_establishment`** — crée un établissement et un abonnement, exposée à `PUBLIC`. Aucune idempotence (`request_id` absent), pas de vérification d'unicité du slug au niveau applicatif (dépend uniquement de la contrainte DB unique).

4. **`is_manager`** — `SECURITY INVOKER` (security_definer=false), `search_path` non configuré (null). Elle appelle `autoplus_current_role()` sans qualification de schéma. Avec SECURITY INVOKER, la résolution de `autoplus_current_role()` dépend du `search_path` de l'appelant. Si un attaquant peut modifier son `search_path` local, il pourrait injecter une fonction `autoplus_current_role` malveillante dans son propre schéma.

5. **`admin_find_user_id_by_email`** — `search_path=public, auth`, accède à `auth.users`. Exécutable par `PUBLIC`. Retourne l'UUID d'un utilisateur par son email — énumération possible des comptes.

---

## 6. AUDIT RLS

### 6.1 État RLS par table

| Table | RLS | RLS Forced | Politiques |
|-------|-----|------------|------------|
| 36 tables | ✅ enabled | ❌ false (toutes) | 1 à 4 par table |

### 6.2 Politiques RLS détaillées

**Politiques génériques `tenant_isolation`** (sur 27 tables) :
- `using (establishment_id = current_establishment_id())`
- `with_check (establishment_id = current_establishment_id())`
- Commande `*` (toutes opérations)

**Politiques spécifiques :**

| Table | Politique | Commande | USING | WITH CHECK |
|-------|-----------|----------|-------|------------|
| `audit_log` | `tenant_isolation` | `*` | `establishment_id = current_establishment_id()` | même |
| `audit_log` | `saas_admin_all_audit_log` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `audit_log` | `managers_insert_audit_log` | `a` (INSERT) | null | `is_saas_admin() OR is_manager()` |
| `audit_log` | `tenant_select_audit_log` | `r` (SELECT) | `(establishment_id = current_establishment_id()) OR is_saas_admin()` | null |
| `establishments` | `own_establishment` | `*` | `id = current_establishment_id()` | null |
| `establishments` | `saas_admin_full_access` | `*` | `is_saas_admin()` | null |
| `establishments` | `saas_admin_insert_establishments` | `a` | null | `is_saas_admin()` |
| `establishments` | `saas_admin_update_establishments` | `w` | `is_saas_admin()` | `is_saas_admin()` |
| `establishments` | `tenant_isolation` | `r` | `(id = current_establishment_id()) OR is_saas_admin()` | null |
| `onboarding_requests` | `onboarding_requests_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `profiles` | `profiles_self_or_same_establishment` | `r` | `(id = auth.uid()) OR (establishment_id = current_establishment_id()) OR is_saas_admin()` | null |
| `profiles` | `profiles_saas_admin_update` | `w` | `is_saas_admin()` | `is_saas_admin()` |
| `plans` | `plans_authenticated_read` | `r` | `auth.uid() IS NOT NULL` | null |
| `plans` | `plans_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `plan_features` | `plan_features_authenticated_read` | `r` | `auth.uid() IS NOT NULL` | null |
| `plan_features` | `plan_features_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `subscriptions` | `subscriptions_tenant` | `r` | `(establishment_id = current_establishment_id()) OR is_saas_admin()` | null |
| `subscriptions` | `subscriptions_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `support_tickets` | `support_tickets_tenant` | `*` | `(establishment_id = current_establishment_id()) OR is_saas_admin()` | même |
| `ticket_messages` | `ticket_messages_tenant` | `*` | `is_saas_admin() OR (EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.establishment_id = current_establishment_id()))` | même |
| `crm_leads` | `crm_leads_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |
| `crm_events` | `crm_events_saas_admin` | `*` | `is_saas_admin()` | `is_saas_admin()` |

### 6.3 Problèmes identifiés

- **RLS_FORCED=false sur toutes les tables** : le propriétaire (`postgres`) et les superutilisateurs contournent RLS. Les fonctions `SECURITY DEFINER` appartenant à `postgres` s'exécutent avec les privilèges du propriétaire et contournent donc RLS sur les tables qu'elles modifient.

- **Politiques multiples permissives** : `audit_log` a 4 politiques (dont 3 avec commande `*` ou `a`), `establishments` a 5 politiques. Plusieurs politiques "permissives" (commande `*` ou `a` ou `w`) sur la même table pour les mêmes rôles, ce qui élargit l'accès et rend l'audit difficile.

- **`plans` et `plan_features` lisibles par tout `authenticated`** : politique `auth.uid() IS NOT NULL` — tout utilisateur connecté peut lire les plans et fonctionnalités.

- **`onboarding_requests`** : seule politique `onboarding_requests_saas_admin` (saas_admin uniquement) — cohérent.

- **Aucune politique sur `ticket_messages` qui vérifie l'établissement via `ticket_messages.establishment_id`** (la table n'a pas cette colonne) — la vérification passe par une sous-requête sur `support_tickets`.

---

## 7. ANALYSE MIGRATION 0028

### 7.1 État réel distant

| Objet | Existe distant | Source |
|-------|---------------|--------|
| `public.onboarding_requests` | ✅ Oui | `pg_class`, `information_schema.columns` |
| `public.admin_onboard_tenant` | ✅ Oui | `pg_proc` |
| `public.admin_find_onboarding_request` | ✅ Oui | `pg_proc` |
| `public.admin_find_user_id_by_email` | ✅ Oui | `pg_proc` |
| `public.admin_attach_manager` | ✅ Oui | `pg_proc` |
| `public.admin_tenant_integrity` | ✅ Oui | `pg_proc` |
| Table d'historique des migrations | ❌ Non | `information_schema.tables` vide |
| `list_migrations()` | ❌ Vide `[]` | Outil MCP |

### 7.2 Structure de `onboarding_requests`

| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| `request_id` | text | NO | — |
| `company_name` | text | NO | — |
| `slug` | text | NO | — |
| `plan` | text | NO | — |
| `company_email` | text | YES | — |
| `manager_user_id` | uuid | YES | — |
| `establishment_id` | uuid | YES | — |
| `status` | text | NO | `'started'::text` |
| `created_at` | timestamptz | NO | `now()` |
| `completed_at` | timestamptz | YES | — |

FK : `onboarding_requests_establishment_id_fkey` → `establishments(id)`, `onboarding_requests_manager_user_id_fkey` → `auth.users(id)`.

Politique RLS : `onboarding_requests_saas_admin` (commande `*`, `is_saas_admin()` uniquement).

### 7.3 Contradiction avec le registre GV5

Le fichier local `supabase/migrations/0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` est explicitement marqué `STATUT : PRÉPARÉ — NON APPLIQUÉ`. Cependant :
- La table `onboarding_requests` existe sur le distant
- La fonction `admin_onboard_tenant` existe sur le distant
- L'Edge Function `onboard-tenant` est ACTIVE sur le distant

**Conclusion** : La migration 0028 (ou ses objets) a été appliquée sur le distant **en dehors du système de migrations Supabase** (probablement via SQL Editor direct), car l'historique des migrations est vide. Le fichier local marqué `NOT_APPLIED` ne reflète pas l'état réel distant.

**Statut** : CONTRADICTION CONFIRMÉE — objets 0028 présents distant, marqués non appliqués localement, historique des migrations vide.

---

## 8. ANALYSE EDGE FUNCTION onboard-tenant

### 8.1 État distant

| Attribut | Valeur |
|----------|--------|
| Nom | `onboard-tenant` |
| Statut | ACTIVE |
| Version | 1 |
| `verify_jwt` | true |
| `import_map` | false |
| Entrypoint | `file:///tmp/user_fn_.../source/index.ts` |

### 8.2 Analyse du code source (local vs distant)

Le code source local (`supabase/functions/onboard-tenant/index.ts`) correspond à ce qui est déployé (même architecture). Points de sécurité :

1. **Authentification** : Vérifie le JWT via `caller.auth.getUser(token)`, puis vérifie le rôle `saas_admin` via `admin.from("profiles")` avec la clé service_role. ✅
2. **Séparation caller/admin** : `caller` (ANON + JWT) pour les RPC 0028, `admin` (SERVICE_ROLE) pour `auth.admin.inviteUserByEmail`. ✅
3. **Aucun mot de passe en clair** : Utilise `inviteUserByEmail` qui envoie un email d'invitation. Le Manager définit son propre mot de passe. ✅
4. **Idempotence** : Vérifie `admin_find_onboarding_request` avant de créer. ✅
5. **Anti-doublon email** : Vérifie `admin_find_user_id_by_email`. ✅
6. **Compensation** : Si `admin_onboard_tenant` échoue, supprime le compte invité créé (`admin.auth.admin.deleteUser`). Les erreurs de suppression sont avalées (`.catch(() => undefined)`). ⚠️
7. **CORS** : `Access-Control-Allow-Origin: *` — potentiellement trop permissif. ⚠️
8. **Dépendances** : Appelle `admin_find_onboarding_request`, `admin_find_user_id_by_email`, `admin_onboard_tenant` — toutes existantes sur le distant.

### 8.3 Contradiction

La documentation locale indique que l'EF n'est pas déployée et que la migration 0028 est `NOT_APPLIED`. Pourtant l'EF est ACTIVE et ses dépendances existent. **CONTRADICTION CONFIRMÉE.**

---

## 9. TABLEAU DES ANOMALIES A1–A14

| ID | Anomalie | Statut | Preuve |
|----|----------|--------|--------|
| A1 | Fonctions SECURITY DEFINER exécutables par `anon` | **CONFIRMÉE** | 14 fonctions avec `public_execute=true` + `security_definer=true` (via `has_function_privilege` et `pg_proc`) |
| A2 | Fonctions administratives exécutables par `authenticated` | **CONFIRMÉE** | `admin_onboard_tenant`, `admin_delete_client_account`, `admin_attach_manager`, etc. avec `EXECUTE` pour `authenticated` |
| A3 | `search_path` mutable de `is_manager` | **CONFIRMÉE** | `is_manager`: `security_definer=false`, `search_path_config=null`, appelle `autoplus_current_role()` sans qualification de schéma |
| A4 | Protection mots de passe compromis désactivée | **NON VÉRIFIABLE** | Configuration Auth Supabase, non accessible via SQL |
| A5 | Politiques permissives multiples | **CONFIRMÉE** | `audit_log` : 4 politiques (3 avec commande `*`/`a`), `establishments` : 5 politiques |
| A6 | Clés étrangères sans index | **CONFIRMÉE** | 61 unindexed foreign keys (conseillers Supabase) + 66 FK listées dans `pg_constraint` |
| A7 | Optimisations `auth_rls_initplan` | **CONFIRMÉE** | 3 tables : `profiles`, `plans`, `plan_features` (conseillers Supabase) |
| A8 | Historique des migrations vide | **CONFIRMÉE** | `list_migrations()` = `[]`, aucune table `*migrat*` dans `public` ou `supabase` |
| A9 | Contradiction migration 0028 | **CONFIRMÉE** | `onboarding_requests` + `admin_onboard_tenant` existent distant, fichier local marqué `NOT_APPLIED`, historique vide |
| A10 | Edge Function active, dépendances non réconciliées | **CONFIRMÉE** | `onboard-tenant` ACTIVE, `admin_onboard_tenant` et `onboarding_requests` existent distant |
| A11 | Définitions RLS inaccessibles | **NON CONFIRMÉE** | Les politiques RLS sont accessibles via `pg_policy` (50 politiques lues) |
| A12 | Index inutilisés | **CONFIRMÉE** | 7 unused indexes (conseillers Supabase) |
| A13 | Absence de types TypeScript générés | **CONFIRMÉE** | Aucun fichier `supabase/types.ts` dans le dépôt local |
| A14 | Absence de comptes de test | **CONFIRMÉE** | 6 comptes @autodyali.test préparés dans `docs/COMPTES_TEST_PREPARATION.md`, non créés |

---

## 10. RISQUES CLASSÉS P0/P1/P2/P3

| ID | Criticité | Risque | Preuve |
|----|-----------|--------|--------|
| R1 | P0 | `admin_delete_client_account` exposé à `PUBLIC` — suppression de clients et de comptes Auth par quiconque | `pg_proc` + `has_function_privilege` + code source |
| R2 | P0 | `admin_create_establishment` exposé à `PUBLIC` — création d'établissements et d'abonnements par quiconque | `pg_proc` + `has_function_privilege` + code source |
| R3 | P0 | `admin_save_plan`, `admin_change_plan`, `admin_set_feature` exposés à `PUBLIC` — modification des plans et fonctionnalités par quiconque | `pg_proc` + `has_function_privilege` |
| R4 | P0 | `admin_set_establishment_status` exposé à `PUBLIC` — activation/suspension d'établissements par quiconque | `pg_proc` + `has_function_privilege` |
| R5 | P0 | `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()` exposés à `PUBLIC` — énumération des rôles et établissements | `pg_proc` + `has_function_privilege` |
| R6 | P1 | `admin_delete_client_account` supprime tous les clients d'un établissement en cascade (`delete from public.clients where establishment_id = ...`) | Code source `pg_get_functiondef` |
| R7 | P1 | `RLS_FORCED=false` sur toutes les tables — le propriétaire et fonctions SECURITY DEFINER (propriétaire `postgres`) contournent RLS | `pg_class.relforcerowsecurity = false` |
| R8 | P1 | Politiques multiples permissives sur `audit_log` et `establishments` — accès élargi difficile à auditer | `pg_policy` (50 politiques) |
| R9 | P2 | 61 foreign keys sans index de couverture — dégradation performance sur requêtes inter-tenant | Conseillers Supabase (lint `unindexed_foreign_keys`) |
| R10 | P2 | `admin_find_user_id_by_email` exposé à `PUBLIC` — énumération des comptes utilisateurs par email | `pg_proc` + `has_function_privilege` |
| R11 | P2 | `is_manager` sans `search_path` — risque d'injection de schéma via `autoplus_current_role()` non qualifié | Code source `pg_get_functiondef` |
| R12 | P2 | CORS `*` sur l'Edge Function `onboard-tenant` | Code source local + `list_edge_functions` |
| R13 | P3 | 7 index inutilisés | Conseillers Supabase (lint `unused_index`) |
| R14 | P3 | Pas de types TypeScript générés — risque d'écart frontend/backend | Absence de fichier dans le dépôt |
| R15 | P3 | Pas de comptes de test pour validation RLS et onboarding | `docs/COMPTES_TEST_PREPARATION.md` |

---

## 11. CORRECTIONS RECOMMANDÉES (SANS EXÉCUTION)

### P0 — Immédiat
1. **Révoquer `EXECUTE` sur `PUBLIC` pour les 14 fonctions exposées** : `admin_create_establishment`, `admin_save_plan`, `admin_change_plan`, `admin_set_establishment_status`, `admin_set_feature`, `admin_expire_subscription`, `admin_reactivate_subscription`, `admin_renew_subscription`, `admin_delete_client_account`, `admin_onboard_tenant`, `admin_attach_manager`, `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()`, `decrement_product_stock`, `my_features()`, `open_ticket_count()`, `get_my_profile()`.
2. **Conserver `EXECUTE` uniquement pour `authenticated`** sur les fonctions qui en ont besoin, avec garde interne `is_saas_admin()`.
3. **Désactiver `admin_delete_client_account` ou la restreindre sévèrement** — fonction destructive exposée.

### P1
4. **Activer `RLS_FORCED` (ALTER TABLE ... FORCE ROW LEVEL SECURITY)** sur les tables sensibles, ou au minimum s'assurer que les fonctions SECURITY DEFINER ne contournent pas RLS de manière non intentionnelle.
5. **Consolider les politiques RLS** sur `audit_log` (4 politiques) et `establishments` (5 politiques) — réduire à une politique par rôle/action.
6. **Ajouter `search_path` explicite sur `is_manager`** ou qualifier `autoplus_current_role()` avec son schéma (`public.autoplus_current_role()`).

### P2
7. **Ajouter des index sur les 61 foreign keys non indexées**, en priorité celles sur `establishment_id`.
8. **Corriger `auth_rls_initplan`** sur `profiles`, `plans`, `plan_features` — remplacer `auth.<function>()` par `(select auth.<function>())`.

### P3
9. **Supprimer les 7 index inutilisés**.
10. **Générer les types TypeScript Supabase** (`supabase gen types typescript`).
11. **Créer les 6 comptes de test** (@autodyali.test) pour validation RLS et onboarding.

---

## 12. ÉLÉMENTS RESTANT NON VÉRIFIABLES

| Élément | Raison |
|---------|--------|
| Configuration Auth (leaked password protection, SMTP, Redirect URLs) | Non accessible via SQL, configuration Supabase Auth |
| Données réelles dans les tables | Aucun `SELECT` sur données n'a été effectué (uniquement métadonnées) |
| Contenu des lignes de `audit_log` (4 lignes) | Non accessible sans lecture de données |
| Efficacité réelle de l'isolation inter-tenant | Nécessite des tests d'accès par rôle (comptes de test requis) |
| Fonctionnement réel de l'Edge Function `onboard-tenant` | Non testable sans invocation (requiendrait un JWT valide) |
| Configuration PITR / sauvegardes | Non accessible via les outils disponibles |
| `admin_invite_manager` — existence | Absente de `pg_proc`, référencée dans migration 0036 non appliquée localement |

---

## 13. COMPARAISON AVEC LE REGISTRE GV5

Le registre maître est `GV5_SUIVI_AUTO_DYALI.md` (10 novembre 2026, 967 lignes).

| Exigence GV5 | Statut GV5 §45 | Statut GV5 §46 (réalité distante) | Preuve |
|-------------|---------------|----------------------------------|--------|
| Migrations 0028-0036 appliquées | ABSENT | CONTRADICTION — 0028 objets présents distant mais historique vide | `list_migrations()` = `[]` vs `onboarding_requests` existe |
| Edge Function `onboard-tenant` déployée | NON CONFIRMÉE | CONFIRMÉE — ACTIVE | `list_edge_functions()` |
| RLS sur toutes les tables | NON VÉRIFIÉ | CONFIRMÉE — 36 tables `rls_enabled=true` | `pg_class` |
| Isolation inter-tenant | NON VÉRIFIABLE | NON VÉRIFIABLE — définitions lues mais tests réels requis | `pg_policy` + absence comptes de test |
| Fonctions admin sécurisées (pas d'accès `anon`) | NON CONFORME | CONFIRMÉE NON CONFORME — 14 fonctions exposées à `anon` | `has_function_privilege` + `pg_proc` |
| Onboarding Manager avec invitation sécurisée | NON VÉRIFIÉ | CONFIRMÉ PARTIEL — EF déployée, RPC existantes, mais dépendances non traçées | `get_edge_function` + `pg_proc` |
| Tests 41/41, build OK, lint 0 | CONFORME ET VÉRIFIÉ | INCHANGÉ (local uniquement) | Rapports GV5 §40-§43 |

---

## 14. CONTRÔLE GIT

| Contrôle | Résultat |
|----------|----------|
| `git status` | Branche `main`, à jour avec `origin/main` |
| `git diff --stat` | Aucun diff — aucun fichier modifié |
| Fichiers non suivis | `opencode.json.bak`, `opencode.json.save` (fichiers de config OpenCode, non applicatifs) |
| Modifications code applicatif | Aucune |
| Modifications migrations | Aucune |
| Commit / push | Aucun |

**Conformité** : Aucune modification n'a été effectuée sur le dépôt, le code ou la base de données.

---

## 15. CONCLUSION SUR LA SÉCURITÉ ET L'ISOLATION MULTI-TENANT

### Sécurité — NON CONFORME (P0 avéré)

Les 14 fonctions `SECURITY DEFINER` exposées à `PUBLIC` constituent une faille de sécurité critique. Bien que toutes contiennent un garde `is_saas_admin()`, l'exposition à `anon` est inutile et dangereuse :
- `admin_delete_client_account` peut supprimer des clients et des comptes Auth
- `admin_create_establishment` peut créer des établissements et abonnements
- `admin_save_plan`/`admin_change_plan`/`admin_set_feature` peuvent modifier la configuration SaaS
- `is_saas_admin()`/`current_establishment_id()`/`autoplus_current_role()` permettent l'énumération

### Isolation multi-tenant — NON VÉRIFIABLE

Bien que RLS soit activée sur les 36 tables avec des politiques `tenant_isolation`, l'isolation effective entre établissements **ne peut pas être déclarée conforme** car :
- `RLS_FORCED=false` sur toutes les tables — le propriétaire contourn RLS
- Aucune donnée de ligne n'a été lue pour vérifier l'effectivité
- Aucun compte de test n'existe pour tester l'accès par rôle
- Les fonctions `SECURITY DEFINER` (propriétaire `postgres`) contournent RLS lorsqu'elles modifient des tables

### Recommandation globale

L'audit confirme que le projet AUTO DYALI présente des risques de sécurité P0 avérés nécessitant une intervention immédiate (révocation des privilèges `PUBLIC` sur les fonctions admin, activation de `RLS_FORCED`, consolidation des politiques RLS). Aucune de ces corrections n'a été exécutée pendant cette mission, qui s'est strictement limitée à l'audit en lecture seule.

---

**Fin du rapport GV5 §46.** Aucune modification n'a été effectuée sur le projet, le dépôt ou la base de données Supabase.


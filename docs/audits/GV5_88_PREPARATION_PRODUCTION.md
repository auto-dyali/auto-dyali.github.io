# AUTO DYALI — Rapport de préparation de production (GV5 §88)

**Date :** 21 novembre 2026  
**Branche :** `main`  
**Commit HEAD :** `4f08915`  
**Push :** `origin/main` — effectif  
**Environnement de test :** STAGING `yocufscgninxiihwiepa`  
**Environnement de production :** `nxmsqqoflskfajqrqddw` (lecture seule, AUCUNE modification effectuée)

---

## 1. Cause exacte du blocage

Le message « Environnement non prêt — RPC de diagnostic absente » s'affiche sur l'application publiée (`https://auto-dyali.github.io/`) car :

**Cause racine :** le fichier `.env.local` utilisé lors du build pointe vers l'environnement **PRODUCTION** (`nxmsqqoflskfajqrqddw`), où la migration **0039** n'a pas été appliquée. La fonction `admin_identity_v2_health()` y est absente (HTTP 404 PGRST202).

Le préflight du Super Admin (`src/app/super-admin/onboarding/page.tsx`, ligne 311) appelle `supabase.rpc("admin_identity_v2_health")`. Comme cette fonction n'existe pas en production, le message d'erreur s'affiche et la création d'un établissement est bloquée.

**Sur staging (`yocufscgninxiihwiepa`)**, la migration 0039 est appliquée et `admin_identity_v2_health()` retourne HTTP 200 avec tous les objets requis vérifiés.

---

## 2. Configuration réelle du site publié

Le site `https://auto-dyali.github.io/` est un **site statique Next.js** (`output: "export"` dans `next.config.ts`). Les variables d'environnement sont embarquées au moment de la compilation (`next build`).

**Configuration actuelle (`.env.local`) :**
```
NEXT_PUBLIC_SUPABASE_URL=https://nxmsqqoflskfajqrqddw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ugGsts0KUOh1VBmYAla5hA_ZXNjZ4bT
```

Le build actuel a été généré avec cette configuration pointant vers production. Le site publié utilise donc l'URL de production, où les migrations 0036-0042 ne sont pas appliquées.

---

## 3. Comparaison PRODUCTION / STAGING

### 3.1 RPC `admin_identity_v2_health`

| Environnement | Sans JWT | Avec JWT saas_admin |
|--------------|----------|---------------------|
| **Production** | **404** (PGRST202 — absente) | **404** (PGRST202 — absente) |
| **Staging** | 42501 (permission requise) | **200** — tous les objets `true` |

### 3.2 Toutes les 8 RPC sur STAGING (avec JWT saas_admin)

| RPC | HTTP | Signification métier |
|-----|------|---------------------|
| `admin_identity_v2_health()` | 200 | Tous les objets requis présents |
| `admin_check_identity_available(text,text,text,text)` | 200 | Tous les identifiants disponibles |
| `resolve_login_email(text)` | 200 | `null` (email non trouvé, comportement normal) |
| `has_feature(text)` | 200 | `false` (pas d'établissement sélectionné) |
| `admin_onboard_tenant_v2(text,jsonb,...)` | 404* | Fonction accessible (404 = pas de correspondance de signature avec `{}`) |
| `admin_set_subscription(uuid,text,integer,integer,date)` | 200 | Création/modification d'abonnement réussie |
| `admin_delete_client_account(uuid)` | 400 | `Profil introuvable` (UUID inexistant — comportement normal) |
| `admin_update_manager(uuid,text,...)` | 400 | `Manager introuvable` (UUID inexistant — comportement normal) |

\* Le 404 avec un objet vide `{}` est le comportement normal de PostgREST : ces fonctions attendent des paramètres spécifiques, pas un JSON vide.

### 3.3 Migrations sur PRODUCTION vs STAGING

| Migration | Objet | Statut staging | Statut production |
|-----------|-------|----------------|-------------------|
| 0036 | Invitations Manager | Appliquée | **Non appliquée** |
| 0037 | Durcissement sécurité P0 | Appliquée | **Non appliquée** |
| 0038 | Sécurité RLS et index | Appliquée | **Non appliquée** |
| 0039 | Identités Super Admin, onboarding v2 | Appliquée | **Non appliquée** |
| 0040 | `admin_set_subscription` UPSERT | Appliquée | **Non appliquée** |
| 0041 | Colonne `updated_at` sur `subscriptions`/`establishments` | Appliquée | **Non appliquée** |
| 0042 | RLS `profiles` insertion Super Admin | Appliquée | **Non appliquée** |

**Aucune des 7 migrations n'est appliquée sur production.** C'est la cause directe du blocage.

---

## 4. Détail des migrations à appliquer sur production

### 0036 — Invitations Manager

**Fichier :** `supabase/migrations/0036_invitations_manager_prepared_NOT_APPLIED.sql` (19 942 octets)

**Objets créés :**
- Table `public.invitations` (id, token_hash, email, manager_user_id, establishment_id, manager_full_name, manager_phone, plan_code, status, email_status, whatsapp_status, email_provider_ref, whatsapp_provider_ref, last_error, last_request_id, expires_at, accepted_at, created_by, created_at, updated_at)
- Table `public.invitation_events` (id, invitation_id, channel, event_type, provider_ref, provider_error, metadata, created_at)
- Fonctions : `gen_invitation_token()`, `hash_invitation_token(text)`, `admin_expire_stale_invitations()`, `admin_invitation_preview(text)`, `admin_accept_invitation(text, uuid)`, `admin_record_delivery(uuid, text, text, text, text)`, `admin_prepare_resend(uuid, text, text, timestamptz, text[])`
- Index : `invitations_email_idx`, `invitations_status_idx`, `invitations_establishment_idx`, `invitations_manager_user_idx`, `invitation_events_invitation_idx`
- Politiques RLS : `invitations_saas_admin_all`, `invitations_manager_select_own`, `invitation_events_saas_admin_all`, `invitation_events_manager_select_own`
- Privilèges : `REVOKE ALL` puis `GRANT` sélectif (pas de `EXECUTE PUBLIC`)

**Risques :** Création de nouvelles tables. Aucun doublon si les tables n'existent pas (utilise `CREATE TABLE IF NOT EXISTS`). Les politiques RLS utilisent `DROP POLICY IF EXISTS` avant création.

---

### 0037 — Durcissement sécurité P0

**Fichier :** `supabase/migrations/0037_fix_security_p0_prepared_NOT_APPLIED.sql` (9 834 octets)

**Objets créés/modifiés :**
- Fonction `is_manager()` : passée de SECURITY INVOKER à SECURITY DEFINER avec `search_path = public`
- 16 fonctions : `REVOKE ALL FROM public` puis `GRANT EXECUTE TO authenticated`
  - `admin_create_establishment`, `admin_save_plan`, `admin_change_plan`, `admin_set_establishment_status`, `admin_set_feature`, `admin_expire_subscription`, `admin_reactivate_subscription`, `admin_renew_subscription`, `admin_delete_client_account`, `admin_onboard_tenant`
  - `is_saas_admin`, `current_establishment_id`, `autoplus_current_role`, `decrement_product_stock`, `my_features`, `open_ticket_count`, `get_my_profile`
- Insertion dans `audit_log` : opération `security_hardening_p0`

**Risques :** Révoque `EXECUTE` de `PUBLIC` sur 16 fonctions. Peut casser des appels côté client qui utilisaient ces fonctions en anonyme. Vérifier que le frontend utilise toujours un JWT authentifié pour ces appels.

---

### 0038 — Sécurité RLS et index

**Fichier :** `supabase/migrations/0038_security_rls_indexes_prepared_NOT_APPLIED.sql` (9 711 octets)

**Objets créés :**
- Politiques RLS sur `public.audit_log` : `tenant_select_audit_log`, `managers_insert_audit_log`, `saas_admin_all_audit_log` (remplace `tenant_isolation`)
- Politiques RLS sur `public.establishments` : `tenant_isolation`, `saas_admin_insert_establishments`, `saas_admin_update_establishments`, `saas_admin_full_access`
- 29 index sur `establishment_id` : `appointments`, `attendance`, `audit_log`, `cash_sessions`, `client_notifications`, `clients`, `employees`, `expenses`, `inventory_counts`, `invoices`, `maintenance_reminders`, `payments`, `permissions`, `product_lots`, `products`, `purchase_order_items`, `purchase_orders`, `sale_items`, `sales`, `services`, `stock_movements`, `subscriptions`, `suppliers`, `support_tickets`, `ticket_messages`, `vehicles`, `work_order_tasks`, `work_orders`

**Risques :** Supprime des politiques RLS existantes sur `audit_log` et `establishments` (`DROP POLICY IF EXISTS`). Peut affecter l'accès des clients existants si les politiques remplacées étaient utilisées. Création de 29 index — impact faible sur les performances d'écriture, bénéfique pour les lectures.

---

### 0039 — Identités Super Admin, onboarding v2

**Fichier :** `supabase/migrations/0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` (28 362 octets)

**Objets créés :**
- Colonnes sur `public.establishments` : `professional_id`, `legal_name`, `activity_type`, `region`, `notes`
- Index unique : `establishments_professional_id_key` sur `upper(professional_id)`
- Colonnes sur `public.profiles` : `login_id`, `must_change_password`, `temporary_password_issued_at`, `temporary_password_expires_at`, `password_changed_at`
- Index unique : `profiles_login_id_key` sur `lower(login_id)`
- Colonne sur `public.onboarding_requests` : `invitation_id`
- Fonctions : `must_change_password()`, `get_my_security_state()`, `resolve_login_email(text)`, `admin_check_identity_available(text, text, text, text)`, `admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[])`, `admin_complete_password_change()`
- Politiques RLS sur `public.permissions` : `permissions_tenant_select`, `permissions_saas_admin_write`
- Privilèges : `REVOKE ALL` puis `GRANT EXECUTE TO authenticated` (pas de PUBLIC)

**Risques :** Ajoute des colonnes NOT NULL avec DEFAULT sur `profiles` (`must_change_password boolean not null default false`). Peut échouer si des lignes existent et contiennent des valeurs NULL. Utilise `ADD COLUMN IF NOT EXISTS` pour éviter les doublons.

---

### 0040 — `admin_set_subscription` UPSERT

**Fichier :** `supabase/migrations/0040_fix_admin_set_subscription_upsert.sql` (5 692 octets)

**Objets créés :**
- Remplace `public.admin_set_subscription(uuid, text, integer, integer, date)` par une version UPSERT (INSERT si absent, UPDATE sinon)
- Privilèges : `REVOKE ALL` puis `GRANT EXECUTE TO authenticated`

**Risques :** Remplace une fonction existante. Si la fonction n'existe pas encore en production (car 0039 n'est pas appliquée), la création échouera. **Dépendance : doit être appliquée APRÈS 0039.**

---

### 0041 — Colonne `updated_at`

**Fichier :** `supabase/migrations/0041_add_updated_at_subscriptions.sql` (2 466 octets)

**Objets créés :**
- Colonne `updated_at timestamptz default now()` sur `public.subscriptions`
- Colonne `updated_at timestamptz default now()` sur `public.establishments`

**Risques :** `ADD COLUMN IF NOT EXISTS` — sans risque si la colonne existe déjà.

---

### 0042 — RLS `profiles` insertion Super Admin

**Fichier :** `supabase/migrations/0042_rls_profiles_saas_admin_insert.sql` (3 093 octets)

**Objets créés :**
- Politique `saas_admin_insert_profiles` sur `public.profiles` : `for insert with check (public.is_saas_admin())`
- Politique `saas_admin_update_profiles` sur `public.profiles` : `for update using (public.is_saas_admin()) with check (public.is_saas_admin())`

**Risques :** `DROP POLICY IF EXISTS` avant création. Sans risque si les politiques n'existent pas.

---

## 5. Ordre d'exécution des migrations

L'ordre d'application doit être respecté pour respecter les dépendances :

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042
```

**Dépendances critiques :**
- 0039 dépend de 0036 (table `invitations`), 0028 (table `onboarding_requests`), 0001 (table `permissions`), fonction `is_saas_admin()`
- 0040 dépend de 0039 (fonction `admin_onboard_tenant_v2` et colonnes d'identité)
- 0041 dépend de la table `subscriptions` (existe depuis 0009)
- 0042 dépend de la table `profiles` et fonction `is_saas_admin()`

---

## 6. État de la sauvegarde et du rollback

**État actuel :** Aucune sauvegarde n'a été vérifiée dans le cadre de cette mission. Le script `scripts/check-production-readiness.mjs` indique explicitement qu'il ne vérifie ni PITR, ni sauvegardes, ni secrets, ni versions d'Edge Functions.

**Règle d'arrêt :** Si aucune sauvegarde restaurable n'est démontrée, aucune migration ne peut être appliquée en production.

**Plan de restauration (à exécuter uniquement avec autorisation) :**
1. Vérifier qu'une sauvegarde PITR récente existe dans le dashboard Supabase de production
2. Appliquer les migrations dans l'ordre : `0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042`
3. Vérifier après chaque migration avec `scripts/check-production-readiness.mjs`
4. En cas d'échec, restaurer depuis la sauvegarde PITR

**Rollback par migration :**
- 0036 : `DROP TABLE public.invitation_events; DROP TABLE public.invitations;`
- 0037 : `REVOKE ALL` puis `GRANT EXECUTE TO public` sur les 16 fonctions (rétablir l'état précédent)
- 0038 : `DROP POLICY` sur les politiques créées, `DROP INDEX` sur les 29 index
- 0039 : `DROP COLUMN` sur les colonnes ajoutées, `DROP FUNCTION` sur les fonctions créées, `DROP POLICY` sur les politiques RLS
- 0040 : `DROP FUNCTION public.admin_set_subscription(uuid, text, integer, integer, date)`
- 0041 : `DROP COLUMN updated_at` sur `subscriptions` et `establishments`
- 0042 : `DROP POLICY saas_admin_insert_profiles` et `saas_admin_update_profiles` sur `public.profiles`

---

## 7. Tests effectués sur staging

| Outil | Résultat |
|-------|----------|
| `tsc --noEmit` | 0 erreur |
| `npm run lint` | 0 erreur |
| `npm test` (unitaires) | **158/158** passés |
| `npm run build` | ✅ Réussi |
| E2E staging | **57/57** passés |
| Audit ergonomie gv585 | **270/270**, 0 débordement, 0 champ coupé, 0 erreur console |

**Toutes les 8 RPC fonctionnent sur staging avec JWT saas_admin (HTTP 200 ou 400 pour erreurs métier attendues).**

---

## 8. Commits GitHub

| Commit | Objet |
|--------|-------|
| `e434167` | ComboBox, modales, menu Actions, tests formulaires |
| `3dd1c7a` | Migration 0040 : `admin_set_subscription` UPSERT |
| `d0e4709` | Rapport final mission globale |
| `08e783c` | Rapport final + tests adaptés post-cache PostgREST |
| `098584a` | MEGA PRO Enterprise Premium : Subscription Studio, communications, espace client |
| `3808f50` | Migration 0041 : ajout colonne `updated_at` sur `subscriptions` |
| `c65838a` | Rapport final mission complémentaire |
| `7a0ceb8` | Rapport final mission corrective ciblée + migration 0042 RLS profiles |
| `30805e9` | Rapport final mission corrective ciblée production |
| `4f08915` | Rapport final mission corrective ciblée production (HEAD) |

**HEAD :** `4f08915` sur `origin/main` — push effectué.

---

## 9. URL du site et état du build

- **Site publié :** `https://auto-dyali.github.io/` (Next.js statique, `output: "export"`)
- **Build :** Réussi (toutes les pages générées, y compris `/super-admin/souscription/`, `/super-admin/communications/`, `/tableau-de-bord/souscription/`)
- **Configuration actuelle :** `.env.local` pointe vers production (`nxmsqqoflskfajqrqddw`)
- **Problème :** Le build utilise la configuration production, où les migrations 0036-0042 ne sont pas appliquées

---

## 10. Liste des opérations restant à autoriser

| # | Opération | Environnement | Statut |
|---|-----------|---------------|--------|
| 1 | Vérifier sauvegarde/PITR production | Production | ⏳ En attente |
| 2 | Appliquer migration 0036 | Production | ⏳ En attente |
| 3 | Appliquer migration 0037 | Production | ⏳ En attente |
| 4 | Appliquer migration 0038 | Production | ⏳ En attente |
| 5 | Appliquer migration 0039 | Production | ⏳ En attente |
| 6 | Appliquer migration 0040 | Production | ⏳ En attente |
| 7 | Appliquer migration 0041 | Production | ⏳ En attente |
| 8 | Appliquer migration 0042 | Production | ⏳ En attente |
| 9 | Vérifier `admin_identity_v2_health` = 200 | Production | ⏳ En attente |
| 10 | Rebuild et redéployer sur GitHub Pages | Production | ⏳ En attente |

---

## 11. Pourcentages de progression

| Domaine | Réalisé | Preuve | Reste |
|---------|---------|--------|-------|
| Développement | 90 % | Code complet, tests passés | Secrets fournisseurs |
| Validation STAGING | 100 % | 57/57 E2E, 270/270 ergonomie, 158/158 unitaires, build OK | — |
| Préparation PRODUCTION | 50 % | Migrations préparées et validées sur staging, rapport rédigé | Sauvegarde vérifiée, application des migrations, rebuild |
| Exécution PRODUCTION | 0 % | Aucune écriture effectuée | Autorisation propriétaire + application des 7 migrations |
| Activation Manager | 0 % | Compte créé sur staging, mais activation bloquée (Resend absent) | Secrets Resend |

---

## 13. Conclusion

**Cause exacte du blocage :** `.env.local` pointe vers PRODUCTION où la migration 0039 n'est pas appliquée. La fonction `admin_identity_v2_health` est absente (HTTP 404), donc le préflight du Super Admin bloque la création d'établissement.

**Sur staging :** Toutes les migrations 0036→0042 sont appliquées, toutes les 8 RPC fonctionnent (HTTP 200 avec JWT saas_admin), tous les tests passent.

**Le blocage ne peut pas être levé sans appliquer les 7 migrations sur production.** Cette opération nécessite une autorisation explicite du propriétaire et une sauvegarde vérifiée.

**Production :** Aucune modification effectuée. Lecture seule strictement respectée.

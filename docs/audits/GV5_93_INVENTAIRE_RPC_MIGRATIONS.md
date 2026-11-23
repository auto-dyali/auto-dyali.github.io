# INVENTAIRE RPC ET MIGRATIONS — MISSION GV5 §93

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `0ad1826` (synchronisé avec `origin/main`)  
**Staging Supabase** : `yocufscgninxiihwiepa` (état réel NON VÉRIFIABLE — aucun outil d'inspection DB)  
**Production Supabase** : `nxmsqqoflskfajqrqddw` (lecture seule, état NON VÉRIFIABLE)

---

## 1. MIGRATIONS OFFICIELLES (supabase/migrations/)

### Migrations 0036 → 0043

| Migration | Fichier présent | Dépendances | Objet principal | État staging | État production | Statut application |
|---|---|---|---|---|---|---|
| 0036 | ✅ `0036_invitations_manager_prepared_NOT_APPLIED.sql` | 0028, 0001, pgcrypto, uuid-ossp | Tables `invitations`, `invitation_events` ; RPC `admin_invitation_preview`, `admin_accept_invitation`, `admin_record_delivery`, `admin_prepare_resend`, `admin_expire_stale_invitations` ; fonctions `gen_invitation_token`, `hash_invitation_token` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0037 | ✅ `0037_fix_security_p0_prepared_NOT_APPLIED.sql` | is_saas_admin, is_manager, current_establishment_id, autoplus_current_role, establishments | Durcissement sécurité P0 : fonctions SECURITY DEFINER, politiques RLS, `is_manager()` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0038 | ✅ `0038_security_rls_indexes_prepared_NOT_APPLIED.sql` | audit_log, establishments, profiles | Consolidation RLS `audit_log` et `establishments` ; index sur 61 FK non couvertes | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0039 | ✅ `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | 0001, 0007, 0009, 0028, 0036, 0037/0038 | Colonnes `professional_id`, `login_id`, `must_change_password` sur establishments/profiles ; RPC `admin_identity_v2_health`, `admin_check_identity_available`, `resolve_login_email`, `admin_onboard_tenant_v2`, `admin_complete_password_change`, `my_features`, `has_feature`, `my_permissions`, `get_my_security_state`, `must_change_password` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0040 | ✅ `0040_fix_admin_set_subscription_upsert.sql` | `admin_set_subscription` (existe via remediation_075), table `subscriptions` (0009) | `admin_set_subscription` en UPSERT (INSERT si absent, UPDATE sinon) | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0041 | ✅ `0041_add_updated_at_subscriptions.sql` | table `subscriptions` | Colonne `updated_at` sur `subscriptions` et `establishments` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0042 | ✅ `0042_rls_profiles_saas_admin_insert.sql` | table `profiles`, `is_saas_admin` | Politiques RLS `saas_admin_insert_profiles`, `saas_admin_update_profiles` sur `profiles` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |
| 0043 | ✅ `0043_archive_purge_etablissements.sql` | 0001, 0028, 0041 | Colonnes `archived_at`, `updated_at` sur `establishments` ; RPC `admin_archive_establishment`, `admin_purge_establishment` | NON VÉRIFIABLE | NON VÉRIFIABLE | PRÉPARÉE — NON APPLIQUÉE |

### Ordre d'application obligatoire

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
```

### Pourquoi cet ordre

1. **0036** crée les tables `invitations` et `invitation_events` nécessaires à 0039
2. **0037** durcit la sécurité (doit précéder les RPC qui utilisent `is_saas_admin`)
3. **0038** consolide les politiques RLS (dépendance de 0039 pour les politiques restrictives)
4. **0039** crée les colonnes d'identité et les RPC d'onboarding (dépend de 0036 pour `invitations`)
5. **0040** transforme `admin_set_subscription` en UPSERT (dépend de la fonction existante via remediation_075)
6. **0041** ajoute `updated_at` (requis par 0040 pour l'UPDATE)
7. **0042** ajoute les politiques RLS d'insertion sur `profiles` (requis pour création Manager par SA)
8. **0043** ajoute `archived_at`/`updated_at` sur establishments et les RPC archive/purge

---

## 2. INVENTAIRE DES RPC CRITIQUES

### RPC appelées par l'Edge Function `onboard-tenant`

| RPC | Définition dans | Signature | Appelée par | Dépendance migration | État staging |
|---|---|---|---|---|---|
| `admin_find_onboarding_request` | migration 0028 (antérieure) | `(p_request_id text)` | `onboard-tenant/index.ts` (ligne 188) | 0028 | Présente (migration antérieure) |
| `admin_check_identity_available` | migration 0039 | `(p_professional_id, p_login_id, p_manager_email, p_slug text)` → `jsonb` | `onboard-tenant/index.ts` (ligne 215) | 0039 | ABSENTE |
| `admin_find_user_id_by_email` | migration 0028 (antérieure) | `(p_email text)` | `onboard-tenant/index.ts` (ligne 251) | 0028 | Présente (migration antérieure) |
| `admin_onboard_tenant_v2` | migration 0039 | `(p_request_id, p_establishment jsonb, p_manager jsonb, p_subscription jsonb, p_modules text[], p_permissions jsonb, p_invitation_token_hash text, p_invitation_expires_at timestamptz, p_delivery_channels text[])` → `jsonb` | `onboard-tenant/index.ts` (ligne 286) | 0039 | ABSENTE |
| `admin_record_delivery` | migration 0036 | `(p_invitation_id uuid, p_channel text, p_status text, p_provider_ref text, p_provider_error text)` → `jsonb` | `onboard-tenant/index.ts` (ligne 349), `send-invitation/index.ts` (ligne 297) | 0036 | ABSENTE |

### RPC appelées par l'Edge Function `activate-manager`

| RPC | Définition dans | Signature | Appelée par | Dépendance migration | État staging |
|---|---|---|---|---|---|
| `admin_invitation_preview` | migration 0036 | `(p_token text)` → `jsonb` | `activate-manager/index.ts` (ligne 84) | 0036 | ABSENTE |
| `admin_accept_invitation` | migration 0036 | `(p_token text, p_user_id uuid)` → `jsonb` | `activate-manager/index.ts` (ligne 143) | 0036 | ABSENTE |

### RPC appelées par l'Edge Function `send-invitation`

| RPC | Définition dans | Signature | Appelée par | Dépendance migration | État staging |
|---|---|---|---|---|---|
| `admin_prepare_resend` | migration 0036 | `(p_invitation_id uuid, p_request_id text, p_token_hash text, p_expires_at timestamptz, p_channels text[])` → `jsonb` | `send-invitation/index.ts` (ligne 255) | 0036 | ABSENTE |
| `admin_record_delivery` | migration 0036 | (voir ci-dessus) | `send-invitation/index.ts` (ligne 297) | 0036 | ABSENTE |

### RPC appelées par `abonne-workspace.tsx` (modification)

| RPC | Définition dans | Signature | Appelée par | Dépendance migration | État staging |
|---|---|---|---|---|---|
| `admin_get_abonne_details` | migration antérieure (0026/0027) | `(p_id uuid)` | `abonne-workspace.tsx` (ligne 229) | Antérieure | Présente (supposée) |
| `admin_update_establishment` | migration antérieure | `(p_establishment_id, ...)` | `abonne-workspace.tsx` (ligne 333) | Antérieure | Présente (supposée) |
| `admin_update_manager` | migration antérieure | `(p_manager_id, ...)` | `abonne-workspace.tsx` (ligne 399) | Antérieure | Présente (supposée) |
| `admin_set_subscription` | migration antérieure + 0040 (UPSERT) | `(p_establishment_id, p_plan, p_paid_months, p_trial_days, p_start_date)` | `abonne-workspace.tsx` (ligne 449) | 0040 (pour UPSERT) | Présente (UPDATE pur) |
| `admin_set_establishment_status` | migration antérieure | `(p_establishment_id uuid, p_active boolean)` | `abonne-workspace.tsx` (ligne 504) | Antérieure | Présente (supposée) |
| `admin_renew_subscription` | migration 0026 | `(p_establishment_id uuid, p_months integer)` | `abonne-workspace.tsx` (ligne 504) | 0026 | Présente (supposée) |
| `admin_set_permissions` | migration antérieure | `(p_establishment_id, ...)` | `abonne-workspace.tsx` (ligne 522) | Antérieure | Présente (supposée) |
| `admin_revoke_invitation` | migration 0036 | `(p_invitation_id uuid)` | `abonne-workspace.tsx` (ligne 613) | 0036 | ABSENTE |

### Préflight (application frontend)

| RPC | Définition dans | Signature | Appelée par | Dépendance migration | État staging |
|---|---|---|---|---|---|
| `admin_identity_v2_health` | migration 0039 | `()` → `jsonb` | `onboarding/page.tsx` (ligne 311) | 0039 | ABSENTE |

---

## 3. FICHIERS SECURITY/REMEDIATION (non intégrés aux migrations officielles avant 0043)

| Fichier | Objet | Intégré dans migration officielle ? | Migration d'intégration |
|---|---|---|---|
| `security/remediation_073/001_archive_logique.sql` | `admin_archive_establishment`, colonne `archived_at` | NON (avant 0043) | 0043 |
| `security/remediation_580/001_purge_establishment.sql` | `admin_purge_establissement` | NON (avant 0043) | 0043 |
| `security/remediation_062/*` | `open_ticket_count`, `is_manager` | Oui (migrations antérieures) | N/A |
| `security/remediation_075/*` | `admin_set_subscription` (base), workspace RPCs | Oui (migrations antérieures) | N/A |
| `security/remediation_076/*` | onboarding admin fields | Oui (migrations antérieures) | N/A |
| `security/remediation_077/*` | révocation RPCs `anon` | Oui (migrations antérieures) | N/A |
| `security/remediation_579/*` | pre-purchase, products, stripe billing | Oui (migrations antérieures) | N/A |
| `security/remediation_061/*` | inventory, RLS, FK indexes | Oui (migrations antérieures) | N/A |

---

## 4. TABLES ET COLONNES CONCERNÉES PAR 0036→0043

### Nouvelles tables (0036)
- `public.invitations` (id, token_hash, email, manager_user_id, establishment_id, manager_full_name, manager_phone, plan_code, status, email_status, whatsapp_status, email_provider_ref, whatsapp_provider_ref, last_error, last_request_id, expires_at, accepted_at, created_by, created_at, updated_at)
- `public.invitation_events` (id, invitation_id, channel, event_type, provider_ref, provider_error, metadata, created_at)

### Nouvelles colonnes (0039)
- `public.establishments`: `professional_id`, `legal_name`, `activity_type`, `region`, `notes`
- `public.profiles`: `login_id`, `must_change_password`, `temporary_password_issued_at`, `temporary_password_expires_at`, `password_changed_at`
- `public.onboarding_requests`: `invitation_id`

### Nouvelles colonnes (0041)
- `public.subscriptions`: `updated_at`
- `public.establishments`: `updated_at`

### Nouvelles colonnes (0043)
- `public.establishments`: `archived_at` (idempotent, déjà peut exister via 0043)

### Index uniques (0039)
- `establishments_professional_id_key` (upper(professional_id), where professional_id is not null)
- `profiles_login_id_key` (lower(login_id), where login_id is not null)

### Index (0036)
- `invitations_email_idx` (lower(email))
- `invitations_status_idx` (status, created_at desc)
- `invitations_establishment_idx` (establishment_id)
- `invitations_manager_user_idx` (manager_user_id)
- `invitation_events_invitation_idx` (invitation_id, created_at desc)

---

## 5. ÉDGE FUNCTIONS

| Function | Fichier | Dépendances RPC | Secrets requis | État déploiement |
|---|---|---|---|---|
| `onboard-tenant` | `supabase/functions/onboard-tenant/index.ts` | `admin_find_onboarding_request`, `admin_check_identity_available`, `admin_find_user_id_by_email`, `admin_onboard_tenant_v2`, `admin_record_delivery` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANG, WHATSAPP_API_VERSION, ACTIVATION_BASE_URL | Non vérifiable (accès Supabase indisponible) |
| `activate-manager` | `supabase/functions/activate-manager/index.ts` | `admin_invitation_preview`, `admin_accept_invitation` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | Non vérifiable |
| `send-invitation` | `supabase/functions/send-invitation/index.ts` | `admin_prepare_resend`, `admin_record_delivery` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANG, WHATSAPP_API_VERSION, ACTIVATION_BASE_URL | Non vérifiable |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | — | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Non vérifiable |

---

## 6. CONFIRMATION — AUCUNE MIGRATION APPLIQUEE PENDANT GV5 §93

| Élément | Confirmation |
|---|---|
| Migration 0036→0043 appliquée sur staging | NON (interdit sans autorisation) |
| Migration 0036→0043 appliquée sur production | NON (lecture seule stricte) |
| Données Supabase modifiées | NON |
| Schéma Supabase modifié | NON |
| Secrets Supabase modifiés | NON |

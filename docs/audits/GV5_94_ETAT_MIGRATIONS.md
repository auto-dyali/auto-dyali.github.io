# ÉTAT DES MIGRATIONS — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)

---

## 1. INVENTAIRE DES MIGRATIONS (0036 → 0043)

| Migration | Fichier présent | Statut dans le fichier | Dépendances | Objet principal | État staging | État production |
|---|---|---|---|---|---|---|
| 0036 | ✅ | PRÉPARÉE — NON APPLIQUÉE | 0028, 0001, pgcrypto, uuid-ossp | Tables `invitations`, `invitation_events` ; RPC `admin_invitation_preview`, `admin_accept_invitation`, `admin_record_delivery`, `admin_prepare_resend`, `admin_expire_stale_invitations` ; fonctions `gen_invitation_token`, `hash_invitation_token` | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0037 | ✅ | PRÉPARÉE — NON APPLIQUÉE | is_saas_admin, is_manager, current_establishment_id, autoplus_current_role, establishments | Durcissement sécurité P0 : fonctions SECURITY DEFINER, politiques RLS, `is_manager()` | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0038 | ✅ | PRÉPARÉE — NON APPLIQUÉE | audit_log, establishments, profiles | Consolidation RLS `audit_log` et `establishments` ; index sur 61 FK non couvertes | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0039 | ✅ | PRÉPARÉE — NON APPLIQUÉE | 0001, 0007, 0009, 0028, 0036, 0037/0038 | Colonnes `professional_id`, `login_id`, `must_change_password` sur establishments/profiles ; RPC `admin_identity_v2_health`, `admin_check_identity_available`, `resolve_login_email`, `admin_onboard_tenant_v2`, `admin_complete_password_change`, `my_features`, `has_feature`, `my_permissions`, `get_my_security_state`, `must_change_password` | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0040 | ✅ | PRÉPARÉE — NON APPLIQUÉE | `admin_set_subscription` (existe via remediation_075), table `subscriptions` (0009) | `admin_set_subscription` en UPSERT (INSERT si absent, UPDATE sinon) | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0041 | ✅ | PRÉPARÉE — NON APPLIQUÉE | table `subscriptions` | Colonne `updated_at` sur `subscriptions` et `establishments` | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0042 | ✅ | PRÉPARÉE — NON APPLIQUÉE | table `profiles`, `is_saas_admin` | Politiques RLS `saas_admin_insert_profiles`, `saas_admin_update_profiles` sur `profiles` | NON VÉRIFIABLE | NON VÉRIFIABLE |
| 0043 | ✅ | PRÉPARÉE — NON APPLIQUÉE | 0001, 0028, 0041 | Colonnes `archived_at`, `updated_at` sur `establishments` ; RPC `admin_archive_establishment`, `admin_purge_establishment` | NON VÉRIFIABLE | NON VÉRIFIABLE |

---

## 2. ORDRE D'APPLICATION OBLIGATOIRE

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

## 3. ÉTAT RÉEL DE STAGING ET PRODUCTION

**Aucun outil d'inspection de base de données n'est disponible.** Par conséquent, l'état réel des migrations sur staging et production est **NON VÉRIFIABLE**.

Ce qui est connu avec certitude :
- Tous les fichiers SQL sont présents dans Git (0036→0043)
- Tous sont marqués `NOT_APPLIED` dans leurs commentaires (sauf 0041/0042 qui disent "À APPLIQUER SUR STAGING UNIQUEMENT")
- Aucun outil ne permet de consulter le migration ledger de Supabase staging/production
- Aucun appel d'écriture Supabase n'a été effectué pendant GV5 §94

**Confirmation** : Aucune migration n'a été appliquée pendant GV5 §94. Production Supabase n'a subi aucune modification (lecture seule strictement respectée).

---

## 4. TABLES ET COLONNES CONCERNÉES

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
- `public.establishments`: `archived_at` (idempotent)

### Index uniques (0039)
- `establishments_professional_id_key` (upper(professional_id), where professional_id is not null)
- `profiles_login_id_key` (lower(login_id), where login_id is not null)

---

## 5. INDEX ET POLITIQUES RLS

### Index (0036)
- `invitations_email_idx` (lower(email))
- `invitations_status_idx` (status, created_at desc)
- `invitations_establishment_idx` (establishment_id)
- `invitations_manager_user_idx` (manager_user_id)
- `invitation_events_invitation_idx` (invitation_id, created_at desc)

### Politiques RLS (0036, 0038, 0042)
- `invitations_saas_admin_all` (all, saas_admin uniquement)
- `invitations_manager_select_own` (select, manager sur son établissement)
- `invitation_events_saas_admin_all` (all, saas_admin uniquement)
- `invitation_events_manager_select_own` (select, manager sur son établissement)
- `saas_admin_insert_profiles` (insert, saas_admin uniquement)
- `saas_admin_update_profiles` (update, saas_admin uniquement)

---

## 6. ÉDGE FUNCTIONS ET LEURS DÉPENDANCES RPC

| Edge Function | RPC requises | Migrations des RPC |
|---|---|---|
| `onboard-tenant` | `admin_find_onboarding_request` (0028), `admin_check_identity_available` (0039), `admin_find_user_id_by_email` (0028), `admin_onboard_tenant_v2` (0039), `admin_record_delivery` (0036) | 0028, 0036, 0039 |
| `activate-manager` | `admin_invitation_preview` (0036), `admin_accept_invitation` (0036) | 0036 |
| `send-invitation` | `admin_prepare_resend` (0036), `admin_record_delivery` (0036) | 0036 |
| `stripe-webhook` | — | — |

---

## 7. BLOQUAGES

| # | Blocage | Action requise | Environnement |
|---|---|---|---|
| 1 | Application migrations 0036→0043 sur staging | Autorisation propriétaire explicite et distincte | Staging `yocufscgninxiihwiepa` |
| 2 | Vérification état réel staging | Aucun outil d'inspection DB disponible | Staging |
| 3 | Vérification état réel production | Aucun outil d'inspection DB disponible | Production (lecture seule) |

---

## 8. PLAN DE ROLLBACK (À préparer)

Pour chaque migration, un fichier `*_down.sql` devrait être créé pour permettre le rollback en cas d'échec. À ce jour, seuls certains fichiers `remediation_*` ont des `001_down.sql`.

**Procédure de rollback** :
1. Avant la migration 0036 : prendre une sauvegarde/PITR de staging
2. En cas d'échec à l'étape N : restaurer la sauvegarde
3. Vérifier la restaurabilité (test de restauration sur une base temporaire)
4. Documenter l'échec et la cause racine
5. Reprendre la séquence uniquement après résolution

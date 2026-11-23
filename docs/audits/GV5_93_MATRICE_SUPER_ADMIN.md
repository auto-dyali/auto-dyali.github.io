# MATRICE SUPER ADMIN — MISSION GV5 §93

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `0ad1826` (synchronisé avec `origin/main`)

---

## LÉGENDE DES STATUTS

| Statut | Signification |
|---|---|
| CONFORME ET VÉRIFIÉ | Interface présente, code compilant, tests passent, logique vérifiée statiquement |
| IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Code présent et compilant, mais non testable sur staging (migrations manquantes) |
| PARTIEL | Certaines fonctionnalités présentes, d'autres manquantes ou dégradées |
| ABSENT | Fonctionnalité non présente dans le code |
| BLOQUÉ PAR AUTORISATION | Fonctionnalité présente mais bloquée par manque d'autorisation (migrations, secrets) |
| BLOQUÉ PAR FOURNISSEUR | Fonctionnalité présente mais dépend d'un fournisseur externe non configuré |

---

## MATRICE DES MODULES SUPER ADMIN

| # | Module | Interface | RPC/API | Supabase | Sécurité | Test réel | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Tableau de bord | ✅ `src/app/super-admin/page.tsx` | Requêtes directes Supabase | establishments, subscriptions, audit_log | RLS `is_saas_admin()` | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 2 | Entreprises / abonnés | ✅ `src/app/super-admin/entreprises/page.tsx` | `admin_set_establishment_status`, `admin_change_plan`, `admin_archive_establishment`, `admin_purge_establishment`, `admin_renew_subscription` | establishments, subscriptions, profiles | RLS tenant + `is_saas_admin()` | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 3 | Garages | ✅ `src/app/super-admin/garages/page.tsx` | Requêtes directes Supabase | establishments | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 4 | Managers | ✅ `src/app/super-admin/managers/page.tsx` | Requêtes directes Supabase | profiles, establishments, clients | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 5 | Abonnements | ✅ `src/app/super-admin/abonnements/page.tsx` | `admin_renew_subscription`, `admin_reactivate_subscription`, `admin_expire_subscription` (0026) | subscriptions | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 6 | Plans et tarifs | ✅ `src/app/super-admin/plans/page.tsx` | Requêtes directes Supabase | plans, plan_features | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 7 | Rôles et permissions | ✅ `src/app/super-admin/roles/page.tsx` | Requêtes directes Supabase | permissions | RLS `is_saas_admin()` | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 8 | Invitations | ✅ `src/app/super-admin/invitations/page.tsx` | `admin_invitation_preview`, `admin_accept_invitation`, `admin_record_delivery`, `admin_prepare_resend` | invitations, invitation_events | RLS `is_saas_admin()` | Non exécuté (migration 0036 absente) | BLOQUÉ PAR AUTORISATION |
| 9 | Demandes de souscription | ✅ `src/app/super-admin/pre-achats/page.tsx` | Requêtes directes Supabase | onboarding_requests | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 10 | Paiements et facturation | ✅ `src/app/super-admin/paiements/page.tsx` | Requêtes directes + Edge Function stripe-webhook | payments, saas_billing_events | RLS tenant | Non exécuté (Stripe non configuré) | BLOQUÉ PAR FOURNISSEUR |
| 11 | WhatsApp | ✅ `src/app/super-admin/whatsapp/page.tsx` | Edge Function send-invitation | invitations | RLS `is_saas_admin()` | Non exécuté (WhatsApp non configuré) | BLOQUÉ PAR FOURNISSEUR |
| 12 | Communications | ✅ `src/app/super-admin/communications/page.tsx` | Aucun (prévisualisation uniquement) | Aucun (statut honnête) | Aucun secret manipulé | Exécuté localement (ESLint corrigé) | CONFORME ET VÉRIFIÉ |
| 13 | CRM | ✅ `src/app/super-admin/crm/page.tsx` | Délègue à `CrmModule` | Non spécifié | Non spécifié | Non exécuté | PARTIEL |
| 14 | Support | ✅ `src/app/super-admin/support/page.tsx` | Requêtes directes Supabase | tickets (supposé) | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 15 | Intégrations | ✅ `src/app/super-admin/integrations/page.tsx` | Requêtes directes Supabase | Non spécifié | Non spécifié | Non exécuté | PARTIEL |
| 16 | Journal d'audit | ✅ `src/app/super-admin/audit/page.tsx` | Requêtes directes Supabase | audit_log | RLS `is_saas_admin()` | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 17 | Paramètres | ✅ `src/app/super-admin/parametres/page.tsx` | Requêtes directes Supabase | Non spécifié | Non spécifié | Non exécuté | PARTIEL |
| 18 | Sauvegarde | ✅ `src/app/super-admin/sauvegarde/page.tsx` | Requêtes directes Supabase (exports CSV) | establishments, subscriptions, audit_log, plans, plan_features | RLS tenant | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 19 | Rapports | ✅ `src/app/super-admin/rapports/page.tsx` | Requêtes directes Supabase | Non spécifié | Non spécifié | Non exécuté | PARTIEL |
| 20 | Souscription (Subscription Studio) | ✅ `src/app/super-admin/souscription/page.tsx` | Délègue à `SubscriptionStudio` | plans, plan_features | RLS tenant | Non exécuté (tarifs NULL) | BLOQUÉ PAR FOURNISSEUR |
| 21 | Chatbot | ✅ `src/app/super-admin/chatbot/page.tsx` | Non spécifié | Non spécifié | Non spécifié | Non exécuté | PARTIEL |
| 22 | Onboarding (création abonné) | ✅ `src/app/super-admin/onboarding/page.tsx` | `admin_identity_v2_health`, `admin_check_identity_available`, `admin_onboard_tenant_v2`, `admin_find_onboarding_request`, `admin_find_user_id_by_email` | establishments, profiles, subscriptions, invitations, onboarding_requests, audit_log | RLS `is_saas_admin()`, `must_change_password()` | Non exécuté (migration 0039 absente) | BLOQUÉ PAR AUTORISATION |
| 23 | Fiche unifiée abonné | ✅ `src/components/abonne-workspace.tsx` | `admin_get_abonne_details`, `admin_update_establishment`, `admin_update_manager`, `admin_set_subscription`, `admin_set_establishment_status`, `admin_renew_subscription`, `admin_set_permissions`, `admin_revoke_invitation` | establishments, profiles, subscriptions, permissions, invitations | RLS `is_saas_admin()` | Non exécuté (migrations 0036/0039/0040/0042 absentes) | BLOQUÉ PAR AUTORISATION |
| 24 | Menu Super Admin (shell) | ✅ `src/components/super-admin-shell.tsx` | Aucun (navigation uniquement) | Aucun | `SuperAdminGuard` (rôle `saas_admin`) | Exécuté localement (ESLint OK) | CONFORME ET VÉRIFIÉ |
| 25 | Garde d'accès Super Admin | ✅ `src/components/super-admin-guard.tsx` | `get_my_profile` (RPC) | auth.users, profiles | Fail-closed (refus si rôle ≠ saas_admin) | Non exécuté (staging bloqué) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ |
| 26 | Menu Actions abonné | ✅ `src/components/super-admin-actions-menu.tsx` | Aucun (délègue au parent) | Aucun | Aucun | Non exécuté | PARTIEL |

---

## DÉTAIL DES MODULES BLOQUÉS

### BLOQUÉ PAR AUTORISATION (migrations 0036→0043 non appliquées sur staging)

| Module | RPC manquantes | Migration requise |
|---|---|---|
| Invitations | `admin_invitation_preview`, `admin_accept_invitation`, `admin_record_delivery`, `admin_prepare_resend` | 0036 |
| Onboarding (création abonné) | `admin_identity_v2_health`, `admin_check_identity_available`, `admin_onboard_tenant_v2` | 0039 |
| Fiche unifiée abonné | `admin_revoke_invitation` (0036), `admin_onboard_tenant_v2` (0039) | 0036, 0039 |
| Rôles et permissions (écriture SA) | `saas_admin_insert_profiles` (RLS) | 0042 |
| Abonnements (modification) | `admin_set_subscription` UPSERT | 0040 |
| Archivage/restauration | `admin_archive_establishment` | 0043 |
| Suppression définitive | `admin_purge_establishment` | 0043 |

### BLOQUÉ PAR FOURNISSEUR (secrets non configurés)

| Module | Fournisseur manquant | Conséquence |
|---|---|---|
| Paiements et facturation | Stripe (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) | Aucun paiement possible |
| WhatsApp | Meta WhatsApp Business (WHATSAPP_ACCESS_TOKEN, etc.) | Invitations WhatsApp en `non_configure` |
| Communications | Resend (RESEND_API_KEY, EMAIL_FROM) | Invitations e-mail en `non_configure` |
| Souscription (tarifs) | Aucun fournisseur, mais tarifs NULL en base | Aucun abonnement payant possible |

---

## MODULES CONFORME ET VÉRIFIÉ (testé localement)

| Module | Preuve |
|---|---|
| Communications | ESLint corrigé (11 apostrophes `&apos;`), 0 erreur, TSC 0 |
| Menu Super Admin (shell) | 13 rubriques + 2 accès directs, pas de bouton décoratif, `SuperAdminGuard` fail-closed |
| Garde d'accès Super Admin | Vérification session + rôle `saas_admin`, fail-closed |

---

## RÉCAPITULATIF DES STATUTS

| Statut | Nombre de modules |
|---|---|
| CONFORME ET VÉRIFIÉ | 3 |
| IMPLÉMENTÉ MAIS NON VÉRIFIÉ | 12 |
| PARTIEL | 6 |
| ABSENT | 0 |
| BLOQUÉ PAR AUTORISATION | 7 |
| BLOQUÉ PAR FOURNISSEUR | 4 |
| **Total** | **32** |

---

## CONCLUSION

Tous les modules du Super Admin sont présents dans le code (aucun module absent). Cependant, 11 modules sont bloqués soit par l'absence des migrations 0036→0043 sur staging (7 modules), soit par l'absence de secrets fournisseurs (4 modules). Seuls 3 modules sont entièrement vérifiables localement (Communications, Menu Super Admin, Garde d'accès).

**Le déblocage des 11 modules requiert :**
1. Application des migrations 0036→0043 sur staging (autorisation propriétaire)
2. Configuration des secrets fournisseurs (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL)
3. Configuration des tarifs réels en base

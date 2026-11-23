# RAPPORT SÉCURITÉ — MISSION GV5 §97

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche de consolidation** : `gv5-97-consolidation-super-admin`  
**HEAD final** : (à renseigner au commit final)  
**Production Supabase** : lecture seule stricte — aucune modification  
**Accès base distante** : indisponible — politiques RLS, fonctions et tables réelles non vérifiables

---

## 1. PRINCIPES DE SÉCURITÉ APPLIQUÉS (constatés dans le code)

| Principe | Mise en œuvre | Fichier(s) |
|---|---|---|
| Un seul Super Admin global | Rôle `saas_admin` sur `profiles.role`. Le guard vérifie `role === "saas_admin"`. L'unicité effective n'est pas vérifiable sans accès base. | `src/components/super-admin-guard.tsx`, `src/lib/features.ts` |
| Fail-closed (refus par défaut) | `SuperAdminGuard` : si pas de session, redirection `/connexion/` ; si rôle ≠ `saas_admin`, état "refuse". Aucune ouverture à l'aveugle. | `src/components/super-admin-guard.tsx`, `src/lib/features.ts` |
| Masquage UI ≠ protection | Documenté explicitement : "UI ≠ sécurité : masquer un bouton n'empêche pas une action si l'API/RPC/RLS ne la refuse pas." Les contrôles finaux sont côté serveur (RPC + RLS). | `src/app/super-admin/roles/page.tsx`, `src/lib/features.ts` |
| Isolation multi-tenant | Référence à `current_establishment_id()` et RLS tenant. Les données métier sont filtrées par établissement. Non vérifiable sans accès base. | `src/app/super-admin/roles/page.tsx` |
| Journalisation des opérations sensibles | Insertions dans `audit_log` pour activer/désactiver manager, activer/désactiver employé, changement de plan, suspension d'établissement, etc. | `src/app/super-admin/managers/page.tsx`, `employes/page.tsx`, `entreprises/page.tsx`, `abonnements/page.tsx` |
| Aucun secret exposé côté client | Clés API (Resend, WhatsApp, Stripe) sont des secrets serveur, gérées par les Edge Functions. Jamais lues ni affichées dans le navigateur. | `src/app/super-admin/integrations/page.tsx`, `src/app/super-admin/communications/page.tsx` |
| Pas de mot de passe en clair | Le mot de passe temporaire Manager est généré côté serveur (`auth.admin.createUser`), jamais persisté, jamais renvoyé, rotation obligatoire. | `supabase/functions/onboard-tenant/index.ts` |
| Jeton d'invitation hashé (SHA-256) | Seul l'empreinte SHA-256 du jeton est stockée en base ; le jeton brut n'est jamais persisté. | `supabase/functions/send-invitation/index.ts`, `onboard-tenant/index.ts` |
| Idempotence des envois | L'Edge Function `send-invitation` refuse tout nouvel envoi si `last_request_id` correspond déjà (même résultat, aucun doublon). | `supabase/functions/send-invitation/index.ts` |
| Canaux de notification indépendants | L'échec d'un canal (e-mail ou WhatsApp) n'empêche pas l'autre. Chaque résultat est enregistré séparément. | `supabase/functions/_shared/providers.ts` (`deliverInvitation`) |

---

## 2. RÔLES TECHNIQUES

| Rôle | Portée | Source |
|---|---|---|
| `saas_admin` | Super Admin de la plateforme. Accès à tous les modules Super Admin. Vérifié par `SuperAdminGuard` et `is_saas_admin()`. | `profiles.role` |
| `manager` | Propriétaire d'un établissement. Limité à son établissement. | `profiles.role` |
| `employee` | Employé d'un atelier. Limité à ses permissions granulaires. | `profiles.role` |
| `client` | Client final. | `profiles.role` |

---

## 3. POLITIQUES RLS (Référencées dans le code — non vérifiables sans accès base)

| Table/Objet | Politique attendue | Référence dans le code | Statut vérification |
|---|---|---|---|
| `establishments` | RLS tenant : lecture/écriture filtrée par `current_establishment_id()` ; `saas_admin` accès global | `src/app/super-admin/garages/page.tsx`, `entreprises/page.tsx` | NON VÉRIFIABLE |
| `profiles` | RLS : un manager/employé ne voit que ses propres données ; `saas_admin` accès global | `src/app/super-admin/managers/page.tsx`, `employes/page.tsx` | NON VÉRIFIABLE |
| `subscriptions` | RLS tenant | `src/app/super-admin/abonnements/page.tsx` | NON VÉRIFIABLE |
| `plans` / `plan_features` | Lecture publique (catalogue), écriture réservée `saas_admin` via RPC | `src/app/super-admin/plans/page.tsx` | NON VÉRIFIABLE |
| `audit_log` | Écriture réservée (RPC/service) ; lecture `saas_admin` | `src/app/super-admin/audit/page.tsx` | NON VÉRIFIABLE |
| `support_tickets` / `ticket_messages` | RLS tenant ; staff peut répondre | `src/app/super-admin/support/page.tsx` | NON VÉRIFIABLE |
| `crm_leads` / `crm_events` | RLS tenant | `src/components/crm-module.tsx` | NON VÉRIFIABLE |
| `pre_purchase_requests` | RLS tenant | `src/app/super-admin/pre-achats/page.tsx` | NON VÉRIFIABLE |
| `invitations` / `invitation_events` | RLS `saas_admin` | `src/app/super-admin/whatsapp/page.tsx` | NON VÉRIFIABLE |
| `permissions` (granulaires) | `can_view/create/edit/delete` par module et rôle | `src/lib/permissions.ts`, `src/app/super-admin/roles/page.tsx` | NON VÉRIFIABLE |

> **Avertissement** : l'absence d'accès à la base distante empêche de confirmer l'existence effective, la cohérence et l'application de ces politiques RLS. Les politiques sont référencées dans le code frontend mais leur implémentation SQL côté Supabase n'a pu être audite.

---

## 4. FONCTIONS RPC ET EDGE FUNCTIONS

### RPC référencées (côté frontend)

| RPC | Module appelant | Sécurité attendue | Statut |
|---|---|---|---|
| `admin_set_establishment_status` | Garages, Entreprises | `saas_admin` uniquement, journalisé | Présent (0026/0043) |
| `admin_change_plan` | Entreprises | `saas_admin` uniquement, journalisé | Présent |
| `admin_archive_establishment` | Entreprises | `saas_admin`, archive logique, journalisé | 0043 (NON APPLIQUÉE) |
| `admin_purge_establissement` | Entreprises | `saas_admin`, refus si données métier, audit conservé | 0043 (NON APPLIQUÉE) |
| `admin_renew_subscription` | Abonnements, Entreprises | `saas_admin`, journalisé | Présent (0026) |
| `admin_reactivate_subscription` | Abonnements | `saas_admin`, journalisé | Présent (0026) |
| `admin_expire_subscription` | Abonnements | `saas_admin`, journalisé | Présent (0026) |
| `admin_save_plan` | Plans | `saas_admin`, journalisé | Présent |
| `admin_set_feature` | Plans | `saas_admin`, journalisé | Présent |
| `admin_set_pre_purchase_status` | Pré-achats | `saas_admin`, transactionnelle + historique | 0035 (NON APPLIQUÉE) |
| `admin_get_pre_purchase_history` | Pré-achats | Lecture `saas_admin` | 0035 (NON APPLIQUÉE) |
| `admin_set_subscription` (UPSERT) | Abonnements/Onboarding | `saas_admin` | 0040 (NON APPLIQUÉE) |
| `admin_onboard_tenant_v2` | Onboarding | `saas_admin`, transactionnelle + compensation | 0039 (NON APPLIQUÉE) |
| `admin_check_identity_available` | Onboarding | `saas_admin`, unicité | 0039 (NON APPLIQUÉE) |
| `admin_find_onboarding_request` | Onboarding | Idempotence | 0028 (présente) |
| `admin_find_user_id_by_email` | Onboarding | Vérification doublon | 0028 (présente) |
| `admin_prepare_resend` | send-invitation EF | Préparation relance | 0036 (NON APPLIQUÉE) |
| `admin_record_delivery` | send-invitation EF | Enregistrement statut | 0036 (NON APPLIQUÉE) |
| `get_my_profile` | SuperAdminGuard, useProfil | Retourne le rôle du caller | Présent |
| `is_saas_admin()` | Garde fonctions sensibles | Vérifie le rôle saas_admin | Présent (remediations) |
| `my_features()` | useFeatures (droits forfait) | Intersection forfait ∩ permissions | Présent (0009) |
| `my_permissions()` | useFeatures (permissions granulaires) | Droits fins par module | 0039 (NON APPLIQUÉE) |
| `admin_delete_client_account` | Suppression client | `saas_admin` + journalisation + retrait privileges PUBLIC | 0030 |

### Edge Functions

| Function | Rôle | Authentification | Autorisation | Secrets | Statut |
|---|---|---|---|---|---|
| `send-invitation` | Relance invitation e-mail/WhatsApp | JWT vérifié (`caller.auth.getUser`) | `role === "saas_admin" && is_active` | RESEND_API_KEY, WHATSAPP_* (serveur uniquement) | Présente localement, déploiement non vérifiable |
| `onboard-tenant` | Création abonné bout-en-bout | JWT vérifié | `role === "saas_admin" && is_active` | RESEND, WHATSAPP, ACTIVATION_BASE_URL (serveur) | Présente localement, déploiement non vérifiable |
| `activate-manager` | Activation compte Manager | — | — | — | Présente localement, déploiement non vérifiable |
| `stripe-webhook` | Webhooks paiement Stripe | — | — | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Présente localement, déploiement non vérifiable |

---

## 5. APPPELS RPC ET SIDECAR (client)

| Appel | Sécurité côté client | Contrôle serveur complémentaire |
|---|---|---|
| `supabase.auth.getSession()` | Session stockée côté client (httpOnly cookie via Supabase) | Vérifié par le serveur Supabase à chaque requête |
| `supabase.rpc("get_my_profile")` | Aucun paramètre sensible | La RPC retourne le rôle du caller authentifié |
| `supabase.from("profiles").update(...)` | `actor_id` récupéré via `getSession()` | RLS sur `profiles` doit restreindre |
| `supabase.from("audit_log").insert(...)` | `actor_id` depuis session | RLS doit restreindre l'insertion à `saas_admin` |

---

## 6. ANOMALIES DE SÉCURITÉ IDENTIFIÉES

| ID | Anomalie | Sévérité | Statut | Note |
|---|---|---|---|---|
| SEC-01 | Variable d'environnement incorrecte (`NEXT_PUBLIC_SUPABASE_ANON_KEY` au lieu de `PUBLISHABLE_KEY`) dans Integrations | Majeure | **CORRIGÉE** | La page indiquait Supabase "non configuré" à tort. Corrigée dans `integrations/page.tsx`. |
| SEC-02 | `supabase-browser.ts` contient une URL et une clé publishable en dur comme fallback | Mineure | Ouverte | Fallback pour build statique GitHub Pages. La clé est une publishable key (non secrète), mais l'URL en dur pointe vers le projet de production. |
| SEC-03 | Policies RLS non vérifiables (pas d'accès base) | Critique | Non vérifiable | Impossible de confirmer l'isolation tenant et l'accès `saas_admin` sans requêter la base distante. |
| SEC-04 | Edge Functions non déployées / non vérifiables | Critique | Non vérifiable | `send-invitation`, `onboard-tenant`, `activate-manager`, `stripe-webhook` présentes localement mais déploiement non confirmé. |
| SEC-05 | Migrations de sécurité (0037, 0038, 0042) non appliquées | Majeure | Bloquée (autorisation) | Durcissement des RPC, RLS profils, index de sécurité — prêtes, non appliquées. |

---

## 7. PREUVE D'ABSENCE D'ACCÈS CROISÉ (constat code)

Le code frontend ne contient **aucune requête contournant l'identifiant d'établissement** pour les modules métier :
- Toutes les requêtes `establishments`, `subscriptions`, `profiles` sont globales (Super Admin) ou filtrées par `establishment_id`.
- Il n'y a pas de requête "tous les établissements d'un autre garage" depuis un contexte Manager.
- Le `SuperAdminGuard` garantit que seules les sessions `saas_admin` accèdent aux routes `/super-admin/*`.

> Cette preuve est statique (lecture du code). Elle ne remplace pas une vérification dynamique des politiques RLS côté base.

---

## 8. PLAN DE RETOUR ARRIÈRE (sécurité)

Comme aucune modification de base n'est effectuée pendant §97 (production lecture seule, migrations non appliquées), **aucun retour arrière de base de données n'est nécessaire**.

Les seules modifications effectuées sont dans le code frontend (`src/app/super-admin/integrations/page.tsx`, `employes/page.tsx`, `page.tsx`, `pre-achats/page.tsx`, `super-admin-shell.tsx`). Retour arrière : `git revert` du commit correspondant sur la branche `gv5-97-consolidation-super-admin`, sans impact sur la production.

---

## 9. SOMMAIRE

| Domaine | État |
|---|---|
| Rôles (saas_admin, manager, employee, client) | Définis dans le code, non vérifiables en base |
| Super Admin unique | Non vérifiable (pas d'accès base) |
| Guard d'accès (fail-closed) | Implémenté et cohérent |
| Politiques RLS | Référencées, non vérifiables sans accès base |
| RPC sensibles | Présentes dans les migrations préparées (certaines non appliquées) |
| Edge Functions | Présentes localement, déploiement non vérifiable |
| Secrets côté client | Aucun exposé |
| Journal d'audit des opérations sensibles | Implémenté (insertions `audit_log`) |
| Isolation entre établissements | Déclarée dans le code, non vérifiable dynamiquement |

**Aucune modification de production n'a été effectuée. Aucune migration n'a été appliquée.**

---

# GV5 — SECTION 43 — RAPPORT FINAL : DÉBLOQUAGE SÉCURISÉ SUPABASE, SAUVEGARDES, MIGRATIONS 0028–0036 ET PRÉPARATION MISE EN PRODUCTION

**Date** : 2026-11-16 (session GV5 §43 — continuation de GV5 §42).
**Projet** : AUTO DYALI.
**Dépôt** : `auto-dyali/auto-dyali.github.io`.
**Branche** : `main`.
**Commit initial (état de référence §42)** : `35aa2fc886601395038051bb61dce195f8d91abf` — `GV5 §42: registre mis a jour — phases B/C closes (acces Supabase, sauvegarde, audit migrations 0028-0036)`.
**Commit final** : `b6ae9a7bbf7d2b7822c9546eab7cbc1530bcb5e4` — `GV5 §43: rapport final — deblocage securise Supabase, sauvegardes, migrations 0028-0036 et preparation mise en production` (ce rapport).

---

## 1. Commit initial et commit final

| Point | Valeur |
|---|---|
| Commit initial | `35aa2fc886601395038051bb61dce195f8d91abf` |
| Commit final | `b6ae9a7bbf7d2b7822c9546eab7cbc1530bcb5e4` — rapport final GV5 §43 |
| État Git au début de la session | `## main...origin/main`, HEAD = `35aa2fc…`, arbre propre |

## 2. État Git local et distant

- Branche : `main`.
- HEAD local = `origin/main` = `35aa2fc8866…`.
- Synchronisation : ✅ en synchronisation, aucun commit local non poussé.
- Arbre de travail : ✅ propre avant rédaction du rapport (§43).

## 3. Résultat CI et déploiement

- Dernier run GitHub Actions (workflow `Deploy AUTO DYALI to GitHub Pages`) : run **#175**, SHA `35aa2fc88660…`, event `push` → **success** (jobs `build` + `deploy`).
- Run #174 (SHA `9927bd236711…`) → success.
- Déploiement : ✅ **success**.
- Site : `https://auto-dyali.github.io/` → **HTTP 200**, title `AUTO DYALI | Automotive Management`.

## 4. Tableau détaillé des neuf migrations (0028 → 0036)

| N° | Fichier | Présence Git | Contenu / dépendances | Tables / objets | État exact | Risque |
|---|---|---|---|---|---|---|
| 0028 | `0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` | ✅ présent | Table `onboarding_requests` + RPC onboarding sécurisé (idempotence `request_id`). | `onboarding_requests`. | Préparée — **NON appliquée** (statut intentionnel). | **Moyen** (nouvelles tables + RPC). |
| 0029 | `0029_crm_extension_prepared_NOT_APPLIED.sql` | ✅ présent | Ajout colonnes CRM (`source`, `priority`, `estimated_value`) + index. | `crm_leads`. | Préparée — **NON appliquée**. | **Faible** (`add column if not exists`). |
| 0030 | `0030_super_admin_security_hardening.sql` | ✅ présent | Hardening `admin_delete_client_account` (garde `is_saas_admin()`, revoke PUBLIC). | Fonctions. | Phase 2 — **état distant à confirmer**. | **Moyen** (recreate fn + revoke). |
| 0031 | `0031_profiles_rls_admin_access.sql` | ✅ présent | Policies RLS `profiles_saas_admin_update`, `clients_saas_admin`. | Policies. | Phase 2 — **état distant à confirmer**. | **Moyen** (policies). |
| 0032 | `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql` | ✅ présent | **Fichier de plan** (non une migration appliquée). Sources : 0010, 0015, 0018, 0026, 0029 + 0030/0031 Phase 2. | Plans. | **Plan uniquement — NON exécuté**. | — |
| 0033 | `0033_pre_purchase_requests_prepared_NOT_APPLIED.sql` | ✅ présent | Table `pre_purchase_requests` + suivi (idempotence `request_key`). | `pre_purchase_requests`. | Préparée — **NON appliquée**. | **Moyen** (nouvelle table + RLS). |
| 0034 | `0034_harden_admin_p0_rpcs_prepared_NOT_APPLIED.sql` | ✅ présent | Durcissement RPC admin P0 + pré-contrôles fail-fast. | Fonctions RPC. | Préparée — **NON appliquée**. | **Moyen** (recreate fns + revoke). |
| 0035 | `0035_pre_purchase_submit_rpc_prepared_NOT_APPLIED.sql` | ✅ présent | RPC public `submit_pre_purchase_request` (consentements obligatoires, idempotence `request_key`). | RPC publique. | Préparée — **NON appliquée**. | **Moyen** (security definer). |
| 0036 | `0036_invitations_manager_prepared_NOT_APPLIED.sql` | ✅ présent | Tables `invitations` + `invitation_events`, RPC `admin_invite_manager`. | Tables + RPC. | Préparée — **NON appliquée**. | **Moyen** (nouvelles tables + RPC via EF). |

### 4.1 — Situation précise de la migration 0032

- `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql` est un **fichier de plan** référençant les sources historiques `0010_super_admin_rpc.sql`, `0015_support_tickets.sql`, `0018_crm_super_admin.sql`, `0026_subscriptions_audit_and_lifecycle.sql`, `0029_crm_extension_prepared_NOT_APPLIED.sql` et les Phase 2 (`0030`, `0031`).
- **Aucun fichier de migration réel portant le numéro `0032` dans `supabase/migrations/` n'a été identifié comme exécuté** ; le plan n'a pas été exécuté.
- Conformément aux règles : une migration n'est pas considérée comme appliquée pour seule raison que son fichier existe.

## 5. État des sauvegardes et PITR

| Élément | Résultat |
|---|---|
| Backup local (`backups/2026-11-09/`) | ✅ `auto_dyali_avant_migration_0025.dump` (413 872 octets, daté 2026-11-09) |
| Couverture | ⚠️ **Partielle** — antérieure à la migration 0025 ; ne couvre pas les migrations 0028–0036 |
| PITR | ❌ **Non vérifiable** sans accès privilégié Supabase |

## 6. État de l’Edge Function `onboard-tenant`

| Élément | Résultat |
|---|---|
| Source locale | ✅ `supabase/functions/onboard-tenant/index.ts` (~9,7 Ko) |
| Architecture vérifiée (local) | ✅ caller ANON + JWT Super Admin ; admin `service_role` serveur ; vérif `is_saas_admin()` |
| Déploiement réel | ❌ **Non confirmé** |

## 7–11. États onboarding / invitations / RLS / SA / tests (récap §40–§42)

- Onboarding : ❌ **BLOQUÉ** (EF + migrations + accès).
- Invitations e-mail/WhatsApp : code OK (`/actiter?token=`), envoi réel **BLOQUÉ** fournisseur.
- RLS / isolation multi-tenant : tests réels **BLOQUÉS**.
- Portail Super Admin : ⚠️ **PARTIAL** (11 rubriques en code ; validation réelle bloquée).
- Tests locaux : ✅ tsc / lint / tests 41 / build / CI / déploiement / site.

## 12. Tests exécutés et résultats réels (cette session GV5 §43)

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error (12 warn) |
| `npm test` | ✅ 41/41 passés (dont 26 tests invitations) |
| `npm run build` | ✅ exit 0 (route `○ /actiter` générée) |
| Push / CI / déploiement / site | ✅ OK (run #175, HTTP 200) |

## 13. Corrections réalisées

- Route dynamique `/actiter/[token]` → route statique `/actiter` (token via `?token=`, `useSearchParams` + `<Suspense>`).
- `buildActivationUrl` → `${base}/actiter?token=${encodeURIComponent(token)}`.
- Tests invitations alignés sur le nouveau format d’URL (26/26).

## 14. Blocages restants et cause exacte

1. Accès Supabase privilégié (`SUPABASE_SERVICE_ROLE_KEY` / Dashboard owner / CLI) — **cause** : absent de l’environnement local.
2. Sauvegarde/PITR vérifiée — **cause** : dump partiel (pré-0025), PITR non vérifiable.
3. Fournisseurs SMTP/WhatsApp/paiement/IA — **cause** : non configurés.
4. E2E réel / comptes test réels — **cause** : navigateur crash / comptes supprimés.

## 15. Actions précises que le propriétaire doit effectuer (si nécessaire)

- Ouvrir le projet Supabase `nxmsqqoflskfajqrqddw` via Dashboard owner.
- Générer/régénérer une clé `service_role` ou utiliser le Dashboard SQL Editor en rôle owner.
- Vérifier la sauvegarde/PITR et produire une sauvegarde complète couvrant les migrations 0028–0036.
- Donner l’autorisation explicite pour l’exécution du plan `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql` et des migrations `*_prepared_NOT_APPLIED`.

## 16. Mise à jour du registre maître

- Section `## 43 — Déblocage sécurisé Supabase, sauvegardes, migrations 0028–0036 et préparation de la mise en production — 2026-11-16`.

---

## Synthèse GV5 §43

| Phase | État |
|---|---|
| A — Audit initial | ✅ terminée (constats ci-dessus) |
| B — Accès Supabase | ❌ **BLOQUÉ** (procédure d’ouverture propriétaire à suivre) |
| C — Sauvegardes/PITR | ⚠️ partiel / ❌ PITR |
| D — Migrations 0028–0036 | ✅ audit terminé ; aucune application effectuée |
| E — EF | source OK / déploiement ❌ non confirmé |
| F — Invitations | code OK / envoi réel ❌ fournisseur |
| G — RLS | tests réels ❌ bloqués |
| H — Tests | ✅ CONFORME ET VÉRIFIÉ (local + CI) |
| I — Livraison | ✅ CONFORME ET VÉRIFIÉ (push/CI/deploy/site) |

**Conclusion** : les phases réalisables ont été menées sans modification destructive ; les phases opérationnelles restantes sont **sérieusement bloquées sur l’accès privilégié Supabase** et les dépendances fournisseurs. Aucune migration n’a été appliquée, aucun dump n’a été poussé, aucun secret n’a été exposé.

---

# AUTO DYALI — GUIDE D'EXÉCUTION — MIGRATIONS MANQUANTES (Phase 3)

- **Date** : 2026-11-13
- **Branche** : `main`
- **SHA de référence** : `98c0247`
- **Statut** : PLAN UNIQUEMENT — AUCUNE ÉCRITURE RÉALISÉE SUR SUPABASE.

## 1. Contexte

Suite à l'audit read-only Phase 1/2, les migrations suivantes étaient identifiées
comme distantes (absentes ou non confirmées) :

| Fichier source | Contenu |
|---|---|
| `supabase/migrations/0010_super_admin_rpc.sql` | RPC + policies Super Admin |
| `supabase/migrations/0015_support_tickets.sql` | Support & tickets |
| `supabase/migrations/0018_crm_super_admin.sql` | CRM Super Admin |
| `supabase/migrations/0026_subscriptions_audit_and_lifecycle.sql` | Abonnements audit & lifecycle |
| `supabase/migrations/0029_crm_extension_prepared_NOT_APPLIED.sql` | CRM enrichi |
| `supabase/migrations/0030_super_admin_security_hardening.sql` | Hardening sécurité (Phase 2) |
| `supabase/migrations/0031_profiles_rls_admin_access.sql` | RLS profiles/clients (Phase 2) |

Les migrations Phase 2 (`0030`, `0031`) sont **créées localement** et sont incluses
dans le plan ci-dessous.

## 2. Ordre exact des exécutions

1. `0032_PLAN_PENDING_MIGRATIONS.sql` (plan ordonné : 0010 → 0015 → 0018 → 0026 → 0029 → 0030 → 0031).

## 3. Préconditions

- [ ] Sauvegarde / Point-in-Time Recovery (PITR) vérifiée et restaurable.
- [ ] Aucun écriture destructive involontaire (toutes les migrations sont
      prévues `if not exists` / `drop policy if exists` où applicable).
- [ ] Connexion Supabase Dashboard → SQL Editor authentifiée en rôle owner/service.
- [ ] Vérification préalable : `npm run db:check` (script `scripts/check-db.mjs`).

## 4. Contrôles avant exécution (read-only, déjà constatés)

- RPC `admin_onboard_tenant` : présent (42501 pour anon = attendu).
- RPC `admin_delete_client_account` : état changeant (P0001 → PGRST202) — re-vérifier.
- RPC `admin_renew_subscription`, `admin_reactivate_subscription`,
  `admin_expire_subscription`, `admin_change_plan`, `admin_save_plan`,
  `admin_set_establishment_status`, `admin_set_feature` : **absentes** (PGRST202).
- Tables CRM/support : divergence `db:check` vs probes REST — clarifier avant écriture.

## 5. Commandes SQL

Copier/coller le contenu de `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql`
dans le Supabase Dashboard → SQL Editor → exécuter en une seule session.

## 6. Résultats attendus après exécution

- Absence de `ERROR` fatale sur chaque bloc.
- `select * from pg_proc where proname like 'admin_%'` → nouvelles fonctions appliquées.
- Policies RLS `profiles_saas_admin_update`, `clients_saas_admin` créées.

## 7. Contrôles après exécution (read-only)

- Re-probing des RPC (attente de propagation PostgREST).
- Re-run de `npm run db:check`.
- Vérifier dans le Dashboard : logs SQL Editor sans erreur.

## 8. Procédure de retour arrière

- PITR : restauration du point de sauvegarde antérieure.
- Aucun script de rollback écrit automatiquement (aucune donnée métier écrite par ces migrations).

## 9. Déploiement associé

- `supabase functions deploy --name onboard-tenant` (après application de la 0028).
- Secrets requis : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 10. Statut final

- **Plan SQL** : ✅ créé (`supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql`).
- **Application distante** : ⏳ BLOQUÉ — action Dashboard requise.

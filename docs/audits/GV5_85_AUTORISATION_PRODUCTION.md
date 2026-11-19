# AUTO DYALI — Rapport d'autorisation : mise à niveau Supabase PRODUCTION (GV5 §85)

> **CE DOCUMENT N'EST PAS UNE AUTORISATION.** Il est soumis au propriétaire. Aucune opération de la section 3 n'a été exécutée sur `nxmsqqoflskfajqrqddw`. Arrêt obligatoire avant écriture.

## 1. État de la sauvegarde

| Élément | État vérifié |
|---|---|
| Sauvegarde locale | `backups/2026-11-09/auto_dyali_avant_migration_0025.dump` (408 Ko, 09/11/2026). **Origine (production ou staging) et restaurabilité NON VÉRIFIÉES** |
| Sauvegarde Supabase Dashboard | **Non vérifiable** avec les outils disponibles |
| Dernière sauvegarde exploitable | **Inconnue** |
| Restauration réelle exercée | **Non** |
| Supabase CLI | Absente de l'environnement (`command -v supabase` → absent) |
| Variables de connexion DB | Aucune variable `DATABASE_URL`/`SUPABASE_DB_*` disponible |

**Conclusion** : la condition « sauvegarde vérifiée » n'est **pas remplie**. Aucune écriture production ne peut être autorisée sur cette base.

## 2. État PITR

- Aucun outil MCP ou CLI disponible pour interroger l'état PITR de la production.
- **PITR : NON VÉRIFIÉ**, pas « désactivé » — distinction importante.
- Action propriétaire : Dashboard Supabase → Project Settings → Database → Backups/PITR → confirmer l'activation, noter le point de restauration le plus ancien, puis fournir une capture ou une confirmation écrite.

**Solution alternative si PITR indisponible** :
1. Export logique via Supabase Dashboard (Download backup) ou `supabase db dump --db-url <URL fournie par le propriétaire>` avec les schémas `public` **et** `auth`.
2. Export complémentaire des comptes Auth via la Management API ou une requête `auth.users` autorisée.
3. Restauration d'abord dans un **projet scratch** fourni par le propriétaire, jamais en production directe.
4. Limite : un dump logique `public` seul ne restaure pas les mots de passe Auth ni les secrets d'Edge Functions ; ces derniers doivent être reconfigurés séparément. Aucun secret ne doit transiter par le chat ou le dépôt.

## 3. Les 12 opérations — audit détaillé

Légende : État production = vérifié par sondage HTTP lecture seule (401 = objet présent et protégé, 404/PGRST202 = absent, 42703 = colonne absente, PGRST205 = table absente).

| # | Objet | Source | Dépendances | État prod | État attendu | Compatibilité données | Risque | Vérification | Retour arrière |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `invitations`, `invitation_events`, RPC invitations | `0036_...NOT_APPLIED.sql` | 0028, `pgcrypto`, `is_saas_admin` | **PGRST205** (table absente), RPC 404 | table + hash seul + statuts par canal | Aucune donnée existante dans la table absente | **Moyen** : préconditions et politiques RLS | `to_regclass('public.invitations')`, `admin_invitation_preview` | PITR / dump préalable |
| 2 | Colonnes identité + RPC 0039 + policies `password_rotation_required` | `0039_...NOT_APPLIED.sql` | 0036, 0028, `is_saas_admin` | `professional_id`, `login_id`, `must_change_password` **42703** ; RPC 404 | colonnes présentes, 9 objets `true` dans `admin_identity_v2_health` | Colonnes nullable ; unique indexes sur `upper(professional_id)`/`lower(login_id)` — **échouent si doublons existants** | **Élevé** : policies restrictives sur toutes les tables à `establishment_id` | RPC santé + `must_change_password` false pour les managers existants | PITR uniquement |
| 3 | `pre_purchase_requests`, `pre_purchase_events`, `submit_pre_purchase_request` | `0033` + `0035` | `plans`, RLS SA | **PGRST205**, RPC 404 | table + RPC idempotente, anonyme soumission seulement | `create table if not exists` | Faible | lecture anonyme `[]`, replay idempotent | `drop table` après export ou PITR |
| 4 | RPC espace abonné + champs admin + correctifs | `remediation_075/*` | 0039, colonnes admin | 21 RPC testées → **404** | RPC présentes, `anon_exec=false`, `is_saas_admin()` = coalesce | `create or replace`, aucune suppression de table | Moyen | `has_function_privilege`, test §75/§76 | `*_down.sql` |
| 5 | Champs admin à la création | `remediation_076/001` | 0039 | RPC `admin_onboard_tenant_v2` absente | RPC inscrit 6 colonnes | `create or replace` | Faible | `admin_onboard_tenant_v2` + colonnes | `001_down.sql` |
| 6 | Révocation anon/public | `remediation_077/*` | 4 | diverses RPC admin exposées selon ancienne config | anon 0 RPC admin, service_role conservé | Privilèges seuls | Faible | `get_advisors` + `has_function_privilege` | `001_down.sql` |
| 7 | Demandes, colonnes POS, facturation SaaS | `remediation_579/*` | 3 | `pre_purchase_requests`, `saas_billing_events` **PGRST205** ; `products.brand` **42703** ; `products.stock` présent (401) | tables/colonnes présentes | `add column if not exists`, données conservées | Moyen | `products.stock`, `saas_billing_events` | `*_down.sql` |
| 8 | Purge établissement | `remediation_580/*` | 4 | `admin_purge_establishment` **404** | RPC SA seul, purge conditionnée | Aucune table supprimée | Faible | test SA/Manager/anon | `001_down.sql` |
| 9 | Diagnostic identité | `remediation_583/*` | 2 | `admin_identity_v2_health` **404** | RPC SA seul, 9 booléens `true` | Aucune donnée | Faible | test §83 | `001_down.sql` |
| 10 | Edge Functions | `onboard-tenant`, `send-invitation`, `activate-manager`, `stripe-webhook` | secrets serveur | versions **non vérifiables** | v2/v2/v1/v1 déployées | Remplacement de fonction, pas de données | Moyen | réponses HTTP + versions MCP | redéployer version antérieure |
| 11 | Secrets fournisseurs | Dashboard Supabase | comptes Resend/Meta/Stripe | secrets absents (`check-provider-config` : 12 manquants) | secrets configurés côté serveur | Aucune donnée | Élevé si erreur de saisie | statuts réels, aucun secret affiché | suppression/rotation côté fournisseur |
| 12 | Tarifs | `configure-plans.mjs`, `admin_save_plan` | décision propriétaire | `price_monthly`/`price_yearly` **NULL** | 3 formules tarifées | Mise à jour de colonnes existantes | Élevé si prix erroné | `select code, price_... from plans` | anciennes valeurs à noter avant exécution |

## 4. Ordre d'application

0 (sauvegarde + PITR vérifiés) → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12.
**Ne pas appliquer aveuglément** : chaque opération est vérifiée avant la suivante ; arrêt immédiat en cas d'erreur.

## 5. Risques et impact utilisateur

- **Risque majeur** : opération 2 (policies restrictives + index uniques) — peut bloquer des managers existants si des doublons d'identifiants existent en production.
- **Impact utilisateur** : pendant les opérations 1–9, les écritures Super Admin doivent être suspendues brièvement ; les garages existants restent lisibles si les RLS restent cohérentes.
- **Durée estimée d'indisponibilité** : non mesurable à l'avance ; prévoir une fenêtre courte avec arrêt des écritures et monitoring. Aucune estimation chiffrée n'est inventée.
- **Secrets** : aucun ne doit être collé dans le chat, le dépôt ou un rapport.

## 6. Contrôles post-migration

1. `admin_identity_v2_health()` → tous `true`.
2. Création contrôlée d'un garage **synthétique** (jamais PSR tant que son état réel n'est pas établi).
3. SQL : établissement, profil Manager rattaché, abonnement 110 j + 12 mois, permissions ⊆ formule, invitation préparée.
4. Activation et connexion Manager réelles si fournisseurs configurés ; sinon statut `non_configure` honnête.
5. Isolation entre deux garages, refus Manager sur RPC Super Admin, audit_log cohérent.
6. `get_advisors` sans alerte critique ; npm audit 0.

## 7. Actions nécessitant une autorisation explicite du propriétaire

1. Confirmer la sauvegarde et le PITR (ou fournir une Stratégie alternative validée).
2. Autoriser l'application des opérations 1–9 dans l'ordre indiqué.
3. Autoriser le déploiement des Edge Functions (opération 10).
4. Fournir/configurer les secrets (opération 11) **sans les transmettre dans le chat**.
5. Fournir les tarifs validés (opération 12).
6. Autoriser une création synthétique contrôlée en production après migration.

**En l'absence de ces autorisations : toute la section 3 reste non exécutée.**

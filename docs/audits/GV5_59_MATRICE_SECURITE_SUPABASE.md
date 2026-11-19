# GV5 §59 — Matrice de sécurité Supabase (lecture seule)

Date : 17 novembre 2026. Données obtenues par requêtes SQL en LECTURE SEULE via Supabase MCP. Aucune modification.

## 1. Tables — RLS

Toutes les tables auditées ont `rls_enabled = true` : establishments (5 policies), profiles (2), audit_log (4), permissions (1), onboarding_requests (1), plans (2), plan_features (2), subscriptions (2), subscriptions_audit. `force_rls = false` partout (décision §51 : FORCE RLS casserait les RPC SECURITY DEFINER). Le jeu de policies réellement appliqué en distant n'a pas été audité ligne par ligne (nécessite lecture pg_policy détaillée + test multi-tenant). Statut : **PARTIEL — non vérifiable en conditions réelles**.

## 2. Colonnes critiques ABSENTES en distant

- `establishments.professional_id` : ABSENT (présent seulement `plan`, `slug`).
- `profiles.login_id`, `must_change_password`, `temporary_password_expires_at`, `password_changed_at` : ABSENTS.

Conclusion : migrations 0039 non appliquées → identités/rotation non opérationnelles.

## 3. RPC

Présentes en distant : my_features (SECURITY DEFINER, grant authenticated), + RPC admin_* historiques (admin_onboard_tenant, admin_change_plan, admin_save_plan, etc.). ABSENTES : admin_onboard_tenant_v2, admin_check_identity_available, resolve_login_email, has_feature, must_change_password, admin_complete_password_change, my_permissions, fonctions invitations.

## 4. SECURITY DEFINER — exposition PUBLIC (P0 confirmé)

Requête : `pg_proc.proacl` + `aclexplode` sur le schéma public.

- `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()` : `prosecdef = true`, `proacl IS NULL` → **EXECUTE PUBLIC par défaut**. Ces fonctions sont appelables par `anon`.
- `is_manager()` : `prosecdef = false`, `proacl IS NULL` → exposé PUBLIC.
- Les RPC `admin_*` (admin_change_plan, admin_save_plan, admin_onboard_tenant, etc.) : `prosecdef = true`, `search_path` fixé (`public` ou `public, auth`), grant EXECUTE à `authenticated` uniquement — **pas de PUBLIC/anon** (liste vérifiée). Ils disposent d'un garde interne `is_saas_admin()`.

Analyse : le P0 signalé en §46 (16 fonctions SECURITY DEFINER exposées via PUBLIC) est **réellement confirmé pour les 4 helpers ci-dessus**. Les admin_* semblent déjà restreints, mais laMigration 0037 qui formalise ces `revoke ... from public` n'est PAS appliquée : l'état dépend donc de la configuration actuelle du projet et peut régresser. **Ne pas révoquer à l'aveugle** : 0037 révoque puis ré-accorde à `authenticated` (usages légitimes par les RPC). Correction : appliquer 0037 telle quelle après analyse des dépendances.

## 5. Journalisation

4 policies sur `audit_log`. Les operations sensibles (création abonné, changement plan, permissions, suspension, invitations) sont journalisées par les EF/RPC préparés. Aucun secret/mot de passe/journalisation en clair détecté dans le code (tokens hashés SHA-256). Vérification de l'exhaustivité réelle : non vérifiable sans environnement distant de test.

## 6. Risques et corrections

| Risque | Gravité | Correction | Prérequis |
|---|---|---|---|
| Helpers SECURITY DEFINER exposés PUBLIC | P0 | Appliquer migration 0037 | Sauvegarde/PITR + autorisation |
| `resolve_login_email` exposé anon (énumération) | P2 | Rate-limiting EF connexion | Hors périmètre SA |
| Identités/rotation absentes | P0 | Appliquer 0039 | Sauvegarde + autorisation |
| Invitations absentes | P0 | Appliquer 0036 | Sauvegarde + autorisation |

Aucune opération distante de modification effectuée. Toutes les données ci-dessus proviennent de SELECT information_schema / pg_proc / pg_class.


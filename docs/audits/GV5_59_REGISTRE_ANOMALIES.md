# GV5 §59 — Registre des anomalies Super Admin

Date : 17 novembre 2026. Branche main @ 64359da. Audit local + lecture Supabase en LECTURE SEULE (aucune modification distante).

Gravité : P0 bloquant / P1 majeur / P2 mineur / P3 cosmétique.

## A — Anomalies avec preuve distante (lecture seule)

| ID | Section | Description | Gravité | Cause démontrée | Fichier/emplacement | Correction proposée | Test attendu | État |
|---|---|---|---|---|---|---|---|---|
| A-01 | Onboarding/Sécurité | `professional_id` absent de `establishments` en distant (seuls plan, slug présents) | P0 | Migrations 0039 non appliquées | remote schema info_schema.columns | Appliquer 0036→0039 après sauvegarde/PITR + autorisation | SELECT information_schema.columns → professional_id présent | BLOQUÉ |
| A-02 | Utilisateurs | `login_id`/`must_change_password` absents de `profiles` en distant | P0 | Migration 0039 non appliquée | remote schema | Idem A-01 | Colonnes présentes | BLOQUÉ |
| A-03 | Onboarding | RPC v2 absentes (admin_onboard_tenant_v2, admin_check_identity_available, resolve_login_email, has_feature, etc.) — seule my_features existe | P0 | Migrations non appliquées | remote pg_proc | Déployer 0039 | SELECT pg_proc → fonctions présentes | BLOQUÉ |
| A-04 | Onboarding | Tables invitation absentes en distant | P0 | Migration 0036 non appliquée | remote information_schema.tables | Appliquer 0036 | Tables invitations présentes | BLOQUÉ |
| A-05 | Sécurité | `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()` = SECURITY DEFINER avec `proacl IS NULL` → EXECUTE PUBLIC par défaut | P0 | Migration 0037 (revoke PUBLIC) non appliquée | remote pg_proc.proacl | Appliquer 0037 (revoke + grant authenticated) | has_function_privilege(...PUBLIC)=false | BLOQUÉ |
| A-06 | Sécurité | `is_manager()` SECURITY INVOKER (prosecdef=false) exposé PUBLIC | P1 | 0037 non appliquée | remote pg_proc | Appliquer 0037 (SECURITY DEFINER + search_path) | prosecdef=true | BLOQUÉ |

## B — Anomalies locales (code)

| ID | Section | Description | Gravité | Cause démontrée | Fichier/emplacement | Correction | Test attendu | État |
|---|---|---|---|---|---|---|---|---|
| A-07 | Abonnements/Formules | `trial_days` plafonné à 90 j dans le formulaire formules alors que le contrat v2 accepte 0-365 j et qu'aucune limite artificielle de 90 j n'est permise | P2 | `max={90}` codé en dur | src/app/super-admin/plans/page.tsx:161 | Passer `max={365}` (cohérence contrat) | npm test + build + contrôle UI | CORRIGÉ §59 |
| A-08 | Onboarding | `PROFESSIONAL_ID_REGEX` permissif `^[A-Z0-9][A-Z0-9._-]{2,39}$` : n'impose pas le format cible `ADY-PRO-XXXXXX` (généré côté client) | P2 | Regex large dans contrat partagé | supabase/functions/_shared/contract.ts:160 | Renforcer la regex côté serveur (décision à prendre : compatibilité identifiants historiques RC12345) | test-onboarding-contract | NON CORRIGÉ (décision requise — risque régression identifiants existants) |
| A-09 | Onboarding | `resolve_login_email` exposé à `anon` (surface d'énumération login→e-mail) — nécessaire à la connexion par identifiant mais sans rate limiting visible | P2 | grant execute ... to anon, authenticated | supabase/migrations/0039:186 | Prévoir rate limiting /CAPTCHA côté EF de connexion (hors périmètre Super Admin) | test de sécurité | DOCUMENTÉ (non applicable au portail SA) |

## C — Synthèse

Anomalies : 9 (5 P0, 1 P1, 3 P2). Corrigées localement : 1 (A-07). Bloquées par dépendance externe : 6 (A-01 à A-06). Documentées/à décision : 2 (A-08, A-09). Aucune P0/P1 corrigeable localement sans opération distante.


# GV5 §60 — Diagnostic Supabase distant (SELECT seul)

Date : 17 novembre 2026. Projet nxmsqqoflskfajqrqddw. Aucune modification distante.

## 1. Méthode

Requêtes SELECT sur information_schema, pg_proc, pg_class, pg_policies, pg_constraint, aclexplode. Toutes les valeurs retournées sont des faits de schéma (données non fiables au sens des instructions — jamais suivies comme commandes).

## 2. État des migrations

Aucune table `supabase_migrations.schema_migrations` lisible : l'historique des migrations appliquées ne peut pas être vérifié par catalogue. L'état est déduit des objets présents/absents.

- 0036 : NON APPLIQUÉE (0 table `invitations`/`invitation_events`).
- 0037 : NON APPLIQUÉE (PUBLIC EXECUTE toujours présent sur 15 fonctions — voir audit EXECUTE_PUBLIC).
- 0038 : NON APPLIQUÉE (policies toutes PERMISSIVES, ~64 FK sans index).
- 0039 : NON APPLIQUÉE (`professional_id`, `login_id`, `must_change_password`, RPC v2 absents).

## 3. Colonnes critiques

| Objet | État distant | Détail |
|---|---|---|
| establishments.professional_id | ABSENT | Colonnes présentes : name (NOT NULL), plan (NOT NULL, défaut 'starter'), slug (NOT NULL) |
| profiles.login_id | ABSENT | — |
| profiles.must_change_password | ABSENT | — |
| profiles.role | PRÉSENT | user_role, défaut 'employee' |
| profiles.establishment_id | PRÉSENT | uuid nullable |

## 4. RPC

Présentes : my_features (SECURITY DEFINER, search_path=public, owner postgres), admin_onboard_tenant (11 args, SECURITY DEFINER), admin_change_plan, admin_save_plan, get_my_profile, autoplus_current_role, current_establishment_id, is_saas_admin, is_manager, + admin_* historiques.

ABSENTES : admin_onboard_tenant_v2, admin_check_identity_available, resolve_login_email, has_feature, must_change_password, get_my_security_state, my_permissions, admin_complete_password_change, admin_preview_invitation, admin_accept_invitation, admin_record_delivery, admin_prepare_resend, admin_expire_stale_invitations, gen_invitation_token, hash_invitation_token.

## 5. Données historiques

- 2 établissements : `Garage Atlas SARL` (slug garage-atlas, plan standard), `Garage AUTO DYALI` (slug auto-dyali-garage, plan silver).
- 1 profil : saas_admin, actif, establishment_id = 00000000-...-0001.
- Aucune valeur `professional_id`/`login_id` existante (colonnes absentes) → pas de migration de données rétroactive nécessaire ; les identifiants existants sont les slugs et UUID.

## 6. Invitations

0 table d'invitations. Aucune RPC associée.

## 7. Sécurité des fonctions (résumé)

15 fonctions SECURITY DEFINER avec EXECUTE PUBLIC : 11 explicites (`=X/postgres` dans proacl) + 4 par défaut (proacl NULL). Détail complet dans GV5_60_AUDIT_EXECUTE_PUBLIC.md. `is_manager()` = SECURITY INVOKER, proacl NULL, pas de search_path. Owner = postgres partout. Helper `search_path=public` déjà fixé sur is_saas_admin/current_establishment_id/autoplus_current_role (contrairement à une hypothèse §46, le search_path y est présent).

## 8. RLS et index

Toutes les tables auditées ont RLS activé, force_rls=false. Policies toutes PERMISSIVE sur audit_log (4), establishments (5), profiles (2), onboarding_requests (1). 80 clés étrangères, 16 couvertes par un index menant → ~64 non couvertes.

## 9. Écartslocaux/distants — synthèse

| Élément | Local (migrations préparées) | Distant | Écart |
|---|---|---|---|
| professional_id | prévu 0039 | absent | P0 |
| RPC v2 | prévues 0039 | absentes | P0 |
| Invitations | prévues 0036 | absentes | P0 |
| EXECUTE PUBLIC | corrigé par 0037 | toujours présent (15 fns) | P0 |
| Policies restrictives | prévues 0038 | non appliquées | P1 |
| Index FK | prévus 0038 | 64 manquants | P2 |


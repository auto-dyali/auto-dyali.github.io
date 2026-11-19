# GV5 §60 — Matrice des permissions attendues Super Admin

Date : 17 novembre 2026. Droit attendu = après application des migrations 0036-0039. Droit actuel = constaté par SELECT.

| Objet | Actuel | Attendu | Étape |
|---|---|---|---|
| is_saas_admin() | PUBLIC (proacl NULL) | authenticated | 0037 |
| current_establishment_id() | PUBLIC (proacl NULL) | authenticated | 0037 |
| autoplus_current_role() | PUBLIC (proacl NULL) | authenticated | 0037 |
| is_manager() | PUBLIC, SECURITY INVOKER, pas de search_path | authenticated, SECURITY DEFINER, search_path=public | 0037 |
| admin_change_plan / create_establishment / expire_subscription / reactivate / renew / save_plan / set_establishment_status / set_feature | PUBLIC + authenticated | authenticated | 0037 |
| decrement_product_stock / open_ticket_count / my_features | PUBLIC + authenticated | authenticated | 0037 |
| admin_onboard_tenant / attach_manager / find_onboarding_request / find_user_id_by_email / tenant_integrity | authenticated uniquement | authenticated (inchangé) | — |
| get_my_profile | authenticated | authenticated (inchangé) | — |
| resolve_login_email | absent | anon + authenticated (connexion pré-auth) | 0039 |
| admin_check_identity_available / admin_onboard_tenant_v2 / must_change_password / get_my_security_state / my_permissions / has_feature / admin_complete_password_change | absentes | authenticated + garde is_saas_admin | 0039 |
| admin_preview_invitation / accept / record_delivery / prepare_resend / expire_stale | absentes | authenticated + garde | 0036 |

## RLS — attendu

- Tables : RLS activé partout (déjà vrai). FORCE RLS non activé (décision §51, maintenu).
- Policies : Perlmissives actuelles → restrictives sur audit_log/establishments (0038) ; password_rotation_required (0039) ; permissions_saas_admin_write (0039).
- Isolation : `current_establishment_id()` dans les USING ; saas_admin via `is_saas_admin()`.

## Rôles

| Rôle | Accès attendu |
|---|---|
| anon | connexion (login), resolve_login_email uniquement ; aucune RPC admin |
| authenticated (manager/employee) | ses données établissement (RLS), helpers de lecture, pas de RPC admin |
| saas_admin | toutes RPC admin (garde interne is_saas_admin), toutes tables via RLS |
| service_role (EF) | createUser/deleteUser, RPC admin_onboard_tenant_v2 |


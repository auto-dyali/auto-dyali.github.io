# GV5 §64 — Validation PostgreSQL et permissions (procédure préparée)

Date : 17 novembre 2026. Procédure NON exécutée (pas de staging).

## Contrôles prévus (15 fonctions, matrice §62)

Pour chaque fonction : signature exacte, owner postgres, SEC/DINV, search_path, EXECUTE PUBLIC (doit être 0 après correction), EXECUTE authenticated (conservé), garde interne, dépendances.

| Fonction | Attendu après scénario A |
|---|---|
| is_manager | DEFINER, search_path=public (0037) — équivalent à la correction §62, sûr |
| open_ticket_count | DEFINER, EXECUTE PUBLIC révoqué (0037) + garde auth.uid() (062/002) |
| 8 admin_* + decrement_product_stock + my_features | DEFINER, PUBLIC révoqué (0037), garde is_saas_admin intacte |
| is_saas_admin / current_establishment_id / autoplus_current_role | DEFINER, PUBLIC révoqué (0037) |

## Objets attendus après 0036-0039

- Colonnes : establishments.professional_id, profiles.login_id/must_change_password.
- Tables : invitations, invitation_events.
- RPC v2 : admin_onboard_tenant_v2, admin_check_identity_available, resolve_login_email, has_feature, my_permissions, get_my_security_state, admin_complete_password_change.
- RLS : policies restrictives (0038), password_rotation_required et permissions_saas_admin_write (0039).
- Index uniques : professional_id, login_id ; index FK améliorés.

## État actuel (lecture seule §64)

Aucun de ces objets n est présent en production (vérifié : 0 RPC v2, 0 colonne professional_id). Aucune validation PostgreSQL réelle possible sans staging. **BLOQUÉ**.


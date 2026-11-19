# GV5 §61 — Audit individuel des 15 fonctions de sécurité

Date : 17 novembre 2026. Preuves : SELECT sur pg_proc/proacl/aclexplode. Aucune modification distante.

## 1. Les 8 fonctions administratives `admin_*`

Toutes : SECURITY DEFINER, owner postgres, `search_path=public`, `proacl = {=X/postgres, postgres=X/postgres, authenticated=X/postgres}` (PUBLIC EXECUTE explicite). Volatilité `v`. Retour void sauf admin_create_establishment (uuid).

| Fonction | Signature | Garde interne | Tables modifiées | Correctif |
|---|---|---|---|---|
| admin_change_plan | (uuid, text)→void | is_saas_admin() avant UPDATE | establishments, audit_log | revoke PUBLIC |
| admin_create_establishment | (text×6)→uuid | is_saas_admin() | establishments | revoke PUBLIC |
| admin_expire_subscription | (uuid)→void | is_saas_admin() | subscriptions | revoke PUBLIC |
| admin_reactivate_subscription | (uuid)→void | is_saas_admin() | subscriptions | revoke PUBLIC |
| admin_renew_subscription | (uuid,int)→void | is_saas_admin() | subscriptions | revoke PUBLIC |
| admin_save_plan | (text,numeric,numeric,int×4)→void | is_saas_admin() | plans | revoke PUBLIC |
| admin_set_establishment_status | (uuid,bool)→void | is_saas_admin() | establishments | revoke PUBLIC |
| admin_set_feature | (text,text,bool)→void | is_saas_admin() | plan_features, audit_log | revoke PUBLIC |

Analyse : le garde `if not public.is_saas_admin() then raise` est exécuté **avant** toute opération sensible (vérifié dans le corps de admin_change_plan, admin_save_plan, admin_set_feature). Un appel `anon` lève donc une exception → pas d escalade. Le PUBLIC EXECUTE est un défaut de défense en profondeur (P0 hygiène), pas une faille directe.

## 2. decrement_product_stock, my_features, open_ticket_count

| Fonction | Sécurité | proacl | Garde interne | Observation |
|---|---|---|---|---|
| decrement_product_stock(uuid,int)→void | DEFINER, search_path=public | PUBLIC+X | `is_manager() or is_saas_admin()` | Garde present ; dépend de is_manager (à durcir) |
| my_features()→TABLE | DEFINER, search_path=public | PUBLIC+X | aucune (lecture) | Lit plan_features ∩ permissions pour l établissement courant ; PUBLIC permet lecture anonyme (données non sensibles mais à restreindre) |
| open_ticket_count(uuid)→int | DEFINER, search_path=public | PUBLIC+X | **AUCUNE** | **P1 : accepte p_establishment_id arbitraire, aucun contrôle d isolation → un appelant PUBLIC peut compter les tickets de n importe quel établissement** |

## 3. Les 4 helpers

| Helper | Sécurité | search_path | proacl | Corps | Risque |
|---|---|---|---|---|---|
| is_saas_admin()→bool | DEFINER | public | NULL (PUBLIC défaut) | `public.autoplus_current_role() = saas_admin` | lecture seule, Pas d élévation |
| current_establishment_id()→uuid | DEFINER | public | NULL | `select establishment_id from public.profiles where id=auth.uid()` | isolation correcte (auth.uid) |
| autoplus_current_role()→user_role | DEFINER | public | NULL | `select role from public.profiles where id=auth.uid()` | provenance sûre |
| is_manager()→bool | **INVOKER** | **AUCUN** | NULL | `select autoplus_current_role() in (...)` **non qualifié** | **P0 : résolution d objet non qualifiée (injection search_path) + exposé PUBLIC** |

Aucun helper ne permet de choisir arbitrairement un établissement (tous basés sur auth.uid()).

## 4. Utilisations

- `is_saas_admin()` : garde des 8 admin_*, policies RLS (establishments, audit_log, plans, subscriptions, crm_leads, profiles, onboarding_requests).
- `current_establishment_id()` : policies tenant_isolation (~25 tables).
- `is_manager()` : policies audit_log INSERT, decrement_product_stock.
- `my_features()` / `has_feature()` (ce dernier absent en distant) : entitlement forfait ∩ permissions.
- `open_ticket_count()` : appelée par le frontend Support.


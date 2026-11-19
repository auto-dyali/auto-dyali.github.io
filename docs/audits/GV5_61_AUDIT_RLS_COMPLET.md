# GV5 §61 — Audit approfondi des politiques RLS

Date : 17 novembre 2026. SELECT sur pg_class/pg_policies. 36 tables, owner postgres, RLS=true, FORCE RLS=false partout.

## 1. Inventaire

36 tables applicatives, toutes avec RLS activé. Aucune vue matérialisée ou vue dans public (pas de contournement RLS par vue). Aucune politique RESTRICTIVE (toutes PERMISSIVE, combinées par OR). Propriétaire postgres partout.

## 2. Politiques par domaine Super Admin

| Table | Politiques | Expression clé | Évaluation |
|---|---|---|---|
| establishments | 5 (own_establishment, saas_admin_full_access, insert/update admin, tenant_isolation) | id=current_establishment_id() OR is_saas_admin() | OK ; plusieurs PERMISSIVE mais cohérentes (OR voulu) |
| profiles | 2 | id=auth.uid() OR establishment_id=current_establishment_id() OR is_saas_admin() | OK |
| audit_log | 4 | establishment=current_establishment_id() OR is_saas_admin() | OK ; INSERT gardé par (is_saas_admin OR is_manager) |
| subscriptions | 2 | establishment=current_establishment_id() OR is_saas_admin() | OK |
| plans / plan_features | 2 chacune | auth.uid() IS NOT NULL (lecture) + is_saas_admin() (ALL) | OK |
| support_tickets / ticket_messages | 1 chacune | establishment=current_establishment_id() OR is_saas_admin() | OK |
| crm_leads / crm_events | 1 chacune | is_saas_admin() uniquement | OK (CRM = SA only) |
| onboarding_requests | 1 | is_saas_admin() | OK |

## 3. Points d attention

1. **Récursion RLS apparente** : current_establishment_id()/autoplus_current_role() lisent public.profiles dont la policy SELECT appelle current_establishment_id(). Ce n est pas une récursion infinie car ces fonctions sont SECURITY DEFINER (owner postgres) → elles contournent la RLS de profiles. À confirmer par test multi-tenant.
2. **PERMISSIVE multiples** : audit_log et establishments ont 4-5 policies PERMISSIVE combinées par OR. Le §46 A5/A7 demandait des policies RESTRICTIVE (migration 0038 non appliquée). Ce n est pas une faille directe ici car les expressions sont cohérentes, mais 0038 reste recommandée pour durcir.
3. **FORCE RLS désactivé** : décision §51 maintenue (le activer casserait les RPC SECURITY DEFINER dont le owner postgres contourne sinon RLS). Ne pas activer globalement.
4. Détail des USING/WITH CHECK complets : voir script 004_rls_policy_review.sql.


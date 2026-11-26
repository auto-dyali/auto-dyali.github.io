-- AUTO DYALI — GV5 §117 — Correction du blocage d'onboarding.
-- MIGRATION ADDITIVE séparée : aucun objet des 9 migrations n'est modifié.
-- PRÉPARÉE — NON APPLIQUÉE (ni staging, ni production).
--
-- Cause prouvée (SCRIPT-SQL / PRODUCTION) :
--   relacl public.profiles = {postgres=arwdDxtm, anon=Dxtm,
--                             authenticated=arwDxtm, service_role=Dxtm}
--   → service_role n'a pas SELECT, alors que l'Edge Function onboard-tenant
--     ouvre un client administratif avec SUPABASE_SERVICE_ROLE_KEY et lit
--     `role, is_active` pour vérifier le Super Admin après auth.getUser(jwt).
-- RLS reste activée ; aucun privilège n'est ajouté à anon ou authenticated ;
-- le contrôle d'identité n'est ni supprimé ni affaibli (toujours JWT + rôle
-- saas_admin + is_active).

grant select on public.profiles to service_role;

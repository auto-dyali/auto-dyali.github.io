-- AUTO DYALI — GV5 §121 — Correctif minimal des lectures `service_role` du parcours onboarding.
-- MIGRATION ADDITIVE préparée — NON APPLIQUÉE (ni staging, ni production).
--
-- Cause (AUDIT §121 — Edge Functions déployées en lecture seule) :
--   `onboard-tenant` (`readDelivery`) lit `public.invitations` via le client
--   `service_role` ; `send-invitation` lit `public.profiles`,
--   `public.invitations` et `public.establishments` via le client `service_role` ;
--   `activate-manager` lit `public.invitations` via le client `service_role`.
--   Ces lectures suivront l'installation du GRANT `profiles` (§117/§118) et
--   échoueront avec le même motif « permission denied » si aucun droit n'est
--   accordé. Seules les lectures `SELECT` nécessaires sont ciblées.
--
-- Correctif : deux instructions `GRANT SELECT`, minimales et distinctes.
-- Aucun autre privilège n'est ajouté, aucune table n'est élargie, aucun RLS ni
-- politique n'est modifié.

grant select on public.invitations to service_role;
grant select on public.establishments to service_role;

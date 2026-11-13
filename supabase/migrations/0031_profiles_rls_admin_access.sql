-- =====================================================================
-- AUTO DYALI — 0031 : RLS profils & clients (Phase 2)
-- Ajout des politiques manquantes identifiees lors de l'audit read-only:
--   - `profiles` n'avait pas de policy UPDATE -> les actions
--     d'activation/desactivation via le Super Admin echouaient en RLS.
--   - `clients` n'avait pas de policy Super Admin -> le dashboard
--     Super Admin ne pouvait pas lire la liste clients en conditions reelles.
-- =====================================================================

drop policy if exists profiles_saas_admin_update on public.profiles;
create policy profiles_saas_admin_update on public.profiles
  for update
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

drop policy if exists clients_saas_admin on public.clients;
create policy clients_saas_admin on public.clients
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

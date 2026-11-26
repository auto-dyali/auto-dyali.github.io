-- AUTO DYALI — GV5 §110 — Migration ADDITIVE (jamais intégrée aux 9).
-- Durcit `permissions_tenant_write` : écriture tenant réservée aux Managers
-- (ou au Super Admin), au lieu de tout utilisateur authentifié du garage.
-- PRÉPARÉE — NON APPLIQUÉE (ni staging, ni production).

drop policy if exists permissions_tenant_write on public.permissions;

create policy permissions_tenant_write on public.permissions
  for all to authenticated
  using (
    public.is_saas_admin()
    or (
      public.is_manager()
      and establishment_id = public.current_establishment_id()
    )
  )
  with check (
    public.is_saas_admin()
    or (
      public.is_manager()
      and establishment_id = public.current_establishment_id()
    )
  );

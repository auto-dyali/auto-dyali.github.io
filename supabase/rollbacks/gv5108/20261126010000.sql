-- Retour arrière de 20261126010000 : restaure exactement la policy 109000.
-- PRÉPARÉ — NON APPLIQUÉ.

drop policy if exists permissions_tenant_write on public.permissions;

create policy permissions_tenant_write on public.permissions
  for all to authenticated
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

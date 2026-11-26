-- AUTO DYALI — GV5 §107 — migration CORRECTIVE n°9.
-- Le front de main (81ca143) écrit directement dans public.permissions
-- (src/components/permissions-module.tsx : UPDATE/INSERT) avec un rôle non
-- Super Admin, en s'appuyant sur la policy historique `tenant_isolation`
-- (FOR ALL) de production. La corrective 101000 supprime cette policy et ne
-- laisse qu'une lecture tenant + une écriture Super Admin : l'ancien parcours
-- serait cassé. On restaure une écriture tenant équivalente, sans modifier
-- 101000 (déjà appliquée sur staging). Additive, idempotente, réversible.

drop policy if exists permissions_tenant_write on public.permissions;

create policy permissions_tenant_write on public.permissions
  for all to authenticated
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

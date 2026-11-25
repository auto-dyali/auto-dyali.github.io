-- Retour arrière de la corrective n°9 (permissions, écriture tenant).
drop policy if exists permissions_tenant_write on public.permissions;

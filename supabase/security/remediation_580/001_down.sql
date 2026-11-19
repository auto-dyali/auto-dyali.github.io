-- ROLLBACK GV5 §80 / 001 — retire la RPC de suppression définitive.
-- Les données déjà purgées et les traces d'audit ne sont pas restaurables.

drop function if exists public.admin_purge_establishment(uuid);

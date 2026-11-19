-- GV5 §62 — 001_fix_is_manager.sql — CORRECTION P0
-- STATUT : PRÉPARÉ — NON EXÉCUTÉ. Nécessite autorisation + sauvegarde/PITR.
-- Problème (§61) : is_manager() = SECURITY INVOKER, sans search_path,
--   appel non qualifié de autoplus_current_role() → risque d injection de schéma.
-- Analyse dépendances : is_manager() est appelée par :
--   - audit_log policy managers_insert_audit_log (WITH CHECK)
--   - decrement_product_stock (garde interne)
--   - frontend via helpers éventuels (rôle manager/saas_admin)
-- Justification SECURITY DEFINER : nécessaire car la fonction lit
--   autoplus_current_role() qui lit public.profiles ; en INVOKER avec
--   search_path non fixé, un rôle pourrait shadow la fonction. DEFINER
--   avec search_path immuable garantit la résolution vers public.
-- search_path = pg_catalog, public : pg_catalog d abord (fonctions système
--   non shadowables), puis public pour autoplus_current_role.

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.autoplus_current_role() in ('manager','saas_admin');
$$;

revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

-- Attendu après application :
--   select prosecdef, proconfig from pg_proc where proname='is_manager';
--   -> true, {search_path=pg_catalog, public}
--   select ... aclexplode(grantee=0) -> 0 ligne pour is_manager.

-- ROLLBACK (documenté, NON exécuté) — restaure la définition d origine :
-- create or replace function public.is_manager() returns boolean language sql
--   stable security invoker as $$ select autoplus_current_role() in ('manager','saas_admin'); $$;
-- (le rollback rétablit volontairement la vulnérabilité : à n utiliser
--  qu en cas de régression bloquante constatée après application).

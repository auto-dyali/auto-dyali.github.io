-- GV5 §61 — 001_inventory.sql
-- STATUT : SCRIPT DE DIAGNOSTIC — LECTURE SEULE. NE PAS MODIFIER LA BASE.
-- Prérequis : aucun. Peut être exécuté autant de fois que nécessaire.

-- 1. Les 15 fonctions SECURITY DEFINER / helpers auditées
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, pg_get_userbyid(p.proowner) as owner,
       coalesce(array_to_string(p.proconfig,','),'NONE') as proconfig,
       case when p.proacl is null then 'NULL(PUBLIC default)' else p.proacl::text end as proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'admin_change_plan',
  'admin_create_establishment',
  'admin_expire_subscription',
  'admin_reactivate_subscription',
  'admin_renew_subscription',
  'admin_save_plan',
  'admin_set_establishment_status',
  'admin_set_feature',
  'decrement_product_stock',
  'my_features',
  'open_ticket_count',
  'is_saas_admin',
  'current_establishment_id',
  'autoplus_current_role',
  'is_manager',
  'x') order by p.proname;

-- 2. Fonctions SECURITY DEFINER avec PUBLIC EXECUTE (doit retourner 0 après correction)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
       aclexplode(p.proacl) a
where n.nspname='public' and p.prosecdef and a.grantee=0 and a.privilege_type='EXECUTE'
order by p.proname;

-- 3. Politiques RLS (toutes tables applicatives)
select tablename, policyname, permissive, cmd, array_to_string(roles,',') roles
from pg_policies where schemaname='public' order by tablename, policyname;

-- 4. État RLS / FORCE RLS par table
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m') order by c.relname;

-- 5. FK sans index menant (inventaire)
select con.conname, c.relname tbl, a.attname col
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum=any(con.conkey)
where con.contype='f' and n.nspname='public'
  and not exists (select 1 from pg_index i where i.indrelid=c.oid and i.indkey[0]=a.attnum)
order by c.relname, con.conname;

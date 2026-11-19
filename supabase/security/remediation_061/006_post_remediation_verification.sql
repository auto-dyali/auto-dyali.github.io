-- GV5 §61 — 006_post_remediation_verification.sql
-- STATUT : VÉRIFICATION — LECTURE SEULE. À exécuter après correction autorisée.

-- 1. Aucune fonction SECURITY DEFINER avec EXECUTE PUBLIC
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
       aclexplode(p.proacl) a
where n.nspname='public' and p.prosecdef and a.grantee=0 and a.privilege_type='EXECUTE'
order by p.proname;  -- ATTENDU : 0 ligne

-- 2. is_manager durci
select prosecdef, proconfig from pg_proc where proname='is_manager';
-- ATTENDU : true, {search_path=public}

-- 3. authenticated conserve EXECUTE sur les admin_* (non-régression)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
       aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee
where n.nspname='public' and r.rolname='authenticated' and a.privilege_type='EXECUTE'
  and p.proname like 'admin\_%' order by p.proname;
-- ATTENDU : toutes les admin_* listées (au moins 11)

-- 4. RLS active sur toutes les tables applicatives
select count(*) filter (where relrowsecurity) as rls_on,
       count(*) filter (where not relrowsecurity) as rls_off
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r';  -- ATTENDU : rls_off = 0

-- 5. Fonctions v2 présentes (après 0039)
select proname from pg_proc where proname in ('admin_onboard_tenant_v2','has_feature','resolve_login_email');
-- ATTENDU : 3 lignes

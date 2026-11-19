-- GV5 §63 — 001_read_only_verification.sql
-- STATUT : LECTURE SEULE (SELECT). Aucune modification.
-- Exécuter AVANT et APRÈS application autorisée. Comparer les résultats.

-- 1. Historique migrations (si table accessible)
select version from supabase_migrations.schema_migrations order by version desc limit 20;
-- ATTENDU AVANT : 0036-0039 absents. APRÈS : présents.

-- 2. Colonnes critiques
select table_name, column_name from information_schema.columns
where table_schema='public' and ((table_name='establishments' and column_name='professional_id')
   or (table_name='profiles' and column_name in ('login_id','must_change_password')))
order by table_name, column_name;  -- AVANT : 0 ligne. APRÈS : 3 lignes.

-- 3. Tables invitations
select table_name from information_schema.tables
where table_schema='public' and table_name in ('invitations','invitation_events');
-- AVANT : 0. APRÈS : 2.

-- 4. RPC v2
select proname from pg_proc where proname in ('admin_onboard_tenant_v2','has_feature','resolve_login_email','admin_check_identity_available');
-- AVANT : 0. APRÈS : 4.

-- 5. is_manager durci
select prosecdef, proconfig from pg_proc where proname='is_manager';
-- AVANT : false, NULL. APRÈS : true, {search_path=pg_catalog,public} (scénario B) ou {search_path=public} (0037).

-- 6. open_ticket_count (garde tenant)
select prosrc from pg_proc where proname='open_ticket_count';
-- AVANT : count direct sur p_establishment_id. APRÈS : dérivation auth.uid()+profiles.

-- 7. SECURITY DEFINER avec EXECUTE PUBLIC (critère NO-GO si >0 hors exceptions)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace, aclexplode(p.proacl) a
where n.nspname='public' and p.prosecdef and a.grantee=0 and a.privilege_type='EXECUTE' order by p.proname;
-- AVANT : 11 (explicites) + 4 proacl NULL = 15. APRÈS : 0 (hors resolve_login_email qui reste anon volontairement).

-- 8. RLS / FORCE / RESTRICTIVE
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity) rls_on,
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relforcerowsecurity) force_rls,
       (select count(*) from pg_policies where schemaname='public' and permissive='RESTRICTIVE') restrictive;
-- AVANT : 36 / 0 / 0. APRÈS : 36 / 0 (décision §51) / >0 (0038).

-- 9. Données historiques (préserver)
select id, name, slug, plan from public.establishments order by name;
select id, role, is_active from public.profiles order by role;
-- AVANT = APRÈS : 2 établissements, 1 profil saas_admin. Aucune donnée modifiée.

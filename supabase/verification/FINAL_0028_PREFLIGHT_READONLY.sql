-- =====================================================================
-- AUTO DYALI — FINAL PREFLIGHT — LECTURE SEULE
-- Vérification exhaustive avant application de la migration 0028.
-- AUCUN INSERT/UPDATE/DELETE/DDL. Chaque section est indépendante.
-- Projet : nxmsqqoflskfajqrqddw
-- =====================================================================

-- =====================================================================
-- SECTION 1 — Tables et colonnes indispensables
-- =====================================================================
select table_name, 'présente' as etat
from information_schema.tables
where table_schema='public'
  and table_name in ('plans','plan_features','subscriptions','establishments','profiles','audit_log','onboarding_requests')
order by table_name;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='establishments'
order by ordinal_position;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='subscriptions'
order by ordinal_position;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;

-- =====================================================================
-- SECTION 2 — Présence, signatures et définitions des fonctions
-- (0009 / 0010 / RPC 0028 attendues absentes)
-- =====================================================================
select n.nspname, p.proname,
       pg_get_function_arguments(p.oid) as arguments,
       md5(p.prosrc) as definition_md5,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('is_saas_admin','autoplus_current_role','current_establishment_id','get_my_profile',
                    'has_feature','my_features',
                    'admin_create_establishment','admin_change_plan','admin_set_establishment_status','admin_save_plan','admin_set_feature',
                    'admin_find_user_id_by_email','admin_find_onboarding_request','admin_onboard_tenant','admin_attach_manager','admin_tenant_integrity')
order by p.proname;

-- =====================================================================
-- SECTION 3 — Politiques RLS (0009 / 0010 / 0028-cibles)
-- =====================================================================
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('plans','plan_features','subscriptions','establishments','profiles','audit_log')
order by tablename, policyname;

-- =====================================================================
-- SECTION 4 — RLS activé par table + privilèges EXECUTE par rôle
-- =====================================================================
select c.relname as table_, c.relrowsecurity as rls_activé
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and c.relname in ('plans','plan_features','subscriptions','establishments','profiles','audit_log')
order by c.relname;

select p.proname,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public_execute,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = (select oid from pg_roles where rolname='authenticated')) as authenticated_execute,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = (select oid from pg_roles where rolname='anon')) as anon_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('is_saas_admin','get_my_profile','has_feature','my_features','admin_create_establishment','admin_onboard_tenant','admin_attach_manager','admin_tenant_integrity','admin_find_user_id_by_email','admin_find_onboarding_request')
order by p.proname;

-- =====================================================================
-- SECTION 5 — Contraintes et clés étrangères des tables concernées
-- =====================================================================
select tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema='public'
  and tc.table_name in ('plans','plan_features','subscriptions','establishments','profiles')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

select kcu.table_name as table_, kcu.column_name,
       ccu.table_name as references_table, ccu.column_name as references_column
from information_schema.key_column_usage kcu
join information_schema.referential_constraints rc on rc.constraint_name = kcu.constraint_name
join information_schema.key_column_usage ccu
     on ccu.constraint_name = rc.unique_constraint_name
where kcu.table_schema='public'
  and kcu.table_name in ('plan_features','subscriptions','profiles')
order by kcu.table_name, kcu.column_name;

-- =====================================================================
-- SECTION 6 — Type énuméré user_role (valeurs réelles)
-- =====================================================================
select t.typname as enum_type, e.enumlabel as valeur, e.enumsortorder as ordre
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'user_role'
order by e.enumsortorder;

-- =====================================================================
-- SECTION 7 — Comptages des ressources existantes
-- (chaque requête est indépendante ; aucune n'écrit)
-- =====================================================================
select 'establishments' as table_, count(*) as lignes from public.establishments;
select 'profiles' as table_, count(*) as lignes from public.profiles;
select 'subscriptions' as table_, count(*) as lignes from public.subscriptions;
select 'plans' as table_, count(*) as lignes from public.plans;
select 'audit_log' as table_, count(*) as lignes from public.audit_log;
select 'plan_features' as table_, count(*) as lignes from public.plan_features;
select 'clients' as table_, count(*) as lignes from public.clients;
select 'support_tickets' as table_, count(*) as lignes from public.support_tickets;

-- Forfaits requis pour l'onboarding
select code, label, price_monthly, trial_days, max_users, max_sites, storage_mb
from public.plans order by code;

-- =====================================================================
-- SECTION 8 — Vérification ciblée des deux comptes de test
-- =====================================================================
select pr.id, pr.full_name, pr.role, pr.establishment_id, pr.is_active
from public.profiles pr
where pr.id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2');

select count(*) as auth_test_users
from auth.users
where id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2');

-- =====================================================================
-- SECTION 9 — Établissement partagé protégé
-- =====================================================================
select id, name, slug, plan, is_active, created_at
from public.establishments
where id = '00000000-0000-0000-0000-000000000001';

-- =====================================================================
-- SECTION 10 — Abonnement partagé protégé
-- =====================================================================
select id, establishment_id, plan_code, status, started_at, current_period_end
from public.subscriptions
where id = '47b1c71e-cf73-46a5-b0a4-b3f4ac762e22';

-- =====================================================================
-- SECTION 11 — Absence des objets 0028 (état attendu AVANT application)
-- =====================================================================
select case when exists (
         select 1 from information_schema.tables
          where table_schema='public' and table_name='onboarding_requests'
       ) then 'EXISTE (0028 déjà appliquée ?)' else 'ABSENTE (état attendu)' end as onboarding_requests_etat;

select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('admin_find_user_id_by_email','admin_find_onboarding_request','admin_onboard_tenant','admin_attach_manager','admin_tenant_integrity');

-- FIN — rien ci-dessus n'écrit ni ne modifie quoi que ce soit.

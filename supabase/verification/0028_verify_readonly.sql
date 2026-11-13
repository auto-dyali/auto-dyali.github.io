-- =====================================================================
-- AUTO DYALI — Vérification SANS RISQUE avant application de 0028
-- Lecture seule uniquement : AUCUN insert/update/delete/DDL n'est exécuté.
-- Utilisation : Supabase Dashboard → SQL Editor → coller tout le script → Run.
-- Projet : nxmsqqoflskfajqrqddw
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables publiques attendues (dont 0028 ajoutera onboarding_requests)
-- ---------------------------------------------------------------------
select table_name, 'présente' as etat
from information_schema.tables
where table_schema='public'
  and table_name in ('plans','plan_features','subscriptions','establishments','profiles','audit_log','onboarding_requests','clients','crm_leads','support_tickets')
order by table_name;

-- ---------------------------------------------------------------------
-- 2. Colonnes critiques : establishments (trial_ends_at / suspended_at / logo_url)
-- ---------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='establishments'
  and column_name in ('id','name','slug','plan','is_active','suspended_at','trial_ends_at','logo_url','created_at')
order by ordinal_position;

-- ---------------------------------------------------------------------
-- 3. Fonctions RPC critiques (0010 / 0009 / 0028)
-- ---------------------------------------------------------------------
select n.nspname as schema, p.proname as function, pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'is_saas_admin','autoplus_current_role','current_establishment_id',
    'get_my_profile','has_feature','my_features',
    'admin_create_establishment','admin_change_plan','admin_set_establishment_status','admin_save_plan','admin_set_feature',
    'admin_find_user_id_by_email','admin_find_onboarding_request','admin_onboard_tenant','admin_attach_manager','admin_tenant_integrity'
  )
order by p.proname;

-- ---------------------------------------------------------------------
-- 4. Politiques RLS sur les tables concernées par 0028
-- ---------------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('establishments','subscriptions','profiles','audit_log','plans','plan_features','onboarding_requests')
order by tablename, policyname;

-- ---------------------------------------------------------------------
-- 5. Droits d'exécution sur les RPC (ce que voient authenticated / anon)
-- ---------------------------------------------------------------------
select n.nspname, p.proname,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public_execute,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = (select oid from pg_roles where rolname='authenticated')) as authenticated_execute,
       exists(select 1 from aclexplode(p.proacl) a where a.grantee = (select oid from pg_roles where rolname='anon')) as anon_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('is_saas_admin','get_my_profile','admin_create_establishment','admin_onboard_tenant','admin_tenant_integrity','admin_attach_manager','admin_find_user_id_by_email','admin_find_onboarding_request','my_features')
order by p.proname;

-- ---------------------------------------------------------------------
-- 6. Sécurité côté auth (nombre de comptes — SANS afficher emails/mots de passe)
-- ---------------------------------------------------------------------
select count(*) as auth_users from auth.users;

-- ---------------------------------------------------------------------
-- 7. Comptages AVANT application (référence pour confirmer "aucune suppression")
-- ---------------------------------------------------------------------
select 'establishments' as table_, count(*) as lignes from public.establishments
union all select 'profiles', count(*) from public.profiles
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'plans', count(*) from public.plans
union all select 'audit_log', count(*) from public.audit_log
union all select 'crm_leads', count(*) from public.crm_leads
union all select 'support_tickets', count(*) from public.support_tickets;

-- ---------------------------------------------------------------------
-- 8. Vérification ciblée des 2 comptes de test et des ressources partagées
--    (lecture seule, aucune modification)
-- ---------------------------------------------------------------------
select pr.id, pr.role, pr.establishment_id, pr.is_active
from public.profiles pr
where pr.id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2');

select count(*) as etab_partage_present
  from public.establishments where id = '00000000-0000-0000-0000-000000000001';

select count(*) as abo_partage_present
  from public.subscriptions where id = '47b1c71e-cf73-46a5-b0a4-b3f4ac762e22';

-- ---------------------------------------------------------------------
-- 9. Présence éventuelle d'onboarding_requests (témoin d'application antérieure)
--    (interrogation via information_schema — ne lève pas d'erreur si la table n'existe pas)
-- ---------------------------------------------------------------------
select case when exists (
         select 1 from information_schema.tables
          where table_schema='public' and table_name='onboarding_requests'
       ) then 'EXISTE (0028 déjà appliquée ?)' else 'ABSENTE (état attendu)' end as onboarding_requests_etat;

-- FIN DU SCRIPT — rien ci-dessus n'écrit ni ne modifie aucune donnée.

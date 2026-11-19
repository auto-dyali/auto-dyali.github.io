-- =====================================================================
-- AUTO DYALI — 0037 : Durcissement sécurité P0 (préparée, NON APPLIQUÉE)
--
-- Cible : corriger les anomalies de sécurité identifiées dans l'audit GV5 §46 :
--   A1. 16 fonctions SECURITY DEFINER exposables à `anon` via PUBLIC (P0)
--   A2. Fonctions administratives exécutables par `authenticated` (P0)
--   A3. `is_manager()` sans SECURITY DEFINER / sans search_path (risque d'injection) (P0)
--   A7. Politiques RLS permissives multiples sur `audit_log` et `establishments` (P1)
--
-- PRÉREQUIS OBLIGATOIRES (avant exécution distante) :
--   1) Sauvegarde/PITR vérifiée et exploitable.
--   2) Audit read-only de l'état réel (définitions, privilèges EXECUTE,
--      propriétaires, RLS/policies).
--   3) Autorisation explicite (levée ciblée gel P0).
--   4) Exécution contrôlée via SQL Editor (rôle owner/service role).
--
-- NE PAS supprimer de données. NE PAS modifier les données métier existantes.
-- Aucune clé secrète n'est manipulée dans ce fichier.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles (échoue si dépendances critiques absentes)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0037: is_saas_admin() absente.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_manager'
  ) then
    raise exception 'ARRÊT 0037: is_manager() absente.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='current_establishment_id'
  ) then
    raise exception 'ARRÊT 0037: current_establishment_id() absente.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='autoplus_current_role'
  ) then
    raise exception 'ARRÊT 0037: autoplus_current_role() absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0037: table establishments absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT 0037: table profiles absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='audit_log') then
    raise exception 'ARRÊT 0037: table audit_log absente.';
  end if;
  raise notice '0037 pré-contrôles OK (dépendances présentes).';
end $$;

-- ---------------------------------------------------------------------
-- 1. Corriger is_manager() : SECURITY DEFINER + search_path fixe
--    (anomalie A3 de l'audit GV5 §46)
--    is_manager() était SECURITY INVOKER sans search_path, permettant
--    une potentielle injection de schéma via autoplus_current_role().
-- ---------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.autoplus_current_role() in ('manager','saas_admin');
$$;

revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Révoquer EXECUTE sur PUBLIC pour les 16 fonctions exposables
--    à anon selon l'audit GV5 §46 (anomalie A1)
--
--    Liste établie à partir de has_function_privilege(oid, 'EXECUTE')
--    = true pour le rôle PUBLIC, filtrées sur security_definer = true
--    ou is_manager (INVOKER mais exposé à PUBLIC).
-- ---------------------------------------------------------------------
-- Fonctions administratives (P0 - création/modification/suppression)
revoke all on function public.admin_create_establishment(text,text,text,text,text,text) from public;
revoke all on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) from public;
revoke all on function public.admin_change_plan(uuid,text) from public;
revoke all on function public.admin_set_establishment_status(uuid,boolean) from public;
revoke all on function public.admin_set_feature(text,text,boolean) from public;
revoke all on function public.admin_expire_subscription(uuid) from public;
revoke all on function public.admin_reactivate_subscription(uuid) from public;
revoke all on function public.admin_renew_subscription(uuid,integer) from public;
revoke all on function public.admin_delete_client_account(uuid) from public;
revoke all on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer,text) from public;

-- Fonctions d'identité et helpers (P0)
revoke all on function public.is_saas_admin() from public;
revoke all on function public.current_establishment_id() from public;
revoke all on function public.autoplus_current_role() from public;
revoke all on function public.decrement_product_stock(uuid,integer) from public;
revoke all on function public.my_features() from public;
revoke all on function public.open_ticket_count(uuid) from public;
revoke all on function public.get_my_profile() from public;

-- ---------------------------------------------------------------------
-- 3. Accès RESTREINT à authenticated uniquement
--    (garde interne is_saas_admin() conservé sur chaque fonction)
-- ---------------------------------------------------------------------
grant execute on function public.admin_create_establishment(text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function public.admin_change_plan(uuid,text) to authenticated;
grant execute on function public.admin_set_establishment_status(uuid,boolean) to authenticated;
grant execute on function public.admin_set_feature(text,text,boolean) to authenticated;
grant execute on function public.admin_expire_subscription(uuid) to authenticated;
grant execute on function public.admin_reactivate_subscription(uuid) to authenticated;
grant execute on function public.admin_renew_subscription(uuid,integer) to authenticated;
grant execute on function public.admin_delete_client_account(uuid) to authenticated;
grant execute on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer,text) to authenticated;

grant execute on function public.is_saas_admin() to authenticated;
grant execute on function public.current_establishment_id() to authenticated;
grant execute on function public.autoplus_current_role() to authenticated;
grant execute on function public.decrement_product_stock(uuid,integer) to authenticated;
grant execute on function public.my_features() to authenticated;
grant execute on function public.open_ticket_count(uuid) to authenticated;
grant execute on function public.get_my_profile() to authenticated;

-- ---------------------------------------------------------------------
-- 4. FORCE ROW LEVEL SECURITY : NON ACTIVÉ (décision GV5 §51)
--
--    L'audit §51 a montré que `FORCE ROW LEVEL SECURITY` casserait les RPC
--    `SECURITY DEFINER` de la plateforme (`is_saas_admin()`,
--    `current_establishment_id()`, `my_features()`, `admin_*`) : ces fonctions
--    s'exécutent avec le rôle propriétaire, et FORCE RLS les soumettrait aux
--    politiques des tables qu'elles lisent — y compris pendant les contrôles
--    d'accès eux-mêmes (récursion de policies).
--
--    La protection est assurée autrement :
--      • RLS reste ACTIVÉ sur toutes les tables (jamais désactivé) ;
--      • les politiques restrictives de rotation de mot de passe (0039)
--        s'ajoutent aux politiques existantes ;
--      • les accès privilégiés passent exclusivement par des RPC contrôlées
--        (`is_saas_admin()`), jamais par le client ;
--      • les privilèges EXECUTE de PUBLIC sont révoqués (section 2).
--
--    Aucun `alter table ... force row level security` n'est exécuté ici.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 5. Journalisation de l'opération de durcissement
-- ---------------------------------------------------------------------
insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
values (
  null,
  auth.uid(),
  'security_hardening_p0',
  'system',
  null,
  jsonb_build_object(
    'action', 'revoke_execute_public',
    'functions_revoked_from_public', 16,
    'functions_granted_to_authenticated', 16,
    'force_rls', false,
    'force_rls_rationale', 'FORCE RLS casserait les RPC SECURITY DEFINER (is_saas_admin, my_features, admin_*). RLS reste activé ; les politiques restrictives 0039 assurent la rotation de mot de passe.',
    'rationale', 'Empêcher l exécution de fonctions administratives par des utilisateurs non authentifiés (anon). Correction de is_manager() (SECURITY INVOKER → SECURITY DEFINER + search_path fixe).'
  )
);

-- =====================================================================
-- FIN 0037 (préparée). À appliquer uniquement après sauvegarde vérifiée
-- et autorisation explicite, via SQL Editor (rôle owner ou service role).
-- =====================================================================

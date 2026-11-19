-- GV5 §61 — 003_helper_function_hardening.sql
-- STATUT : PRÉPARÉ — NON EXÉCUTÉ. Nécessite autorisation + sauvegarde/PITR.
-- Corrige is_manager() : SECURITY INVOKER -> SECURITY DEFINER, ajout search_path,
-- qualification de l appel a autoplus_current_role() (risque d injection §46 A3).
-- Prérequis : is_saas_admin(), autoplus_current_role() existent (vérifié).

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

-- Note : is_saas_admin(), current_establishment_id(), autoplus_current_role()
-- ont déjà search_path=public et lisent public.profiles via auth.uid().
-- Aucune modification de leur corps n est proposée (conforme).
-- Risque de récursion RLS : les helpers sont SECURITY DEFINER -> contournent
-- la RLS de profiles (propriétaire postgres) -> pas de récursion infinie.

-- Vérification :
-- select prosecdef, proconfig from pg_proc where proname='is_manager';
-- Attendu : true, {search_path=public}

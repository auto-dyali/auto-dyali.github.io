-- AUTO DYALI — GV5 §107-PROD-MINIMAL — Migration corrective.
-- Copie idempotente de 001_identity_health.sql : RPC de diagnostic admin_identity_v2_health().
-- Aucune migration déjà appliquée n'est modifiée ; cible PRODUCTION après GO-3.
-- Ne concerne QUE le parcours de création d'établissement.

-- AUTO DYALI — GV5 §83 — Diagnostic d'environnement « identité v2 » (STAGING)
-- Réversible : 001_down.sql. Aucune donnée modifiée.
--
-- Objective : permettre au Super Admin de vérifier, avant une création, que
-- l'environnement cible possède bien les objets issus de la migration 0039.
-- L'incident signalé provenait d'un environnement (production) où ces objets
-- sont absents : la RPC admin_check_identity_available renvoyait PGRST202 et
-- le frontend affichait « migration 0039 non appliquée ».

create or replace function public.admin_identity_v2_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;

  return jsonb_build_object(
    'establishments_professional_id', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='establishments' and column_name='professional_id'
    ),
    'profiles_login_id', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='login_id'
    ),
    'profiles_must_change_password', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='must_change_password'
    ),
    'fn_admin_check_identity_available', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='admin_check_identity_available'
    ),
    'fn_admin_onboard_tenant_v2', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='admin_onboard_tenant_v2'
    ),
    'fn_get_my_profile', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_my_profile'
    ),
    'fn_get_my_security_state', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_my_security_state'
    ),
    'fn_resolve_login_email', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='resolve_login_email'
    ),
    'fn_must_change_password', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='must_change_password'
    )
  );
end; $$;

revoke all on function public.admin_identity_v2_health() from public;
revoke all on function public.admin_identity_v2_health() from anon;
grant execute on function public.admin_identity_v2_health() to authenticated;

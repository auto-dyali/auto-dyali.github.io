-- GV5 §61 — 002_execute_public_corrections.sql
-- STATUT : PRÉPARÉ — NON EXÉCUTÉ. Nécessite autorisation + sauvegarde/PITR.
-- Objectif : retirer EXECUTE PUBLIC sur 15 fonctions SECURITY DEFINER,
--            accorder EXECUTE uniquement à authenticated (rôle légitime).
-- Prérequis : 0037 (si déjà appliquée, ces commandes sont redondantes mais inoffensives).
-- Attention : ne PAS révoquer sur resolve_login_email (doit rester anon, prévu 0039).

-- === 11 fonctions avec proacl explicite =X/postgres ===
revoke all on function public.admin_change_plan(uuid,text) from public;
grant execute on function public.admin_change_plan(uuid,text) to authenticated;
revoke all on function public.admin_create_establishment(text,text,text,text,text,text) from public;
grant execute on function public.admin_create_establishment(text,text,text,text,text,text) to authenticated;
revoke all on function public.admin_expire_subscription(uuid) from public;
grant execute on function public.admin_expire_subscription(uuid) to authenticated;
revoke all on function public.admin_reactivate_subscription(uuid) from public;
grant execute on function public.admin_reactivate_subscription(uuid) to authenticated;
revoke all on function public.admin_renew_subscription(uuid,integer) from public;
grant execute on function public.admin_renew_subscription(uuid,integer) to authenticated;
revoke all on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) from public;
grant execute on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) to authenticated;
revoke all on function public.admin_set_establishment_status(uuid,boolean) from public;
grant execute on function public.admin_set_establishment_status(uuid,boolean) to authenticated;
revoke all on function public.admin_set_feature(text,text,boolean) from public;
grant execute on function public.admin_set_feature(text,text,boolean) to authenticated;
revoke all on function public.decrement_product_stock(uuid,integer) from public;
grant execute on function public.decrement_product_stock(uuid,integer) to authenticated;
revoke all on function public.my_features() from public;
grant execute on function public.my_features() to authenticated;
revoke all on function public.open_ticket_count(uuid) from public;
grant execute on function public.open_ticket_count(uuid) to authenticated;

-- === 4 fonctions avec proacl NULL (héritent PUBLIC) ===
revoke all on function public.is_saas_admin() from public;
grant execute on function public.is_saas_admin() to authenticated;
revoke all on function public.current_establishment_id() from public;
grant execute on function public.current_establishment_id() to authenticated;
revoke all on function public.autoplus_current_role() from public;
grant execute on function public.autoplus_current_role() to authenticated;
revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

-- NOTE : is_manager() est aussi SECURITY INVOKER sans search_path.
-- Sa correction (003_helper_function_hardening.sql) est séparée.

-- Vérification après application (doit retourner 0 ligne) :
-- select p.proname from pg_proc p, pg_namespace n, aclexplode(p.proacl) a
-- where n.oid=p.pronamespace and n.nspname='public' and p.prosecdef
--   and a.grantee=0 and a.privilege_type='EXECUTE';

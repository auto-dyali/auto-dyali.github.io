-- GV5 §62 — 002_fix_open_ticket_count.sql — CORRECTION P1
-- STATUT : PRÉPARÉ — NON EXÉCUTÉ. Nécessite autorisation + sauvegarde/PITR.
-- Problème (§61) : open_ticket_count(uuid) = SECURITY DEFINER, PUBLIC EXECUTE,
--   aucun garde interne, accepte un establishment_id arbitraire →
--   comptage cross-tenant possible.
-- Analyse appels : AUCUN appel frontend (support calcule les KPI côté client
--   sur des tickets déjà filtrés par RLS). Fonction = "KPI plateforme".
--   Migration 0037 révoque déjà PUBLIC sur cette fonction.
-- Correction : dériver l établissement de auth.uid() via public.profiles.
--   - Manager/employee : establishment_id de SON profil (le paramètre est
--     ignoré si différent → aucune fuite cross-tenant).
--   - saas_admin : peut interroger un établissement arbitraire (exception
--     justifiée : KPI plateforme, rôle administrative, testée plus bas).
--   - anonyme / profil absent : retour 0 (pas de fuite, pas d erreur verbeuse).
--   - paramètre NULL : retourne le comptage du tenant courant.

create or replace function public.open_ticket_count(p_establishment_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role        public.user_role;
  v_own_etab    uuid;
  v_target      uuid;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select role, establishment_id into v_role, v_own_etab
    from public.profiles where id = auth.uid();

  if not found then
    return 0;
  end if;

  if v_role = 'saas_admin' then
    v_target := coalesce(p_establishment_id, v_own_etab);
  else
    v_target := v_own_etab;  -- ignore le paramètre client non autorisé
  end if;

  if v_target is null then
    return 0;
  end if;

  return (
    select count(*)::integer from public.support_tickets
     where establishment_id = v_target
       and status in ('open','in_progress','waiting_reply')
  );
end;
$$;

revoke all on function public.open_ticket_count(uuid) from public;
grant execute on function public.open_ticket_count(uuid) to authenticated;

-- Appels frontend concernés : AUCUN (recherche effectuée : src/ supabase/ scripts/ tests/).
-- Non-régression : aucun appel légitime cassé ; les KPI restent calculés côté client.

-- ROLLBACK (documenté, NON exécuté) :
-- create or replace function public.open_ticket_count(p_establishment_id uuid)
-- returns integer language sql stable security definer set search_path=public as $$
--   select count(*)::integer from public.support_tickets
--    where establishment_id=p_establishment_id
--      and status in ('open','in_progress','waiting_reply'); $$;

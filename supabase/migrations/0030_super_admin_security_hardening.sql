-- =====================================================================
-- AUTO DYALI — 0030 : Sécurité Super Admin (Phase 2 — audit read-only)
-- Objet : durcir l'exécution de suppression de compte client.
--
-- Contexte : `admin_delete_client_account` avait été créée directement
-- dans la base distante (hors migrations versionnées) et n'avait pas de
-- garde `is_saas_admin()` fiable. L'audit read-only avait montré qu'un
-- appel non authentifié atteignait la logique applicative (erreur métier
-- P0001) au lieu d'une erreur d'autorisation.
--
-- Action : recréer la fonction avec garde Super Admin + journalisation
-- audit + retrait des privilèges PUBLIC.
--
-- Sécurité :
--   - aucune donnée métier existante n'est supprimée ici,
--   - l'accès est réservé au rôle `saas_admin` authentifié,
--   - toute suppression est journalisée dans `audit_log`.
-- =====================================================================

create or replace function public.admin_delete_client_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'Profil introuvable.';
  end if;

  delete from public.clients
   where establishment_id = v_profile.establishment_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_profile.establishment_id, auth.uid(), 'delete_client_account', 'profile', p_user_id, jsonb_build_object('source', 'super_admin_dashboard'));

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_client_account(uuid) from public;
grant execute on function public.admin_delete_client_account(uuid) to authenticated;

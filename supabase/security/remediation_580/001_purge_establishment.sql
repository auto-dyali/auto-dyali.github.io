-- AUTO DYALI — GV5 §80 — Suppression définitive contrôlée d'un établissement
-- STAGING uniquement. Réversible : 001_down.sql (suppression de la fonction).
--
-- Garanties :
--  * Super Admin uniquement ;
--  * établissement préalablement ARCHIVÉ (archivage logique conservé) ;
--  * refus si des données métier existent encore (ventes, factures, paiements,
--    commandes, pièces, clients, véhicules, etc.) ;
--  * l'historique d'audit est CONSERVÉ : les entrées sont détachées de
--    l'établissement puis une trace de purge est ajoutée avec un snapshot ;
--  * suppression atomique des données d'accès (profils/Auth, invitations,
--    permissions, abonnements, demandes liées).
-- Aucune table n'est supprimée ou recréée.

create or replace function public.admin_purge_establishment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_etab public.establishments%rowtype;
  v_dependances jsonb;
  v_comptes uuid[];
  v_nb integer := 0;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;

  select * into v_etab from public.establishments where id = p_id;
  if not found then raise exception 'Établissement introuvable.'; end if;
  if v_etab.archived_at is null then
    raise exception 'Archivage obligatoire avant suppression définitive.';
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'sales', (select count(*) from public.sales where establishment_id = p_id),
    'invoices', (select count(*) from public.invoices where establishment_id = p_id),
    'payments', (select count(*) from public.payments where establishment_id = p_id),
    'work_orders', (select count(*) from public.work_orders where establishment_id = p_id),
    'products', (select count(*) from public.products where establishment_id = p_id),
    'clients', (select count(*) from public.clients where establishment_id = p_id),
    'vehicles', (select count(*) from public.vehicles where establishment_id = p_id),
    'purchase_orders', (select count(*) from public.purchase_orders where establishment_id = p_id),
    'cash_sessions', (select count(*) from public.cash_sessions where establishment_id = p_id),
    'expenses', (select count(*) from public.expenses where establishment_id = p_id)
  )) into v_dependances;

  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  into v_dependances
  from jsonb_each_text(v_dependances) as t(k, v)
  where v::integer > 0;

  if v_dependances <> '{}'::jsonb then
    raise exception 'Suppression refusée : données métier présentes (%) — respecter les obligations de conservation.', v_dependances;
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_comptes
  from public.profiles where establishment_id = p_id;

  -- Conservation de l'audit : détachement puis snapshot de la purge.
  update public.audit_log set establishment_id = null where establishment_id = p_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'establishment_purged', 'establishment', p_id,
          jsonb_build_object('snapshot', to_jsonb(v_etab), 'comptes_supprimes', v_comptes,
                             'raison', 'suppression définitive GV5 §80'));

  delete from public.invitation_events where invitation_id in (select id from public.invitations where establishment_id = p_id);
  delete from public.invitations where establishment_id = p_id;
  delete from public.permissions where establishment_id = p_id;
  delete from public.subscriptions where establishment_id = p_id;
  delete from public.saas_billing_events where establishment_id = p_id;
  delete from public.onboarding_requests where establishment_id = p_id;
  delete from public.profiles where establishment_id = p_id;

  -- Comptes Auth correspondants (comptes de test staging uniquement).
  delete from auth.users where id = any(v_comptes);

  delete from public.establishments where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'comptes_supprimes', coalesce(array_length(v_comptes, 1), 0),
                            'audit_conserve', true);
end; $$;

revoke all on function public.admin_purge_establishment(uuid) from public;
revoke all on function public.admin_purge_establishment(uuid) from anon;
grant execute on function public.admin_purge_establishment(uuid) to authenticated;
grant execute on function public.admin_purge_establishment(uuid) to service_role;

-- AUTO DYALI — GV5 §112 — Suppression définitive protégée des abonnés de test.
-- MIGRATION ADDITIVE séparée : les 9 migrations de l'essai ne sont PAS modifiées.
-- PRÉPARÉE — NON APPLIQUÉE (ni staging, ni production).
-- Découverte faite en lecture seule : tables comptables = invoices, payments,
-- cash_sessions, expenses, sales, sale_items, purchase_orders,
-- purchase_order_items, stock_movements, saas_billing_events, subscriptions_audit.

alter table public.establishments
  add column if not exists is_test boolean not null default false,
  add column if not exists is_protected boolean not null default false;

create or replace function public.admin_purge_establishment(
  p_establishment_id uuid,
  p_confirm_name text,
  p_dry_run boolean default true,
  p_tables_comptables text[] default array[
    'invoices','payments','cash_sessions','expenses','sales','sale_items',
    'purchase_orders','purchase_order_items','stock_movements',
    'saas_billing_events','subscriptions_audit'
  ]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_est jsonb;
  v_name text;
  v_tables text[];
  v_counts jsonb := '{}'::jsonb;
  v_users uuid[];
  t text;
  n bigint;
  deleted bigint;
  v_pass int := 0;
  v_progress boolean;
  v_reste jsonb := '{}'::jsonb;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'ACCES_REFUSE';
  end if;

  select to_jsonb(e) into v_est from public.establishments e where e.id = p_establishment_id;
  if v_est is null then raise exception 'ETABLISSEMENT_INTROUVABLE'; end if;
  if coalesce((v_est->>'is_protected')::boolean, false) then
    raise exception 'ETABLISSEMENT_PROTEGE';
  end if;
  if coalesce((v_est->>'is_test')::boolean, false) is not true then
    raise exception 'NON_MARQUE_TEST';
  end if;

  v_name := v_est->>'name';
  if p_confirm_name is distinct from v_name then
    raise exception 'NOM_DE_CONFIRMATION_INCORRECT';
  end if;

  select array_agg(distinct c.table_name::text order by c.table_name::text)
    into v_tables
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema=c.table_schema and tb.table_name=c.table_name
     and tb.table_type='BASE TABLE'
   where c.table_schema='public' and c.column_name='establishment_id'
     and c.table_name not in ('audit_log','establishments');

  foreach t in array coalesce(v_tables, array[]::text[]) loop
    execute format('select count(*) from public.%I where establishment_id = $1', t)
      into n using p_establishment_id;
    if n > 0 then
      v_counts := v_counts || jsonb_build_object(t, n);
      if t = any(coalesce(p_tables_comptables, array[]::text[])) then
        raise exception 'DOCUMENTS_COMPTABLES_PRESENTS: %', t;
      end if;
    end if;
  end loop;

  /* Les profils doivent être supprimés explicitement : leur FK est SET NULL. */
  select coalesce(array_agg(id), array[]::uuid[]) into v_users
    from public.profiles where establishment_id = p_establishment_id;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'lignes', v_counts,
      'comptes_auth', cardinality(v_users),
      'tables_parcourues', coalesce(v_tables, array[]::text[])
    );
  end if;

  loop
    v_pass := v_pass + 1;
    v_progress := false;
    foreach t in array coalesce(v_tables, array[]::text[]) loop
      begin
        execute format('delete from public.%I where establishment_id = $1', t)
          using p_establishment_id;
        get diagnostics deleted = row_count;
        if deleted > 0 then v_progress := true; end if;
      exception when foreign_key_violation then null;
      end;
    end loop;
    exit when not v_progress or v_pass >= 10;
  end loop;

  foreach t in array coalesce(v_tables, array[]::text[]) loop
    execute format('select count(*) from public.%I where establishment_id = $1', t)
      into n using p_establishment_id;
    if n > 0 then v_reste := v_reste || jsonb_build_object(t, n); end if;
  end loop;
  if v_reste <> '{}'::jsonb then
    raise exception 'SUPPRESSION_INCOMPLETE: %', v_reste::text;
  end if;

  delete from public.establishments where id = p_establishment_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    null, auth.uid(), 'purge_establishment', 'establishment', p_establishment_id,
    jsonb_build_object(
      'lignes_supprimees', v_counts,
      'comptes_auth_a_nettoyer', cardinality(v_users),
      'resultat', 'ok', 'date', now()
    )
  );

  return jsonb_build_object(
    'dry_run', false,
    'lignes', v_counts,
    'comptes_auth_a_supprimer', v_users,
    'passes', v_pass
  );
end;
$$;

revoke all on function public.admin_purge_establishment(uuid, text, boolean, text[]) from public, anon;
grant execute on function public.admin_purge_establishment(uuid, text, boolean, text[]) to authenticated;

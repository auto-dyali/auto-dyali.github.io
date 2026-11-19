-- AUTO DYALI — GV5 §79 — Facturation SaaS (STAGING, réversible)
-- Les tables payments/invoices existantes appartiennent au POS (sale_id NOT NULL).
-- On ajoute un journal dédié aux événements du fournisseur SaaS, idempotent par
-- event_id, avec RLS réservée au Super Admin. Aucune donnée existante modifiée.

create table if not exists public.saas_billing_events (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null default 'stripe',
  event_id         text not null unique,
  event_type       text not null,
  establishment_id uuid references public.establishments(id) on delete set null,
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  amount           numeric(14,2),
  currency         text,
  status           text,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists saas_billing_events_est_idx
  on public.saas_billing_events (establishment_id, created_at desc);

alter table public.saas_billing_events enable row level security;

drop policy if exists saas_billing_events_saas_admin on public.saas_billing_events;
create policy saas_billing_events_saas_admin on public.saas_billing_events
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

revoke all on public.saas_billing_events from anon;
grant select on public.saas_billing_events to authenticated;

-- Journalisation de l'enregistrement d'un événement fournisseur.
create or replace function public.admin_record_billing_event(
  p_event_id text,
  p_event_type text,
  p_establishment_id uuid default null,
  p_subscription_id uuid default null,
  p_amount numeric default null,
  p_currency text default null,
  p_status text default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_deja boolean := false;
begin
  if coalesce(public.is_saas_admin(), false) is not true
     and current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Accès refusé.';
  end if;

  select true into v_deja from public.saas_billing_events where event_id = p_event_id;
  if v_deja then
    return jsonb_build_object('ok', true, 'idempotent', true, 'event_id', p_event_id);
  end if;

  insert into public.saas_billing_events
    (event_id, event_type, establishment_id, subscription_id, amount, currency, status, payload)
  values (p_event_id, p_event_type, p_establishment_id, p_subscription_id, p_amount, p_currency, p_status, p_payload)
  returning id into v_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_establishment_id, null, 'billing_event', 'saas_billing_event', v_id,
          jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'status', p_status));

  return jsonb_build_object('ok', true, 'idempotent', false, 'id', v_id);
end; $$;

revoke all on function public.admin_record_billing_event(text,text,uuid,uuid,numeric,text,text,jsonb) from public;
revoke all on function public.admin_record_billing_event(text,text,uuid,uuid,numeric,text,text,jsonb) from anon;
grant execute on function public.admin_record_billing_event(text,text,uuid,uuid,numeric,text,text,jsonb) to authenticated;
grant execute on function public.admin_record_billing_event(text,text,uuid,uuid,numeric,text,text,jsonb) to service_role;

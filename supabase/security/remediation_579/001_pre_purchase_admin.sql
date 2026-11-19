-- AUTO DYALI — GV5 §79 — Traitement Super Admin des demandes de souscription
-- STAGING uniquement. Réversible : 001_down.sql. Aucune donnée supprimée.
--
-- 1. Décision de statut : réservée au Super Admin, transitions validées,
--    événement et audit_log écrits dans la même transaction.
-- 2. Lecture de l'historique : réservée au Super Admin.
-- 3. La soumission publique ne duplique plus son événement lors d'un replay
--    idempotent (le corps et la clé restent inchangés).

-- ---------------------------------------------------------------------------
-- Décision et historisation
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_pre_purchase_status(
  p_request_id uuid,
  p_status text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande public.pre_purchase_requests%rowtype;
  v_ancien text;
  v_autorise boolean := false;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if p_status = 'paiement_confirme' then
    raise exception 'Un paiement ne peut être confirmé que par preuve serveur du fournisseur.';
  end if;

  select * into v_demande from public.pre_purchase_requests where id = p_request_id;
  if not found then raise exception 'Demande introuvable.'; end if;
  v_ancien := v_demande.status;

  v_autorise := case v_ancien
    when 'brouillon' then p_status in ('soumis', 'annule')
    when 'soumis' then p_status in ('en_attente_verification', 'refuse', 'annule')
    when 'en_attente_verification' then p_status in ('en_attente_paiement', 'valide', 'refuse', 'annule')
    when 'en_attente_paiement' then p_status in ('valide', 'refuse', 'annule')
    when 'paiement_confirme' then p_status in ('valide', 'refuse', 'annule')
    when 'valide' then p_status in ('compte_cree', 'annule')
    when 'compte_cree' then p_status in ('invitation_envoyee', 'annule')
    when 'invitation_envoyee' then p_status in ('compte_active', 'annule')
    else false
  end;
  if not v_autorise then
    raise exception 'Transition refusée : % → %.', v_ancien, p_status;
  end if;
  if p_status = 'refuse' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Un motif de refus est obligatoire.';
  end if;

  update public.pre_purchase_requests
  set status = p_status,
      refusal_reason = case when p_status = 'refuse' then btrim(p_reason) else refusal_reason end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  insert into public.pre_purchase_events (request_id, actor_id, event_type, from_status, to_status, payload)
  values (p_request_id, auth.uid(), case when p_status = 'refuse' then 'refusal' else 'status_change' end,
          v_ancien, p_status,
          jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), ''), 'company', v_demande.company_name));

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_demande.establishment_id, auth.uid(), 'set_pre_purchase_status', 'pre_purchase_request', p_request_id,
          jsonb_build_object('request_key', v_demande.request_key, 'avant', v_ancien, 'apres', p_status, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'id', p_request_id, 'avant', v_ancien, 'apres', p_status);
end; $$;

-- Historique en lecture seule pour le Super Admin.
create or replace function public.admin_get_pre_purchase_history(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_resultat jsonb;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'event_type', e.event_type, 'from_status', e.from_status,
    'to_status', e.to_status, 'payload', e.payload, 'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_resultat
  from public.pre_purchase_events e where e.request_id = p_request_id;
  return v_resultat;
end; $$;

-- Événement de soumission unique par replay idempotent.
create or replace function public.submit_pre_purchase_request(
  p_request_key text, p_company_name text, p_legal_name text, p_professional_id text,
  p_sector text, p_business_type text, p_address text, p_city text, p_phone text,
  p_email text, p_manager_name text, p_plan_code text, p_period text,
  p_desired_users integer, p_desired_sites integer, p_desired_modules jsonb default '[]'::jsonb,
  p_accept_terms boolean default false, p_accept_privacy boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_request_key, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_plan text := lower(trim(coalesce(p_plan_code, '')));
  v_period text := lower(trim(coalesce(p_period, '')));
  v_amount numeric(10,2);
  v_id uuid;
begin
  if v_key = '' or length(v_key) > 120 then raise exception 'Clé de demande invalide.'; end if;
  if not (p_accept_terms and p_accept_privacy) then raise exception 'Consentements obligatoires non acceptés.'; end if;
  if nullif(btrim(coalesce(p_company_name, '')), '') is null or nullif(btrim(coalesce(p_legal_name, '')), '') is null then
    raise exception 'Entreprise/raison sociale obligatoire.';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'E-mail invalide.'; end if;
  if v_plan not in ('standard', 'silver', 'gold') then raise exception 'Forfait invalide.'; end if;
  if v_period not in ('mensuel', 'annuel') then raise exception 'Période invalide.'; end if;
  if p_desired_users is null or p_desired_users < 1 or p_desired_users > 500 then raise exception 'Nombre d’utilisateurs invalide.'; end if;
  if p_desired_sites is null or p_desired_sites < 1 or p_desired_sites > 100 then raise exception 'Nombre d’établissements invalide.'; end if;

  select case when v_period = 'annuel' then p.price_yearly else p.price_monthly end
  into v_amount from public.plans p
  where p.code = v_plan and (p.is_active is distinct from false);

  insert into public.pre_purchase_requests (
    request_key, status, company_name, legal_name, professional_id, sector, business_type,
    address, city, phone, email, manager_name, plan_code, period, desired_users, desired_sites,
    desired_modules, configured_amount, currency, terms_accepted_at, privacy_accepted_at,
    submitted_at, created_at, updated_at
  ) values (
    v_key, 'soumis', btrim(p_company_name), btrim(p_legal_name),
    nullif(btrim(coalesce(p_professional_id, '')), ''),
    btrim(coalesce(p_sector, '')), btrim(coalesce(p_business_type, '')),
    btrim(coalesce(p_address, '')), btrim(coalesce(p_city, '')), btrim(coalesce(p_phone, '')),
    v_email, btrim(coalesce(p_manager_name, '')), v_plan, v_period,
    p_desired_users, p_desired_sites, coalesce(p_desired_modules, '[]'::jsonb),
    v_amount, 'MAD', now(), now(), now(), now(), now()
  )
  on conflict (request_key) do update set updated_at = now()
  returning id into v_id;

  insert into public.pre_purchase_events (request_id, actor_id, event_type, from_status, to_status, payload)
  select v_id, null, 'submission', null, 'soumis',
         jsonb_build_object('request_key', v_key, 'plan', v_plan, 'period', v_period)
  where not exists (
    select 1 from public.pre_purchase_events e
    where e.request_id = v_id and e.event_type = 'submission'
  );

  return jsonb_build_object('id', v_id, 'status', 'soumis', 'request_key', v_key);
end; $$;

-- Privilèges : aucun accès anon aux RPC d'administration ; soumission publique conservée.
revoke all on function public.admin_set_pre_purchase_status(uuid, text, text) from public;
revoke all on function public.admin_get_pre_purchase_history(uuid) from public;
revoke all on function public.admin_set_pre_purchase_status(uuid, text, text) from anon;
revoke all on function public.admin_get_pre_purchase_history(uuid) from anon;
grant execute on function public.admin_set_pre_purchase_status(uuid, text, text) to authenticated;
grant execute on function public.admin_get_pre_purchase_history(uuid) to authenticated;
revoke all on function public.submit_pre_purchase_request(text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb,boolean,boolean) from public;
grant execute on function public.submit_pre_purchase_request(text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb,boolean,boolean) to anon, authenticated;

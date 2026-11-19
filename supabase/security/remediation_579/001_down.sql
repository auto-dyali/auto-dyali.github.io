-- ROLLBACK GV5 §79 / 001 — restaure les fonctions antérieures sans toucher aux données.
-- La table et les événements existants sont conservés.

drop function if exists public.admin_set_pre_purchase_status(uuid, text, text);
drop function if exists public.admin_get_pre_purchase_history(uuid);

create or replace function public.submit_pre_purchase_request(
  p_request_key text, p_company_name text, p_legal_name text, p_professional_id text,
  p_sector text, p_business_type text, p_address text, p_city text, p_phone text,
  p_email text, p_manager_name text, p_plan_code text, p_period text,
  p_desired_users integer, p_desired_sites integer, p_desired_modules jsonb default '[]'::jsonb,
  p_accept_terms boolean default false, p_accept_privacy boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_request_key,''));
  v_email text := lower(trim(coalesce(p_email,'')));
  v_plan text := lower(trim(coalesce(p_plan_code,'')));
  v_period text := lower(trim(coalesce(p_period,'')));
  v_amount numeric(10,2); v_id uuid;
begin
  if v_key = '' or length(v_key) > 120 then raise exception 'Clé de demande invalide.'; end if;
  if not (p_accept_terms and p_accept_privacy) then raise exception 'Consentements obligatoires non acceptés.'; end if;
  if trim(coalesce(p_company_name,'')) = '' or trim(coalesce(p_legal_name,'')) = '' then raise exception 'Entreprise/raison sociale obligatoire.'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'E-mail invalide.'; end if;
  if v_plan not in ('standard','silver','gold') then raise exception 'Forfait invalide.'; end if;
  if v_period not in ('mensuel','annuel') then raise exception 'Période invalide.'; end if;
  if p_desired_users is null or p_desired_users < 1 or p_desired_users > 500 then raise exception 'Nombre d’utilisateurs invalide.'; end if;
  if p_desired_sites is null or p_desired_sites < 1 or p_desired_sites > 100 then raise exception 'Nombre d’établissements invalide.'; end if;
  select case when v_period='annuel' then p.price_yearly else p.price_monthly end into v_amount
    from public.plans p where p.code = v_plan and (p.is_active is distinct from false);
  insert into public.pre_purchase_requests (
    request_key,status,company_name,legal_name,professional_id,sector,business_type,address,city,phone,
    email,manager_name,plan_code,period,desired_users,desired_sites,desired_modules,configured_amount,
    currency,terms_accepted_at,privacy_accepted_at,submitted_at,created_at,updated_at
  ) values (
    v_key,'soumis',trim(p_company_name),trim(p_legal_name),nullif(trim(coalesce(p_professional_id,'')),''),
    trim(coalesce(p_sector,'')),trim(coalesce(p_business_type,'')),trim(coalesce(p_address,'')),
    trim(coalesce(p_city,'')),trim(coalesce(p_phone,'')),v_email,trim(coalesce(p_manager_name,'')),
    v_plan,v_period,p_desired_users,p_desired_sites,coalesce(p_desired_modules,'[]'::jsonb),
    v_amount,'MAD',now(),now(),now(),now(),now()
  ) on conflict (request_key) do update set updated_at = now() returning id into v_id;
  insert into public.pre_purchase_events (request_id,actor_id,event_type,from_status,to_status,payload)
  values (v_id,null,'submission',null,'soumis',jsonb_build_object('request_key',v_key,'plan',v_plan,'period',v_period));
  return jsonb_build_object('id',v_id,'status','soumis','request_key',v_key);
end; $$;

revoke all on function public.submit_pre_purchase_request(text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb,boolean,boolean) from public;
grant execute on function public.submit_pre_purchase_request(text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb,boolean,boolean) to anon, authenticated;

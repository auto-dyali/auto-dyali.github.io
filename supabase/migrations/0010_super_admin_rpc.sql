-- AUTO DYALI — 0010 : RPC et policies Super Admin (pilotage de la plateforme)
-- Toute action sensible est journalisée dans audit_log.
-- Contrôle : chaque RPC vérifie is_saas_admin() (security definer).

-- ---------------------------------------------------------------------
-- 1. POLICIES : création d'établissement + journal d'audit
-- ---------------------------------------------------------------------
drop policy if exists saas_admin_insert_establishments on public.establishments;
create policy saas_admin_insert_establishments
  on public.establishments for insert
  with check (public.is_saas_admin());

drop policy if exists saas_admin_all_audit_log on public.audit_log;
create policy saas_admin_all_audit_log
  on public.audit_log for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

drop policy if exists managers_insert_audit_log on public.audit_log;
create policy managers_insert_audit_log
  on public.audit_log for insert
  with check (public.is_saas_admin() or public.is_manager());

drop policy if exists tenant_select_audit_log on public.audit_log;
create policy tenant_select_audit_log
  on public.audit_log for select
  using (
    establishment_id = public.current_establishment_id()
    or public.is_saas_admin()
  );

grant select, insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 2. Création d'un nouvel établissement (+ abonnement standard)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_establishment(
  p_name text,
  p_slug text,
  p_city text default null,
  p_phone text default null,
  p_email text default null,
  p_plan text default 'standard'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom de l’établissement est obligatoire.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : % (attendu standard|silver|gold)', p_plan;
  end if;

  insert into public.establishments (name, slug, city, phone, email, plan, is_active)
  values (trim(p_name), trim(p_slug), p_city, p_phone, p_email, p_plan, true)
  returning id into v_id;

  insert into public.subscriptions (establishment_id, plan_code, status, trial_ends_at, current_period_end)
  values (v_id, p_plan, 'trial', now() + interval '14 days', now() + interval '14 days');

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'create', 'establishment', v_id,
          jsonb_build_object('name', p_name, 'plan', p_plan, 'slug', p_slug));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Changement de forfait (upgrade / downgrade) — journalisé
-- ---------------------------------------------------------------------
create or replace function public.admin_change_plan(
  p_establishment_id uuid,
  p_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : %', p_plan;
  end if;

  select plan into v_ancien from public.establishments where id = p_establishment_id;
  if v_ancien is null then
    raise exception 'Établissement introuvable.';
  end if;

  update public.establishments
     set plan = p_plan, updated_at = now()
   where id = p_establishment_id;

  update public.subscriptions
     set plan_code = p_plan, status = 'active'
   where establishment_id = p_establishment_id
     and status in ('active','trial','past_due');

  -- Si aucun abonnement ouvert : en ouvrir un.
  if not exists (
    select 1 from public.subscriptions
     where establishment_id = p_establishment_id and status in ('active','trial','past_due')
  ) then
    insert into public.subscriptions (establishment_id, plan_code, status, current_period_end)
    values (p_establishment_id, p_plan, 'active', now() + interval '1 year');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'change_plan', 'establishment', p_establishment_id,
          jsonb_build_object('ancien', v_ancien, 'nouveau', p_plan));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Activer / suspendre un établissement — journalisé
-- NB : la suspension ne supprime JAMAIS les données.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_establishment_status(
  p_establishment_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.establishments
     set is_active = p_active,
         suspended_at = case when p_active then null else now() end,
         updated_at = now()
   where id = p_establishment_id;
  if not found then
    raise exception 'Établissement introuvable.';
  end if;

  update public.subscriptions
     set status = case when p_active then 'active' else 'suspended' end
   where establishment_id = p_establishment_id
     and status in ('active','trial','past_due','suspended');

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), case when p_active then 'activate' else 'suspend' end,
          'establishment', p_establishment_id,
          jsonb_build_object('is_active', p_active));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Configuration commerciale des forfaits (prix, essai, limites)
--    Les prix restent NULL tant que le Super Admin ne les fixe pas.
-- ---------------------------------------------------------------------
create or replace function public.admin_save_plan(
  p_code text,
  p_price_monthly numeric,
  p_price_yearly numeric,
  p_trial_days integer,
  p_max_users integer,
  p_max_sites integer,
  p_storage_mb integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.plans
     set price_monthly = p_price_monthly,
         price_yearly = p_price_yearly,
         trial_days = p_trial_days,
         max_users = p_max_users,
         max_sites = p_max_sites,
         storage_mb = p_storage_mb,
         updated_at = now()
   where code = p_code;
  if not found then
    raise exception 'Forfait inconnu : %', p_code;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'save_plan', 'plan', null,
          jsonb_build_object('code', p_code,
                             'price_monthly', p_price_monthly,
                             'price_yearly', p_price_yearly));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Activation / désactivation d'une fonctionnalité dans un forfait
-- ---------------------------------------------------------------------
create or replace function public.admin_set_feature(
  p_plan_code text,
  p_feature text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  update public.plan_features
     set enabled = p_enabled
   where plan_code = p_plan_code and feature_key = p_feature;
  if not found then
    raise exception 'Fonctionnalité % inconnue pour le forfait %', p_feature, p_plan_code;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'set_feature', 'plan_feature', null,
          jsonb_build_object('plan', p_plan_code, 'feature', p_feature, 'enabled', p_enabled));
end;
$$;

grant execute on function public.admin_create_establishment(text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_change_plan(uuid,text) to authenticated;
grant execute on function public.admin_set_establishment_status(uuid,boolean) to authenticated;
grant execute on function public.admin_save_plan(text,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function public.admin_set_feature(text,text,boolean) to authenticated;

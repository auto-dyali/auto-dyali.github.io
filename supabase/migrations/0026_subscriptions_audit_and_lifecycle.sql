-- AUTO DYALI — 0026 : Historique des abonnements et RPC de cycle de vie
-- Complète la migration 0009 (tables plans, plan_features, subscriptions)
-- avec :
--   - table subscriptions_audit (historique des changements d'abonnement)
--   - RPC admin_renew_subscription() (renouvellement)
--   - RPC admin_reactivate_subscription() (réactivation après expiration)
--   - RPC admin_expire_subscription() (expiration forcée)
--   - RLS policies pour les nouvelles tables
--
-- Ne pas exécuter sur Supabase distant sans autorisation.

-- ---------------------------------------------------------------------
-- 1. TABLE D'HISTORIQUE DES ABONNEMENTS
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions_audit (
  id               uuid primary key default uuid_generate_v4(),
  subscription_id  uuid not null references public.subscriptions(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  actor_id         uuid references auth.users(id),
  action           text not null check (action in ('create','change_plan','renew','suspend','reactivate','expire','cancel')),
  ancien_plan      text,
  nouveau_plan     text,
  ancien_statut    text,
  nouveau_statut   text,
  ancien_heure_essai timestamptz,
  nouveau_heure_essai timestamptz,
  ancien_fin_periode timestamptz,
  nouveau_fin_periode timestamptz,
  payload_json     jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

comment on table public.subscriptions_audit is
  'Historique complet des changements dabonnement. Qui a modifie quoi et quand.';

create index if not exists subscriptions_audit_subscription_idx
  on public.subscriptions_audit(subscription_id);
create index if not exists subscriptions_audit_establishment_idx
  on public.subscriptions_audit(establishment_id);
create index if not exists subscriptions_audit_created_at_idx
  on public.subscriptions_audit(created_at);

-- ---------------------------------------------------------------------
-- 2. DROITS RLS sur subscriptions_audit
-- ---------------------------------------------------------------------
alter table public.subscriptions_audit enable row level security;

drop policy if exists subscriptions_audit_saas_admin on public.subscriptions_audit;
create policy subscriptions_audit_saas_admin on public.subscriptions_audit for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists subscriptions_audit_tenant on public.subscriptions_audit;
create policy subscriptions_audit_tenant on public.subscriptions_audit for select
  using (establishment_id = public.current_establishment_id() or public.is_saas_admin());

grant select on public.subscriptions_audit to authenticated;
grant all on public.subscriptions_audit to service_role;

-- ---------------------------------------------------------------------
-- 3. RPC : admin_renew_subscription()
-- Renouvellement dun abonnement actif ou expiré.
-- Met à jour current_period_end et réactive si nécessaire.
-- ---------------------------------------------------------------------
create or replace function public.admin_renew_subscription(
  p_establishment_id uuid,
  p_months integer default 12
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_ancien_plan   text;
  v_ancien_fin    timestamptz;
  v_nouveau_fin   timestamptz;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  if p_months <= 0 then
    raise exception 'La durée de renouvellement doit être positive.';
  end if;

  -- Récupération de l abonnement courant
  select s.id, s.status, s.plan_code, s.current_period_end
    into v_sub_id, v_ancien_statut, v_ancien_plan, v_ancien_fin
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('active','trial','past_due','suspended','expired')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement trouvable pour cet établissement.';
  end if;

  -- Calcul de la nouvelle date de fin
  if v_ancien_fin is not null and v_ancien_fin > now() then
    v_nouveau_fin := v_ancien_fin + (p_months || ' months')::interval;
  else
    v_nouveau_fin := now() + (p_months || ' months')::interval;
  end if;

  -- Mise à jour de l abonnement
  update public.subscriptions
     set status = 'active',
         current_period_end = v_nouveau_fin,
         updated_at = now()
   where id = v_sub_id;

  -- Mise à jour de l établissement
  update public.establishments
     set plan = v_ancien_plan,
         updated_at = now()
   where id = p_establishment_id;

  -- Journal dans subscriptions_audit
  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    ancien_fin_periode, nouveau_fin_periode,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'renew',
    v_ancien_plan, v_ancien_plan, v_ancien_statut, 'active',
    v_ancien_fin, v_nouveau_fin,
    jsonb_build_object('months', p_months)
  );

  -- Journal dans audit_log
  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'renew', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'active', 'duree_mois', p_months));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC : admin_reactivate_subscription()
-- Réactive un abonnement suspendu ou expiré.
-- ---------------------------------------------------------------------
create or replace function public.admin_reactivate_subscription(
  p_establishment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_ancien_plan   text;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select s.id, s.status, s.plan_code
    into v_sub_id, v_ancien_statut, v_ancien_plan
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('suspended','expired','cancelled')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement suspendu ou expiré trouvable pour cet établissement.';
  end if;

  update public.subscriptions
     set status = 'active',
         updated_at = now()
   where id = v_sub_id;

  update public.establishments
     set plan = v_ancien_plan,
         is_active = true,
         suspended_at = null,
         updated_at = now()
   where id = p_establishment_id;

  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'reactivate',
    v_ancien_plan, v_ancien_plan, v_ancien_statut, 'active',
    jsonb_build_object('raison', 'réactivation manuelle par le Super Admin')
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'reactivate', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'active'));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC : admin_expire_subscription()
-- Marque un abonnement comme expiré (sans supprimer les données).
-- ---------------------------------------------------------------------
create or replace function public.admin_expire_subscription(
  p_establishment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien_statut text;
  v_sub_id        uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select s.id, s.status
    into v_sub_id, v_ancien_statut
    from public.subscriptions s
   where s.establishment_id = p_establishment_id
     and s.status in ('active','trial','past_due')
   order by s.started_at desc
   limit 1;

  if not found then
    raise exception 'Aucun abonnement actif trouvable pour cet établissement.';
  end if;

  update public.subscriptions
     set status = 'expired',
         updated_at = now()
   where id = v_sub_id;

  update public.establishments
     set is_active = false,
         suspended_at = now(),
         updated_at = now()
   where id = p_establishment_id;

  insert into public.subscriptions_audit (
    subscription_id, establishment_id, actor_id, action,
    ancien_plan, nouveau_plan, ancien_statut, nouveau_statut,
    payload_json
  ) values (
    v_sub_id, p_establishment_id, auth.uid(), 'expire',
    (select plan_code from public.subscriptions where id = v_sub_id),
    (select plan_code from public.subscriptions where id = v_sub_id),
    v_ancien_statut, 'expired',
    jsonb_build_object('raison', 'expiration manuelle par le Super Admin')
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, payload_json)
  values (auth.uid(), 'expire', 'subscription', p_establishment_id,
          jsonb_build_object('ancien_statut', v_ancien_statut, 'nouveau_statut', 'expired'));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. PERMISSIONS
-- ---------------------------------------------------------------------
grant execute on function public.admin_renew_subscription(uuid,integer) to authenticated;
grant execute on function public.admin_reactivate_subscription(uuid) to authenticated;
grant execute on function public.admin_expire_subscription(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- NOTE : Aucun prix, durée dessai ou règle commerciale nest imposé ici.
-- Le Super Admin configure les prix via admin_save_plan() et les dates
-- via les RPC ci-dessus. Les règles commerciales (durée dessai, tarif,
-- renouvellement automatique) doivent être décidées par le propriétaire.

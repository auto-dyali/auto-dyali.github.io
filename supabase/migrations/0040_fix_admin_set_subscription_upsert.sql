-- =====================================================================
-- AUTO DYALI — 0040 (GV5 §86) : admin_set_subscription en UPSERT
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Objet :
--   Remplacer le comportement UPDATE-pur de public.admin_set_subscription
--   par un UPSERT (INSERT si aucun abonnement n'existe pour
--   l'établissement, UPDATE sinon). Ceci permet la création initiale
--   d'un abonnement sans nécessiter un abonnement préalable.
--
-- DÉPENDANCES : table public.subscriptions (migration 0009 ou antérieure).
--               La fonction doit déjà exister (créée par remediation_075).
--               À appliquer APRÈS 0039 (qui crée admin_onboard_tenant_v2
--               et les tables/colonnes d'identité).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôle : la fonction doit exister
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_set_subscription'
  ) then
    raise exception 'ARRÊT 0040: fonction admin_set_subscription absente (remediation_075).';
  end if;
  raise notice '0040 pré-contrôle OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. admin_set_subscription : INSERT si absent, UPDATE sinon (UPSERT)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_subscription(
  p_establishment_id uuid,
  p_plan text,
  p_paid_months integer,
  p_trial_days integer,
  p_start_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debut date;
  v_fin_payee date;
  v_fin_essai date;
  v_ancien jsonb;
  v_sub_id uuid;
  v_existe integer;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if p_plan not in ('standard', 'silver', 'gold') then raise exception 'Forfait inconnu : %', p_plan; end if;
  if p_paid_months is null or p_paid_months < 1 or p_paid_months > 120 then raise exception 'Durée payante invalide (1 à 120 mois).'; end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then raise exception 'Durée d''essai invalide (0 à 365 jours).'; end if;

  -- Récupération de l'ancien abonnement (pour l'audit et la date de début par défaut)
  select to_jsonb(s) into v_ancien from public.subscriptions s where s.establishment_id = p_establishment_id limit 1;

  v_debut := coalesce(p_start_date, (v_ancien->>'started_at')::date, current_date);
  v_fin_payee := (v_debut + (p_paid_months || ' months')::interval)::date;
  v_fin_essai := case when p_trial_days > 0 then v_debut + p_trial_days else null end;

  -- Mise à jour de l'établissement
  update public.establishments set plan = p_plan, trial_ends_at = v_fin_essai, updated_at = now()
  where id = p_establishment_id;

  -- Déterminer si un abonnement existe déjà
  select count(*) into v_existe from public.subscriptions where establishment_id = p_establishment_id;

  if v_existe = 0 then
    -- Création initiale de l'abonnement
    insert into public.subscriptions (
      establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end
    ) values (
      p_establishment_id,
      p_plan,
      case when p_trial_days > 0 then 'trial' else 'active' end,
      v_debut,
      v_fin_essai,
      v_fin_payee
    )
    returning id into v_sub_id;

    insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
    values (
      p_establishment_id, auth.uid(), 'set_subscription_create', 'subscription', v_sub_id,
      jsonb_build_object(
        'plan', p_plan, 'paid_months', p_paid_months, 'trial_days', p_trial_days,
        'debut', v_debut, 'fin_payee', v_fin_payee, 'fin_essai', v_fin_essai
      )
    );
  else
    -- Mise à jour de l'abonnement existant
    update public.subscriptions set
      plan_code = p_plan,
      started_at = v_debut,
      trial_ends_at = v_fin_essai,
      current_period_end = v_fin_payee,
      status = case when status in ('suspended','cancelled','expired') then status else
                    case when p_trial_days > 0 and now() < v_fin_essai then 'trial' else 'active' end end
    where establishment_id = p_establishment_id;

    select id into v_sub_id from public.subscriptions where establishment_id = p_establishment_id order by updated_at desc limit 1;

    insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
    values (
      p_establishment_id, auth.uid(), 'set_subscription_update', 'subscription', v_sub_id,
      jsonb_build_object(
        'avant', v_ancien, 'plan', p_plan, 'paid_months', p_paid_months,
        'trial_days', p_trial_days, 'debut', v_debut, 'fin_payee', v_fin_payee, 'fin_essai', v_fin_essai
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'started_at', v_debut, 'trial_ends_at', v_fin_essai,
                            'current_period_end', v_fin_payee, 'plan', p_plan);
end; $$;

revoke all on function public.admin_set_subscription(uuid, text, integer, integer, date) from public;
grant execute on function public.admin_set_subscription(uuid, text, integer, integer, date) to authenticated;

comment on function public.admin_set_subscription(uuid, text, integer, integer, date) is
  'Configure ou crée l abonnement d un établissement (UPSERT). Essai indépendant de la durée payante.';

-- FIN 0040

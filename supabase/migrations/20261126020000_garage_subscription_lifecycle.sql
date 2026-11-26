-- AUTO DYALI — GV5 §110 — Cycle de vie garages/abonnements (ADDITIF).
-- PRÉPARÉE — NON APPLIQUÉE (ni staging, ni production).
-- Aucune des 9 migrations n'est modifiée. Aucune donnée existante supprimée.
-- Toutes les opérations sont réservées au Super Admin global (is_saas_admin).

alter table public.establishments
  add column if not exists gv5_archived_at timestamptz,
  add column if not exists gv5_archive_reason text,
  add column if not exists gv5_suspend_reason text,
  add column if not exists gv5_deleted_at timestamptz,
  add column if not exists gv5_delete_reason text;

alter table public.subscriptions
  add column if not exists gv5_archived_at timestamptz,
  add column if not exists gv5_archive_reason text,
  add column if not exists gv5_status_reason text,
  add column if not exists gv5_updated_at timestamptz not null default now();

create index if not exists establishments_gv5_archived_at_idx
  on public.establishments (gv5_archived_at);
create index if not exists subscriptions_gv5_archived_at_idx
  on public.subscriptions (gv5_archived_at);

/* ------------------------------------------------------------------ */
/* Journal d'audit central (une ligne par opération sensible).         */
/* ------------------------------------------------------------------ */
create or replace function public.admin_log_lifecycle(
  p_establishment_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_old jsonb,
  p_new jsonb,
  p_reason text,
  p_resultat text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    p_establishment_id, auth.uid(), p_action, p_entity, p_entity_id,
    jsonb_build_object(
      'ancien_etat', p_old, 'nouvel_etat', p_new,
      'motif', p_reason, 'resultat', p_resultat,
      'date', now()
    )
  );
end;
$$;

/* ------------------------------------------------------------------ */
/* GARAGE — suspension / réactivation                                  */
/* ------------------------------------------------------------------ */
create or replace function public.admin_set_establishment_status_v2(
  p_establishment_id uuid,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_old jsonb; v_new jsonb; v_etab public.establishments%rowtype;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  select * into v_etab from public.establishments where id = p_establishment_id;
  if not found then raise exception 'Établissement introuvable.'; end if;
  if v_etab.gv5_deleted_at is not null then raise exception 'Établissement supprimé logiquement.'; end if;

  if not p_active and length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif de suspension obligatoire (5 caractères minimum).';
  end if;
  if p_active and v_etab.gv5_archived_at is not null then
    raise exception 'Restaurer l''établissement avant de le réactiver.';
  end if;
  if v_etab.is_active is distinct from p_active then
    v_old := jsonb_build_object('is_active', v_etab.is_active, 'suspended_at', v_etab.suspended_at);
    update public.establishments
       set is_active = p_active,
           suspended_at = case when p_active then null else now() end,
           gv5_suspend_reason = case when p_active then null else trim(p_reason) end,
           updated_at = now()
     where id = p_establishment_id;
    /* Invalidation des accès : les profils du garage sont désactivés. */
    update public.profiles set is_active = p_active
     where establishment_id = p_establishment_id and role <> 'saas_admin';
    v_new := jsonb_build_object('is_active', p_active, 'suspended_at', case when p_active then null else now() end);
    perform public.admin_log_lifecycle(
      p_establishment_id, 'establishment', p_establishment_id,
      case when p_active then 'establishment_reactivate' else 'establishment_suspend' end,
      v_old, v_new, p_reason, 'ok');
  end if;
  return jsonb_build_object('ok', true, 'establishment_id', p_establishment_id, 'is_active', p_active);
end;
$$;

/* ------------------------------------------------------------------ */
/* GARAGE — archivage / restauration                                   */
/* ------------------------------------------------------------------ */
create or replace function public.admin_archive_establishment_v2(
  p_id uuid,
  p_archive boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_etab public.establishments%rowtype; v_old jsonb; v_new jsonb;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  select * into v_etab from public.establishments where id = p_id;
  if not found then raise exception 'Établissement introuvable.'; end if;
  if p_archive and length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif d''archivage obligatoire (5 caractères minimum).';
  end if;
  if p_archive and v_etab.gv5_archived_at is not null then
    return jsonb_build_object('ok', true, 'idempotent', true, 'archived', true);
  end if;
  if not p_archive and v_etab.gv5_archived_at is null then
    return jsonb_build_object('ok', true, 'idempotent', true, 'archived', false);
  end if;

  v_old := jsonb_build_object('archived_at', v_etab.gv5_archived_at, 'is_active', v_etab.is_active);
  update public.establishments
     set gv5_archived_at = case when p_archive then now() else null end,
         gv5_archive_reason = case when p_archive then trim(p_reason) else null end,
         is_active = case when p_archive then false else v_etab.is_active end,
         updated_at = now()
   where id = p_id;
  if p_archive then
    update public.profiles set is_active = false
     where establishment_id = p_id and role <> 'saas_admin';
  end if;
  v_new := jsonb_build_object('archived_at', case when p_archive then now() else null end,
                             'is_active', case when p_archive then false else v_etab.is_active end);
  perform public.admin_log_lifecycle(
    p_id, 'establishment', p_id,
    case when p_archive then 'establishment_archive' else 'establishment_restore' end,
    v_old, v_new, p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'archived', p_archive);
end;
$$;

/* ------------------------------------------------------------------ */
/* GARAGE — suppression LOGIQUE protégée (jamais physique implicite)   */
/* ------------------------------------------------------------------ */
create or replace function public.admin_soft_delete_establishment(
  p_id uuid,
  p_reason text,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_etab public.establishments%rowtype; v_actifs integer;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if coalesce(trim(p_confirmation), '') <> 'SUPPRIMER' then
    raise exception 'Confirmation renforcée requise (SUPPRIMER).';
  end if;
  if length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif de suppression obligatoire (5 caractères minimum).';
  end if;
  select * into v_etab from public.establishments where id = p_id;
  if not found then raise exception 'Établissement introuvable.'; end if;
  if v_etab.gv5_deleted_at is not null then
    return jsonb_build_object('ok', true, 'idempotent', true, 'mode', 'logique');
  end if;
  if v_etab.gv5_archived_at is null then
    raise exception 'Archiver l''établissement avant toute suppression.';
  end if;
  select count(*)::int into v_actifs from public.subscriptions
   where establishment_id = p_id and status in ('trial','active','past_due','suspended');
  if v_actifs > 0 then
    raise exception 'Suppression refusée : abonnement(s) non clôturé(s).';
  end if;

  update public.establishments
     set gv5_deleted_at = now(), gv5_delete_reason = trim(p_reason),
         is_active = false, updated_at = now()
   where id = p_id;
  update public.profiles set is_active = false
   where establishment_id = p_id and role <> 'saas_admin';
  perform public.admin_log_lifecycle(
    p_id, 'establishment', p_id, 'establishment_soft_delete',
    jsonb_build_object('deleted_at', null),
    jsonb_build_object('deleted_at', now(), 'motif', trim(p_reason)),
    p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'mode', 'logique',
                            'message', 'Suppression logique : données, audit et historique conservés.');
end;
$$;

/* ------------------------------------------------------------------ */
/* ABONNEMENT — statuts, dates, renouvellement, archivage              */
/* ------------------------------------------------------------------ */
create or replace function public.admin_set_subscription_status(
  p_subscription_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub public.subscriptions%rowtype; v_old text; v_autorise boolean;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if p_status not in ('trial','active','past_due','suspended','expired','cancelled') then
    raise exception 'Statut d''abonnement inconnu.';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'Abonnement introuvable.'; end if;
  if v_sub.gv5_archived_at is not null then raise exception 'Abonnement archivé : restauration requise.'; end if;
  if v_sub.status = p_status then
    return jsonb_build_object('ok', true, 'idempotent', true, 'status', p_status);
  end if;

  v_autorise := case
    when v_sub.status in ('trial','active') and p_status in ('active','past_due','suspended','expired','cancelled') then true
    when v_sub.status = 'past_due' and p_status in ('active','suspended','expired','cancelled') then true
    when v_sub.status = 'suspended' and p_status in ('active','expired','cancelled') then true
    else false end;
  if not coalesce(v_autorise, false) then
    raise exception 'Transition interdite : % -> %.', v_sub.status, p_status;
  end if;
  if p_status <> 'active' and length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif obligatoire pour ce changement de statut.';
  end if;

  v_old := v_sub.status;
  update public.subscriptions
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         gv5_status_reason = nullif(trim(coalesce(p_reason, '')), ''),
         gv5_updated_at = now()
   where id = p_subscription_id;
  perform public.admin_log_lifecycle(
    v_sub.establishment_id, 'subscription', p_subscription_id,
    'subscription_status_change',
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status),
    p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'status', p_status);
end;
$$;

create or replace function public.admin_update_subscription(
  p_subscription_id uuid,
  p_plan text default null,
  p_start_date timestamptz default null,
  p_current_period_end timestamptz default null,
  p_trial_end timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub public.subscriptions%rowtype; v_old jsonb; v_new jsonb; v_fin timestamptz;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif de modification obligatoire (5 caractères minimum).';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'Abonnement introuvable.'; end if;
  if v_sub.gv5_archived_at is not null then raise exception 'Abonnement archivé : restauration requise.'; end if;
  if p_plan is not null and not exists (select 1 from public.plans where code = p_plan) then
    raise exception 'Forfait inconnu.';
  end if;
  v_fin := coalesce(p_current_period_end, v_sub.current_period_end);
  if p_start_date is not null and v_fin is not null and v_fin <= p_start_date then
    raise exception 'La date de fin doit être postérieure au début.';
  end if;

  v_old := jsonb_build_object('plan_code', v_sub.plan_code, 'started_at', v_sub.started_at,
                             'current_period_end', v_sub.current_period_end, 'trial_ends_at', v_sub.trial_ends_at);
  update public.subscriptions
     set plan_code = coalesce(p_plan, plan_code),
         started_at = coalesce(p_start_date, started_at),
         current_period_end = coalesce(p_current_period_end, current_period_end),
         trial_ends_at = case when p_trial_end is not null then p_trial_end else trial_ends_at end,
         gv5_status_reason = trim(p_reason), gv5_updated_at = now()
   where id = p_subscription_id;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  v_new := jsonb_build_object('plan_code', v_sub.plan_code, 'started_at', v_sub.started_at,
                             'current_period_end', v_sub.current_period_end, 'trial_ends_at', v_sub.trial_ends_at);
  perform public.admin_log_lifecycle(
    v_sub.establishment_id, 'subscription', p_subscription_id,
    'subscription_update', v_old, v_new, p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'abonnement', v_new);
end;
$$;

create or replace function public.admin_renew_subscription_v2(
  p_establishment_id uuid,
  p_months integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub public.subscriptions%rowtype; v_old jsonb; v_new timestamptz;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if p_months is null or p_months < 1 or p_months > 120 then
    raise exception 'Durée de renouvellement invalide (1 à 120 mois).';
  end if;
  if length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif de renouvellement obligatoire.';
  end if;
  select * into v_sub from public.subscriptions
   where establishment_id = p_establishment_id and gv5_archived_at is null
   order by created_at desc limit 1 for update;
  if not found then raise exception 'Abonnement introuvable.'; end if;
  if v_sub.status in ('cancelled','expired') then
    raise exception 'Renouvellement interdit sur un abonnement clôturé.';
  end if;

  v_old := jsonb_build_object('current_period_end', v_sub.current_period_end, 'status', v_sub.status);
  v_new := greatest(coalesce(v_sub.current_period_end, now()), now()) + make_interval(months => p_months);
  update public.subscriptions
     set current_period_end = v_new, status = 'active',
         gv5_status_reason = trim(p_reason), gv5_updated_at = now()
   where id = v_sub.id;
  perform public.admin_log_lifecycle(
    p_establishment_id, 'subscription', v_sub.id, 'subscription_renew',
    v_old, jsonb_build_object('current_period_end', v_new, 'status', 'active'),
    p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'subscription_id', v_sub.id,
                            'current_period_end', v_new);
end;
$$;

create or replace function public.admin_archive_subscription(
  p_subscription_id uuid,
  p_archive boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub public.subscriptions%rowtype;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Abonnement introuvable.'; end if;
  if p_archive and length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif d''archivage obligatoire.';
  end if;
  if (p_archive and v_sub.gv5_archived_at is not null)
     or (not p_archive and v_sub.gv5_archived_at is null) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'archived', p_archive);
  end if;
  if p_archive and v_sub.status in ('trial','active','past_due') then
    raise exception 'Clôturer ou suspendre l''abonnement avant archivage.';
  end if;

  update public.subscriptions
     set gv5_archived_at = case when p_archive then now() else null end,
         gv5_archive_reason = case when p_archive then trim(p_reason) else null end,
         gv5_updated_at = now()
   where id = p_subscription_id;
  perform public.admin_log_lifecycle(
    v_sub.establishment_id, 'subscription', p_subscription_id,
    case when p_archive then 'subscription_archive' else 'subscription_restore' end,
    jsonb_build_object('archived_at', v_sub.gv5_archived_at),
    jsonb_build_object('archived_at', case when p_archive then now() else null end),
    p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'archived', p_archive);
end;
$$;

create or replace function public.admin_soft_delete_subscription(
  p_subscription_id uuid,
  p_reason text,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub public.subscriptions%rowtype;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if coalesce(trim(p_confirmation), '') <> 'SUPPRIMER' then
    raise exception 'Confirmation renforcée requise (SUPPRIMER).';
  end if;
  if length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Motif de suppression obligatoire.';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Abonnement introuvable.'; end if;
  if v_sub.status not in ('cancelled','expired') then
    raise exception 'Suppression logique interdite : clôturer d''abord l''abonnement.';
  end if;
  if v_sub.gv5_archived_at is null then
    raise exception 'Archiver l''abonnement avant suppression logique.';
  end if;

  update public.subscriptions
     set gv5_status_reason = trim(p_reason), gv5_updated_at = now()
   where id = p_subscription_id;
  perform public.admin_log_lifecycle(
    v_sub.establishment_id, 'subscription', p_subscription_id,
    'subscription_soft_delete', jsonb_build_object('status', v_sub.status),
    jsonb_build_object('status', v_sub.status, 'suppression', 'logique'),
    p_reason, 'ok');
  return jsonb_build_object('ok', true, 'idempotent', false, 'mode', 'logique',
                            'message', 'Historique contractuel, factures et paiements conservés.');
end;
$$;

revoke all on function public.admin_log_lifecycle(uuid, text, uuid, text, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.admin_log_lifecycle(uuid, text, uuid, text, jsonb, jsonb, text, text) to authenticated;
revoke all on function public.admin_set_establishment_status_v2(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_establishment_status_v2(uuid, boolean, text) to authenticated;
revoke all on function public.admin_archive_establishment_v2(uuid, boolean, text) from public, anon;
grant execute on function public.admin_archive_establishment_v2(uuid, boolean, text) to authenticated;
revoke all on function public.admin_soft_delete_establishment(uuid, text, text) from public, anon;
grant execute on function public.admin_soft_delete_establishment(uuid, text, text) to authenticated;
revoke all on function public.admin_set_subscription_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_subscription_status(uuid, text, text) to authenticated;
revoke all on function public.admin_update_subscription(uuid, text, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_update_subscription(uuid, text, timestamptz, timestamptz, timestamptz, text) to authenticated;
revoke all on function public.admin_renew_subscription_v2(uuid, integer, text) from public, anon;
grant execute on function public.admin_renew_subscription_v2(uuid, integer, text) to authenticated;
revoke all on function public.admin_archive_subscription(uuid, boolean, text) from public, anon;
grant execute on function public.admin_archive_subscription(uuid, boolean, text) to authenticated;
revoke all on function public.admin_soft_delete_subscription(uuid, text, text) from public, anon;
grant execute on function public.admin_soft_delete_subscription(uuid, text, text) to authenticated;

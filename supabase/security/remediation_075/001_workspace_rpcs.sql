-- AUTO DYALI — GV5 §75 — RPC de l'espace Super Admin unifié
-- Environnement cible : STAGING UNIQUEMENT. Migration réversible (voir 001_down.sql).
-- Aucune donnée n'est supprimée. Toutes les écritures sont journalisées dans audit_log.
-- Aucun secret n'est lu ou exposé ici.

-- ---------------------------------------------------------------------------
-- 1. Mise à jour journalisée d'un établissement (sans toucher au statut).
--    Remplace le UPDATE direct côté client (§74, problème 3 & 4).
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_establishment(
  p_id uuid,
  p_name text,
  p_legal_name text,
  p_slug text,
  p_activity_type text,
  p_address text,
  p_city text,
  p_region text,
  p_phone text,
  p_email text,
  p_notes text,
  p_professional_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avant jsonb;
  v_conflit uuid;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Le nom commercial est obligatoire.'; end if;
  if nullif(btrim(coalesce(p_slug, '')), '') is null then raise exception 'Le slug est obligatoire.'; end if;
  if p_email is not null and btrim(p_email) <> '' and btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  select to_jsonb(e) into v_avant from public.establishments e where e.id = p_id;
  if v_avant is null then raise exception 'Établissement introuvable.'; end if;

  select e.id into v_conflit from public.establishments e where e.slug = btrim(p_slug) and e.id <> p_id limit 1;
  if v_conflit is not null then raise exception 'Ce slug est déjà utilisé par un autre établissement.'; end if;

  if nullif(btrim(coalesce(p_professional_id, '')), '') is not null then
    select e.id into v_conflit from public.establishments e
      where e.professional_id = btrim(p_professional_id) and e.id <> p_id limit 1;
    if v_conflit is not null then raise exception 'Cet identifiant professionnel est déjà utilisé.'; end if;
  end if;

  update public.establishments set
    name = btrim(p_name),
    legal_name = nullif(btrim(coalesce(p_legal_name, '')), ''),
    slug = btrim(p_slug),
    activity_type = nullif(btrim(coalesce(p_activity_type, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    city = nullif(btrim(coalesce(p_city, '')), ''),
    region = nullif(btrim(coalesce(p_region, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    professional_id = nullif(btrim(coalesce(p_professional_id, '')), ''),
    updated_at = now()
  where id = p_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_id, auth.uid(), 'update_establishment', 'establishment', p_id,
          jsonb_build_object('avant', v_avant - 'updated_at', 'apres',
            jsonb_build_object('name', btrim(p_name), 'slug', btrim(p_slug), 'email', nullif(btrim(coalesce(p_email, '')), ''))));

  return jsonb_build_object('ok', true, 'id', p_id);
end; $$;

-- ---------------------------------------------------------------------------
-- 2. Mise à jour du Manager SANS recréer son compte et sans toucher au mot de passe.
--    L'e-mail est modifié dans auth.users ; le hash du mot de passe est intact.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_manager(
  p_profile_id uuid,
  p_full_name text,
  p_login_id text,
  p_phone text,
  p_is_active boolean,
  p_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil public.profiles%rowtype;
  v_conflit uuid;
  v_ancien_email text;
  v_nouvel_email text;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then raise exception 'Le nom du Manager est obligatoire.'; end if;

  select * into v_profil from public.profiles where id = p_profile_id and role = 'manager';
  if not found then raise exception 'Manager introuvable.'; end if;

  if nullif(btrim(coalesce(p_login_id, '')), '') is not null then
    select p.id into v_conflit from public.profiles p
      where p.login_id = btrim(p_login_id) and p.id <> p_profile_id limit 1;
    if v_conflit is not null then raise exception 'Cet identifiant de connexion est déjà utilisé.'; end if;
  end if;

  v_nouvel_email := nullif(btrim(coalesce(p_email, '')), '');
  if v_nouvel_email is not null then
    if v_nouvel_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Adresse e-mail invalide.';
    end if;
    select u.email into v_ancien_email from auth.users u where u.id = p_profile_id;
    if v_ancien_email is distinct from v_nouvel_email then
      select u.id into v_conflit from auth.users u where lower(u.email) = lower(v_nouvel_email) and u.id <> p_profile_id limit 1;
      if v_conflit is not null then raise exception 'Cet e-mail est déjà rattaché à un autre compte.'; end if;
      update auth.users set email = v_nouvel_email where id = p_profile_id;
    end if;
  end if;

  update public.profiles set
    full_name = btrim(p_full_name),
    login_id = nullif(btrim(coalesce(p_login_id, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    is_active = coalesce(p_is_active, is_active)
  where id = p_profile_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_profil.establishment_id, auth.uid(), 'update_manager', 'profile', p_profile_id,
          jsonb_build_object('full_name', btrim(p_full_name), 'login_id', nullif(btrim(coalesce(p_login_id, '')), ''),
                             'is_active', coalesce(p_is_active, v_profil.is_active), 'email_changes', v_ancien_email is distinct from v_nouvel_email));

  return jsonb_build_object('ok', true, 'id', p_profile_id, 'email_changed', v_ancien_email is distinct from v_nouvel_email);
end; $$;

-- ---------------------------------------------------------------------------
-- 3. Configuration réelle d'un abonnement : formule + durée payante + essai.
--    L'essai est INDÉPENDANT et ne réduit jamais la durée payante.
-- ---------------------------------------------------------------------------
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
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if p_plan not in ('standard', 'silver', 'gold') then raise exception 'Forfait inconnu : %', p_plan; end if;
  if p_paid_months is null or p_paid_months < 1 or p_paid_months > 120 then raise exception 'Durée payante invalide (1 à 120 mois).'; end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then raise exception 'Durée d''essai invalide (0 à 365 jours).'; end if;

  select to_jsonb(s) into v_ancien from public.subscriptions s where s.establishment_id = p_establishment_id limit 1;
  if v_ancien is null then raise exception 'Abonnement introuvable.'; end if;

  v_debut := coalesce(p_start_date, (v_ancien->>'started_at')::date, current_date);
  v_fin_payee := (v_debut + (p_paid_months || ' months')::interval)::date;
  v_fin_essai := case when p_trial_days > 0 then v_debut + p_trial_days else null end;

  update public.establishments set plan = p_plan, trial_ends_at = v_fin_essai, updated_at = now()
  where id = p_establishment_id;

  update public.subscriptions set
    plan_code = p_plan,
    started_at = v_debut,
    trial_ends_at = v_fin_essai,
    current_period_end = v_fin_payee,
    status = case when status in ('suspended','cancelled','expired') then status else
                    case when p_trial_days > 0 and now() < v_fin_essai then 'trial' else 'active' end end
  where establishment_id = p_establishment_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_establishment_id, auth.uid(), 'set_subscription', 'subscription', (v_ancien->>'id')::uuid,
          jsonb_build_object('avant', v_ancien, 'plan', p_plan, 'paid_months', p_paid_months,
                             'trial_days', p_trial_days, 'debut', v_debut, 'fin_payee', v_fin_payee, 'fin_essai', v_fin_essai));

  return jsonb_build_object('ok', true, 'started_at', v_debut, 'trial_ends_at', v_fin_essai,
                            'current_period_end', v_fin_payee, 'plan', p_plan);
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Renouvellement (RPC appelée par l'interface mais absente de staging).
-- ---------------------------------------------------------------------------
create or replace function public.admin_renew_subscription(
  p_establishment_id uuid,
  p_months integer default 12
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_base date;
  v_fin date;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if p_months is null or p_months < 1 or p_months > 120 then raise exception 'Durée de renouvellement invalide.'; end if;
  select * into v_sub from public.subscriptions where establishment_id = p_establishment_id order by created_at desc limit 1;
  if not found then raise exception 'Abonnement introuvable.'; end if;

  v_base := greatest(coalesce(v_sub.current_period_end::date, current_date), current_date);
  v_fin := (v_base + (p_months || ' months')::interval)::date;

  update public.subscriptions set current_period_end = v_fin, status = 'active', cancelled_at = null
  where id = v_sub.id;
  update public.establishments set is_active = true, suspended_at = null, updated_at = now() where id = p_establishment_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_establishment_id, auth.uid(), 'renew_subscription', 'subscription', v_sub.id,
          jsonb_build_object('months', p_months, 'ancienne_echeance', v_sub.current_period_end, 'nouvelle_echeance', v_fin));

  return jsonb_build_object('ok', true, 'current_period_end', v_fin);
end; $$;

-- ---------------------------------------------------------------------------
-- 5. Permissions module × CRUD, vérifiées contre les fonctions de la formule.
--    Aucune permission non prévue par le forfait ne peut être attribuée.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_permissions(
  p_establishment_id uuid,
  p_role user_role,
  p_permissions jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_perm jsonb;
  v_module text;
  v_nb integer := 0;
  v_autorise boolean;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if p_role <> 'manager' then raise exception 'Seules les permissions du Manager sont gérables ici.'; end if;
  select plan into v_plan from public.establishments where id = p_establishment_id;
  if v_plan is null then raise exception 'Établissement introuvable.'; end if;
  if jsonb_typeof(p_permissions) <> 'array' then raise exception 'Format des permissions invalide.'; end if;

  for v_perm in select value from jsonb_array_elements(p_permissions)
  loop
    v_module := trim(coalesce(v_perm->>'module', ''));
    if v_module = '' then raise exception 'Module invalide.'; end if;
    select exists(select 1 from public.plan_features pf
                  where pf.plan_code = v_plan and pf.feature_key = v_module and pf.enabled) into v_autorise;
    if not v_autorise then
      raise exception 'Le module « % » n''est pas compris dans la formule %.', v_module, v_plan;
    end if;
  end loop;

  delete from public.permissions where establishment_id = p_establishment_id and role = p_role;

  for v_perm in select value from jsonb_array_elements(p_permissions)
  loop
    insert into public.permissions (establishment_id, role, module, can_view, can_create, can_edit, can_delete)
    values (p_establishment_id, p_role, trim(v_perm->>'module'),
            coalesce((v_perm->>'can_view')::boolean, false),
            coalesce((v_perm->>'can_create')::boolean, false),
            coalesce((v_perm->>'can_edit')::boolean, false),
            coalesce((v_perm->>'can_delete')::boolean, false));
    v_nb := v_nb + 1;
  end loop;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_establishment_id, auth.uid(), 'set_permissions', 'permissions', p_establishment_id,
          jsonb_build_object('role', p_role, 'count', v_nb, 'permissions', p_permissions));

  return jsonb_build_object('ok', true, 'count', v_nb);
end; $$;

-- ---------------------------------------------------------------------------
-- 6. Préparation d'une relance (RPC appelée par la EF send-invitation, absente).
-- ---------------------------------------------------------------------------
create or replace function public.admin_prepare_resend(
  p_invitation_id uuid,
  p_request_id text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_channels text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_canal text;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  select * into v_inv from public.invitations where id = p_invitation_id;
  if not found then raise exception 'Invitation introuvable.'; end if;
  if v_inv.status in ('accepted', 'cancelled') then raise exception 'Cette invitation ne peut plus être relancée.'; end if;
  if p_token_hash is null or length(p_token_hash) <> 64 then raise exception 'Hash de jeton invalide.'; end if;

  update public.invitations set
    token_hash = p_token_hash,
    expires_at = p_expires_at,
    last_request_id = p_request_id,
    status = 'prepared',
    updated_at = now()
  where id = p_invitation_id;

  foreach v_canal in array coalesce(p_channels, array[]::text[])
  loop
    if v_canal in ('email', 'whatsapp') then
      insert into public.invitation_events (invitation_id, channel, event_type, metadata)
      values (p_invitation_id, v_canal, 'resent', jsonb_build_object('request_id', p_request_id)::text);
    end if;
  end loop;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_inv.establishment_id, auth.uid(), 'prepare_resend', 'invitation', p_invitation_id,
          jsonb_build_object('channels', p_channels, 'request_id', p_request_id));

  return jsonb_build_object('ok', true, 'id', p_invitation_id, 'expires_at', p_expires_at);
end; $$;

-- ---------------------------------------------------------------------------
-- 7. Révocation d'un lien d'invitation (sans supprimer l'invitation).
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_inv public.invitations%rowtype;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  select * into v_inv from public.invitations where id = p_invitation_id;
  if not found then raise exception 'Invitation introuvable.'; end if;
  if v_inv.status = 'accepted' then raise exception 'Une invitation acceptée ne peut pas être révoquée.'; end if;

  update public.invitations set status = 'cancelled', expires_at = now(), updated_at = now()
  where id = p_invitation_id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (p_invitation_id, 'system', 'cancelled', '{}');

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (v_inv.establishment_id, auth.uid(), 'revoke_invitation', 'invitation', p_invitation_id,
          jsonb_build_object('email', v_inv.email, 'ancien_statut', v_inv.status));

  return jsonb_build_object('ok', true, 'id', p_invitation_id, 'status', 'cancelled');
end; $$;

-- ---------------------------------------------------------------------------
-- 8. Lecture groupée de la fiche (une seule requête, données cohérentes).
--    L'e-mail du Manager est lu depuis auth.users ; aucun mot de passe n'est exposé.
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_abonne_details(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_resultat jsonb;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;

  select jsonb_build_object(
    'establishment', (select to_jsonb(e) from public.establishments e where e.id = p_id),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.establishment_id = p_id order by s.created_at desc limit 1),
    'manager', (
      select jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'login_id', p.login_id, 'phone', p.phone,
        'is_active', p.is_active, 'created_at', p.created_at,
        'email', u.email, 'must_change_password', p.must_change_password,
        'password_changed_at', p.password_changed_at,
        'last_activity', (select max(a.created_at) from public.audit_log a where a.actor_id = p.id)
      )
      from public.profiles p left join auth.users u on u.id = p.id
      where p.establishment_id = p_id and p.role = 'manager' order by p.created_at limit 1
    ),
    'permissions', coalesce((select jsonb_agg(jsonb_build_object(
        'module', pm.module, 'can_view', pm.can_view, 'can_create', pm.can_create,
        'can_edit', pm.can_edit, 'can_delete', pm.can_delete) order by pm.module)
      ) from public.permissions pm where pm.establishment_id = p_id and pm.role = 'manager'), '[]'::jsonb),
    'plan_features', coalesce((select jsonb_agg(jsonb_build_object(
        'feature_key', pf.feature_key, 'enabled', pf.enabled) order by pf.feature_key)
      ) from public.plan_features pf where pf.plan_code = (select plan from public.establishments where id = p_id)), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc)
      ) from public.invitations i where i.establishment_id = p_id), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'entity', a.entity, 'created_at', a.created_at) order by a.created_at desc)
      ) from (select * from public.audit_log where establishment_id = p_id order by created_at desc limit 30) a), '[]'::jsonb)
  ) into v_resultat;

  return v_resultat;
end; $$;

-- Droits d'exécution : authentifiés uniquement (la vérification saas_admin est interne).
revoke all on function public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_update_manager(uuid, text, text, text, boolean, text) from public;
revoke all on function public.admin_set_subscription(uuid, text, integer, integer, date) from public;
revoke all on function public.admin_renew_subscription(uuid, integer) from public;
revoke all on function public.admin_set_permissions(uuid, user_role, jsonb) from public;
revoke all on function public.admin_prepare_resend(uuid, text, text, timestamptz, text[]) from public;
revoke all on function public.admin_revoke_invitation(uuid) from public;
revoke all on function public.admin_get_abonne_details(uuid) from public;

grant execute on function public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_manager(uuid, text, text, text, boolean, text) to authenticated;
grant execute on function public.admin_set_subscription(uuid, text, integer, integer, date) to authenticated;
grant execute on function public.admin_renew_subscription(uuid, integer) to authenticated;
grant execute on function public.admin_set_permissions(uuid, user_role, jsonb) to authenticated;
grant execute on function public.admin_prepare_resend(uuid, text, text, timestamptz, text[]) to authenticated;
grant execute on function public.admin_revoke_invitation(uuid) to authenticated;
grant execute on function public.admin_get_abonne_details(uuid) to authenticated;

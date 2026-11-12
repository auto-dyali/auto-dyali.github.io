-- =====================================================================
-- AUTO DYALI — 0028 : Onboarding sécurisé entreprise + Manager
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Ne pas exécuter à distance sans :
--   1) sauvegarde / export,
--   2) vérification des dépendances (FK, RLS, données existantes),
--   3) autorisation explicite de l'utilisateur.
--
-- Principe de sécurité :
--   - La création du compte Auth (invitation email) se fait côté serveur
--     via une Edge Function utilisant la clé service_role (jamais le navigateur).
--   - Cette migration fournit uniquement les RPC transactionnelles qui
--     associent un utilisateur Auth déjà invité à une entreprise + abonnement.
--   - Toute action vérifie public.is_saas_admin() et est journalisée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Retrouver l'identifiant Auth d'un email (sans exposer l'email).
--    Réservé au Super Admin. Sert à détecter les doublons avant invitation.
-- ---------------------------------------------------------------------
create or replace function public.admin_find_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_email is null or length(trim(p_email)) = 0 then
    return null;
  end if;
  select u.id into v_id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1;
  return v_id;
end;
$$;

revoke all on function public.admin_find_user_id_by_email(text) from public;
grant execute on function public.admin_find_user_id_by_email(text) to authenticated;

comment on function public.admin_find_user_id_by_email(text) is
  'Retourne l''UUID Auth pour un email (Super Admin uniquement). Aucun email renvoyé.';

-- ---------------------------------------------------------------------
-- 2. Onboarding atomique : entreprise + abonnement + Manager.
--    Le compte Auth doit déjà exister (invitation Edge Function).
--    En cas d'erreur, la transaction PL/pgSQL est annulée intégralement.
-- ---------------------------------------------------------------------
create or replace function public.admin_onboard_tenant(
  p_company_name    text,
  p_slug            text,
  p_city            text default null,
  p_phone           text default null,
  p_email           text default null,
  p_plan            text default 'standard',
  p_manager_user_id uuid default null,
  p_manager_name    text default null,
  p_manager_phone   text default null,
  p_trial_days      integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab_id uuid;
  v_sub_id  uuid;
  v_existing_profile public.profiles%rowtype;
  v_slug    text;
begin
  -- Contrôle d'accès serveur.
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  -- Validations d'entrée.
  if p_company_name is null or length(trim(p_company_name)) = 0 then
    raise exception 'Le nom de l''entreprise est obligatoire.';
  end if;
  if p_plan not in ('standard','silver','gold') then
    raise exception 'Forfait inconnu : % (attendu standard|silver|gold)', p_plan;
  end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 90 then
    raise exception 'Durée d''essai invalide (0..90 jours).';
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then
    raise exception 'Le slug de l''entreprise est obligatoire.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug invalide : minuscules, chiffres et tirets uniquement.';
  end if;

  -- Anti-doublon entreprise.
  if exists (select 1 from public.establishments e where e.slug = v_slug) then
    raise exception 'Une entreprise avec le slug « % » existe déjà.', v_slug;
  end if;

  -- Contrôle du Manager : utilisateur Auth existant + pas déjà rattaché.
  if p_manager_user_id is not null then
    if not exists (select 1 from auth.users u where u.id = p_manager_user_id) then
      raise exception 'Compte Manager introuvable dans Auth.';
    end if;

    select * into v_existing_profile
      from public.profiles pr
     where pr.id = p_manager_user_id;

    if found then
      if v_existing_profile.establishment_id is not null then
        raise exception 'Ce compte est déjà rattaché à une entreprise.';
      end if;
      if v_existing_profile.role not in ('manager') then
        raise exception 'Ce compte possède déjà un rôle incompatible (%).', v_existing_profile.role;
      end if;
    end if;
  end if;

  -- 1) Entreprise.
  insert into public.establishments (name, slug, city, phone, email, plan, is_active, trial_ends_at)
  values (trim(p_company_name), v_slug, p_city, p_phone, p_email, p_plan, true,
          case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else null end)
  returning id into v_etab_id;

  -- 2) Abonnement initial (essai ou actif).
  insert into public.subscriptions (establishment_id, plan_code, status, trial_ends_at, current_period_end)
  values (
    v_etab_id,
    p_plan,
    case when p_trial_days > 0 then 'trial' else 'active' end,
    case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else null end,
    case when p_trial_days > 0 then now() + (p_trial_days || ' days')::interval else now() + interval '1 year' end
  )
  returning id into v_sub_id;

  -- 3) Manager propriétaire (profil lié à l'entreprise).
  if p_manager_user_id is not null then
    insert into public.profiles (id, full_name, phone, establishment_id, role, is_active)
    values (
      p_manager_user_id,
      coalesce(nullif(trim(p_manager_name), ''), split_part(coalesce(p_email, 'Manager'), '@', 1)),
      p_manager_phone,
      v_etab_id,
      'manager',
      true
    )
    on conflict (id) do update
      set full_name = excluded.full_name,
          phone = excluded.phone,
          establishment_id = excluded.establishment_id,
          role = 'manager',
          is_active = true;
  end if;

  -- 4) Journal d'audit (sans secret).
  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (
    v_etab_id,
    auth.uid(),
    'onboard_tenant',
    'establishment',
    v_etab_id,
    jsonb_build_object(
      'company', p_company_name,
      'slug', v_slug,
      'plan', p_plan,
      'trial_days', p_trial_days,
      'manager_user_id', p_manager_user_id,
      'subscription_id', v_sub_id
    )
  );

  return jsonb_build_object(
    'establishment_id', v_etab_id,
    'subscription_id', v_sub_id,
    'manager_user_id', p_manager_user_id
  );
end;
$$;

revoke all on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer) from public;
grant execute on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer) to authenticated;

comment on function public.admin_onboard_tenant(text,text,text,text,text,text,uuid,text,text,integer) is
  'Onboarding atomique entreprise + abonnement + Manager. Compte Auth créé au préalable via Edge Function sécurisée.';

-- ---------------------------------------------------------------------
-- 3. Vérification de cohérence (lecture seule) — utile avant activation.
-- ---------------------------------------------------------------------
create or replace function public.admin_tenant_integrity(p_establishment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab public.establishments%rowtype;
  v_managers integer;
  v_sub public.subscriptions%rowtype;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select * into v_etab from public.establishments where id = p_establishment_id;
  if not found then
    raise exception 'Entreprise introuvable.';
  end if;

  select count(*) into v_managers
    from public.profiles
   where establishment_id = p_establishment_id and role = 'manager';

  select * into v_sub
    from public.subscriptions
   where establishment_id = p_establishment_id
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'establishment_id', p_establishment_id,
    'is_active', v_etab.is_active,
    'plan', v_etab.plan,
    'managers', v_managers,
    'has_manager', v_managers > 0,
    'subscription_status', v_sub.status,
    'subscription_plan', v_sub.plan_code,
    'coherent', (v_managers > 0 and v_sub.id is not null)
  );
end;
$$;

revoke all on function public.admin_tenant_integrity(uuid) from public;
grant execute on function public.admin_tenant_integrity(uuid) to authenticated;

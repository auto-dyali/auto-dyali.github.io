-- GV5 — TEST D'INTÉGRATION STAGING DU PARCOURS D'ONBOARDING.
-- Transaction entièrement ANNULÉE : aucune écriture persistante.
-- Sortie : uniquement des libellés et des comptages (aucune donnée réelle).
--
-- Couvre : création établissement + abonnement + profil Manager + permissions
-- + invitation + audit + demande clôturée ; idempotence par request_id ;
-- refus de doublon ; isolation Manager ; écriture tenant autorisée ; écriture
-- inter-garage refusée par RLS.
--
-- Exécution :
--   supabase db query --remote=<staging> --file=scripts/gv5_staging_onboarding_test.sql --yes
-- Résultat attendu : ROLLBACK_VOLONTAIRE + NOTICE IT_OK.

set idle_in_transaction_session_timeout = '120s';
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

-- 0. Super Admin de session, résolu en base (aucun UUID saisi).
create temp table gv5_it_ctx(k text primary key, v text) on commit drop;
insert into gv5_it_ctx(k, v)
select 'sa', id::text
  from public.profiles
 where role = 'saas_admin'
 order by created_at
 limit 1;

do $$
begin
  if not exists (select 1 from gv5_it_ctx where k = 'sa') then
    raise exception 'IT_SA_ABSENT';
  end if;
end $$;

-- 1. Compte Auth Manager simulé (créé puis annulé avec la transaction).
create temp table gv5_it_ids(uid uuid, email text) on commit drop;
do $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := 'gv5-it-' || replace(v_uid::text, '-', '') || '@example.invalid';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_email, '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );
  insert into gv5_it_ids(uid, email) values (v_uid, v_email);
end $$;

-- 2. Identifiants uniques de la requête (aucune valeur réelle).
create temp table gv5_it_req(request_id text, prof text, login text, slug text) on commit drop;
insert into gv5_it_req
select 'gv5-it-' || replace(gen_random_uuid()::text, '-', ''),
       'GV5IT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
       'gv5it' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
       'gv5-it-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

create temp table gv5_it_res(j jsonb) on commit drop;

-- 3. Session Super Admin puis appel de la RPC réelle.
select set_config('request.jwt.claim.sub', (select v from gv5_it_ctx where k = 'sa'), true);

insert into gv5_it_res(j)
select public.admin_onboard_tenant_v2(
  (select request_id from gv5_it_req),
  jsonb_build_object(
    'name', 'GV5 Integration Test',
    'slug', (select slug from gv5_it_req),
    'professional_id', (select prof from gv5_it_req),
    'city', 'Test',
    'email', (select email from gv5_it_ids)
  ),
  jsonb_build_object(
    'user_id', (select uid from gv5_it_ids),
    'full_name', 'GV5 IT Manager',
    'email', (select email from gv5_it_ids),
    'login_id', (select login from gv5_it_req)
  ),
  jsonb_build_object(
    'plan', 'gold',
    'paid_months', 12,
    'trial_days', 14,
    'start_date', current_date
  ),
  (select array_agg(feature_key) from public.plan_features where plan_code = 'gold' and enabled),
  (select jsonb_agg(jsonb_build_object(
            'module', feature_key, 'can_view', true,
            'can_create', true, 'can_edit', true, 'can_delete', false))
     from public.plan_features where plan_code = 'gold' and enabled),
  encode(sha256(convert_to((select request_id from gv5_it_req), 'UTF8')), 'hex'),
  now() + interval '7 days',
  array['email']
);

-- 4. Vérification de l'état persisté (dans la transaction).
do $$
declare
  v_etab uuid; v_sub uuid; v_inv uuid; v_uid uuid; v_n int;
begin
  select (j->>'establishment_id')::uuid,
         (j->>'subscription_id')::uuid,
         (j->>'invitation_id')::uuid
    into v_etab, v_sub, v_inv
    from gv5_it_res;
  select uid into v_uid from gv5_it_ids;

  if v_etab is null or v_sub is null or v_inv is null then
    raise exception 'IT_RESULTAT_INCOMPLET';
  end if;

  if not exists (
    select 1 from public.establishments e
     where e.id = v_etab
       and e.plan = 'gold'
       and e.is_active
       and e.professional_id = (select prof from gv5_it_req)
  ) then raise exception 'IT_ETABLISSEMENT_KO'; end if;

  if not exists (
    select 1 from public.subscriptions s
     where s.id = v_sub
       and s.establishment_id = v_etab
       and s.plan_code = 'gold'
       and s.status = 'trial'
       and s.trial_ends_at::date = (current_date + 14)
       and s.current_period_end::date = (current_date + interval '12 months')::date
  ) then raise exception 'IT_ABONNEMENT_KO'; end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = v_uid
       and p.establishment_id = v_etab
       and p.role = 'manager'
       and p.must_change_password
       and p.login_id = (select login from gv5_it_req)
  ) then raise exception 'IT_PROFIL_MANAGER_KO'; end if;

  select count(*) into v_n
    from public.permissions
   where establishment_id = v_etab and role = 'manager';
  if v_n <> (select count(*) from public.plan_features where plan_code = 'gold' and enabled) then
    raise exception 'IT_PERMISSIONS_KO: %', v_n;
  end if;
  if exists (
    select 1 from public.permissions
     where establishment_id = v_etab and role = 'manager' and can_view is not true
  ) then raise exception 'IT_PERMISSIONS_VUE_KO'; end if;

  if not exists (
    select 1 from public.invitations i
     where i.id = v_inv
       and i.establishment_id = v_etab
       and i.status = 'prepared'
       and i.email_status = 'en_attente'
  ) then raise exception 'IT_INVITATION_KO'; end if;

  if not exists (
    select 1 from public.audit_log a
     where a.establishment_id = v_etab and a.action = 'onboard_tenant_v2'
  ) then raise exception 'IT_AUDIT_KO'; end if;

  if not exists (
    select 1 from public.onboarding_requests r
     where r.request_id = (select request_id from gv5_it_req)
       and r.status = 'completed'
       and r.establishment_id = v_etab
  ) then raise exception 'IT_DEMANDE_KO'; end if;

  raise notice 'IT_OK: parcours complet (etablissement, abonnement, manager, permissions, invitation, audit)';
end $$;

-- 5. Idempotence : même request_id rejoué, aucun doublon.
do $$
declare
  v_avant int; v_apres int; v_j jsonb; v_etab uuid;
begin
  select count(*) into v_avant from public.establishments;
  select j into v_j from gv5_it_res;
  v_etab := (v_j->>'establishment_id')::uuid;

  select public.admin_onboard_tenant_v2(
    (select request_id from gv5_it_req),
    jsonb_build_object(
      'name', 'GV5 Integration Test',
      'slug', (select slug from gv5_it_req),
      'professional_id', (select prof from gv5_it_req),
      'city', 'Test',
      'email', (select email from gv5_it_ids)
    ),
    jsonb_build_object(
      'user_id', (select uid from gv5_it_ids),
      'full_name', 'GV5 IT Manager',
      'email', (select email from gv5_it_ids),
      'login_id', (select login from gv5_it_req)
    ),
    jsonb_build_object('plan', 'gold', 'paid_months', 12, 'trial_days', 14, 'start_date', current_date),
    (select array_agg(feature_key) from public.plan_features where plan_code = 'gold' and enabled),
    (select jsonb_agg(jsonb_build_object(
              'module', feature_key, 'can_view', true,
              'can_create', true, 'can_edit', true, 'can_delete', false))
       from public.plan_features where plan_code = 'gold' and enabled),
    encode(sha256(convert_to((select request_id from gv5_it_req), 'UTF8')), 'hex'),
    now() + interval '7 days',
    array['email']
  ) into v_j;

  if coalesce((v_j->>'idempotent')::boolean, false) is not true then
    raise exception 'IT_IDEMPOTENCE_KO';
  end if;
  if (v_j->>'establishment_id')::uuid <> v_etab then
    raise exception 'IT_IDEMPOTENCE_ETABLISSEMENT_KO';
  end if;

  select count(*) into v_apres from public.establishments;
  if v_apres <> v_avant then raise exception 'IT_IDEMPOTENCE_DOUBLON'; end if;

  raise notice 'IT_OK: idempotence (aucun doublon)';
end $$;

-- 6. Doublon d'identifiant professionnel refusé, aucune ligne créée.
do $$
declare
  v_avant int; v_apres int; v_refuse boolean := false; v_msg text;
begin
  select count(*) into v_avant from public.establishments;
  begin
    perform public.admin_onboard_tenant_v2(
      'gv5-it-' || replace(gen_random_uuid()::text, '-', ''),
      jsonb_build_object(
        'name', 'GV5 Integration Test Doublon',
        'slug', 'gv5-it-dup-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        'professional_id', (select prof from gv5_it_req),
        'city', 'Test',
        'email', (select email from gv5_it_ids)
      ),
      jsonb_build_object(
        'user_id', (select uid from gv5_it_ids),
        'full_name', 'GV5 IT Manager',
        'email', (select email from gv5_it_ids),
        'login_id', (select login from gv5_it_req)
      ),
      jsonb_build_object('plan', 'gold', 'paid_months', 12, 'trial_days', 14, 'start_date', current_date),
      (select array_agg(feature_key) from public.plan_features where plan_code = 'gold' and enabled),
      (select jsonb_agg(jsonb_build_object(
                'module', feature_key, 'can_view', true,
                'can_create', true, 'can_edit', true, 'can_delete', false))
         from public.plan_features where plan_code = 'gold' and enabled),
      encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'),
      now() + interval '7 days',
      array['email']
    );
  exception when others then
    v_msg := SQLERRM;
    v_refuse := position('déjà utilisé' in v_msg) > 0;
  end;

  if not v_refuse then
    raise exception 'IT_DOUBLON_NON_REFUSE: %', coalesce(v_msg, 'aucune exception');
  end if;

  select count(*) into v_apres from public.establishments;
  if v_apres <> v_avant then raise exception 'IT_DOUBLON_CREE'; end if;

  raise notice 'IT_OK: doublon refuse sans creation';
end $$;

-- 7. Acceptation de l'invitation : usage unique + levée de la rotation.
do $$
declare
  v_inv uuid; v_uid uuid; v_refus boolean := false; v_msg text;
begin
  select (j->>'invitation_id')::uuid into v_inv from gv5_it_res;
  select uid into v_uid from gv5_it_ids;

  -- Simule la mise à jour du mot de passe par Auth (service_role) APRÈS l'émission.
  update auth.users set updated_at = now() + interval '1 second' where id = v_uid;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform public.admin_accept_invitation((select request_id from gv5_it_req), v_uid);

  if not exists (
    select 1 from public.invitations
     where id = v_inv and status = 'accepted' and accepted_at is not null
  ) then raise exception 'IT_ACCEPTATION_KO'; end if;

  if not exists (
    select 1 from public.profiles
     where id = v_uid and must_change_password is false and password_changed_at is not null
  ) then raise exception 'IT_ROTATION_KO'; end if;

  begin
    perform public.admin_accept_invitation((select request_id from gv5_it_req), v_uid);
  exception when others then
    v_msg := SQLERRM;
    v_refus := position('déjà utilisée' in v_msg) > 0;
  end;
  if not v_refus then
    raise exception 'IT_USAGE_UNIQUE_KO: %', coalesce(v_msg, 'aucune exception');
  end if;

  raise notice 'IT_OK: invitation acceptee une seule fois, rotation levee';
end $$;

-- 8. Isolation Manager + écriture tenant + refus inter-garage.
select set_config('gv5.etab', (select j->>'establishment_id' from gv5_it_res), true);
select set_config('gv5.other',
  (select id::text from public.establishments
    where id <> (select (j->>'establishment_id')::uuid from gv5_it_res)
    limit 1), true);

-- La rotation a été levée par l'acceptation réelle de l'invitation (étape 7).
select set_config('request.jwt.claim.sub', (select uid::text from gv5_it_ids), true);
set local role authenticated;

do $$
declare
  v_etab uuid := current_setting('gv5.etab')::uuid;
  v_other uuid := nullif(current_setting('gv5.other', true), '')::uuid;
  v_n int; v_cur uuid; v_croise int;
begin
  select count(*) into v_n from public.establishments;
  v_cur := public.current_establishment_id();

  if v_n <> 1 then raise exception 'IT_ISOLATION_VISIBLE_KO: %', v_n; end if;
  if v_cur is distinct from v_etab then raise exception 'IT_ISOLATION_COURANT_KO'; end if;

  if v_other is not null then
    select count(*) into v_croise from public.establishments where id = v_other;
    if v_croise <> 0 then raise exception 'IT_ISOLATION_CROISEE_KO'; end if;
  end if;

  -- Écriture dans son propre garage : autorisée (policy tenant write).
  insert into public.permissions(establishment_id, role, module, can_view)
  values (v_etab, 'manager', 'gv5_it_own', true);

  -- Écriture dans un autre garage : refusée par RLS.
  if v_other is not null then
    begin
      insert into public.permissions(establishment_id, role, module, can_view)
      values (v_other, 'manager', 'gv5_it_cross', true);
      raise exception 'IT_CROSS_WRITE_OK';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  raise notice 'IT_OK: isolation manager et refus inter-garage';
end $$;

reset role;

rollback;
select
  (select count(*)::int from public.establishments   where name = 'GV5 Integration Test') as residu_etablissements,
  (select count(*)::int from public.profiles         where login_id like 'gv5it%')          as residu_profils,
  (select count(*)::int from public.invitations      where email like 'gv5-it-%')            as residu_invitations,
  (select count(*)::int from auth.users              where email like 'gv5-it-%')            as residu_auth,
  (select count(*)::int from public.onboarding_requests where request_id like 'gv5-it-%')   as residu_demandes,
  (select count(*)::int from public.permissions      where module like 'gv5_it%')            as residu_permissions,
  'ROLLBACK_VOLONTAIRE' as resultat;

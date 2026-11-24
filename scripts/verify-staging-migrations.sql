-- AUTO DYALI — Vérification réelle de STAGING (lecture seule).
-- Exécuté par scripts/verify-staging-migrations.sh via :
--   supabase db query --remote=<ref> --read-only --file=<ce fichier>
-- Chaque ligne renvoie : controle, ok, detail.

with
rpc_attendus(nom) as (
  values
    ('admin_identity_v2_health'),
    ('admin_check_identity_available'),
    ('admin_onboard_tenant_v2'),
    ('admin_invitation_preview'),
    ('admin_accept_invitation'),
    ('admin_record_delivery'),
    ('admin_prepare_resend'),
    ('admin_set_subscription'),
    ('admin_update_establishment'),
    ('admin_update_manager'),
    ('admin_get_abonne_details'),
    ('admin_set_permissions'),
    ('admin_revoke_invitation'),
    ('admin_archive_establishment'),
    ('admin_purge_establishment'),
    ('resolve_login_email'),
    ('must_change_password'),
    ('get_my_security_state')
),
tables_attendues(nom) as (
  values ('establishments'),('profiles'),('subscriptions'),('permissions'),
         ('invitations'),('invitation_events'),('onboarding_requests'),('plans'),('plan_features'),('audit_log')
),
colonnes_attendues(nom) as (
  values ('professional_id'),('legal_name'),('activity_type'),('region'),('notes'),
         ('country'),('legal_info'),('fiscal_info'),('admin_info'),('dossier_state'),('complementary_contacts')
),
controles as (
  select 'rpc:' || nom as controle,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = nom) as ok,
         'fonction publique attendue' as detail
  from rpc_attendus

  union all
  select 'table:' || nom,
         exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = nom),
         'table publique attendue'
  from tables_attendues

  union all
  select 'colonne:establishments.' || nom,
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'establishments' and column_name = nom),
         'colonne attendue'
  from colonnes_attendues

  union all
  select 'onboard_v2_sauve_6_champs',
         coalesce((select pg_get_functiondef(p.oid) like '%complementary_contacts%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'admin_onboard_tenant_v2' limit 1), false),
         'la création doit persister country/legal/fiscal/admin/dossier/contacts'

  union all
  select 'update_manager_sync_identities',
         coalesce((select pg_get_functiondef(p.oid) like '%auth.identities%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'admin_update_manager' limit 1), false),
         'le changement d''e-mail doit synchroniser auth.identities'

  union all
  select 'hash_invitation_token_extensions',
         coalesce((select array_to_string(p.proconfig, ',') like '%extensions%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'hash_invitation_token' limit 1), false),
         'pgcrypto vit dans le schéma extensions (sinon digest introuvable)'

  union all
  select 'is_saas_admin_renvoie_toujours_un_booleen',
         coalesce((select p.prosrc ilike '%coalesce%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'is_saas_admin' limit 1), false),
         'un rôle NULL ne doit jamais contourner le garde-fou'

  union all
  select 'identites_email_coherentes',
         (select count(*) = 0 from auth.users u
          join auth.identities i on i.user_id = u.id and i.provider = 'email'
          where lower(coalesce(i.identity_data->>'email','')) is distinct from lower(u.email)),
         'auth.users.email doit égaler auth.identities.identity_data.email'

  union all
  select 'formules_presentes',
         (select count(*) = 3 from public.plans where code in ('standard','silver','gold')),
         'standard / silver / gold'

  union all
  select 'modules_formules_presents',
         (select count(*) > 0 from public.plan_features where enabled),
         'au moins un module activé par formule'

  union all
  select 'invitation_events_provider_error',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'invitation_events'
                   and column_name = 'provider_error'),
         'admin_record_delivery insère provider_error : colonne requise'

  union all
  select 'saas_admin_select_profiles',
         exists (select 1 from pg_policy
                 where polrelid = 'public.profiles'::regclass
                   and polname = 'saas_admin_select_profiles' and polcmd = 'r'),
         'le Super Admin doit voir les Managers (liste et tableau de bord)'

  union all
  select 'admin_create_invitation_renewal',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'admin_create_invitation_renewal'),
         'renouvellement après révocation : nouvelle invitation, ancien lien invalide'
)
select controle, ok, detail
from controles
order by ok asc, controle;

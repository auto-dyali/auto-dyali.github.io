-- Retour arrière migration 101000 (identité v2)
do $$
declare t record;
begin
  for t in select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='r' loop
    execute format('drop policy if exists password_rotation_required on public.%I', t.relname);
  end loop;
end $$;
drop function if exists public.admin_complete_password_change();
drop function if exists public.admin_check_identity_available(text, text, text, text);
drop function if exists public.my_permissions();
drop function if exists public.has_feature(text);
drop function if exists public.my_features();
drop function if exists public.must_change_password();
drop function if exists public.resolve_login_email(text);
drop function if exists public.get_my_security_state();
drop function if exists public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]);
alter table public.onboarding_requests drop column if exists invitation_id;
alter table public.establishments
  drop column if exists professional_id,
  drop column if exists legal_name,
  drop column if exists activity_type,
  drop column if exists region,
  drop column if exists notes;
alter table public.profiles
  drop column if exists login_id,
  drop column if exists must_change_password,
  drop column if exists temporary_password_issued_at,
  drop column if exists temporary_password_expires_at,
  drop column if exists password_changed_at;

-- AUTO DYALI — Création automatique des profils Client
-- Après cette migration, un utilisateur créé dans Supabase Auth pourra se connecter
-- sans insertion manuelle dans profiles.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, establishment_id, role, is_active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email, 'Nouveau client'),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'client'::public.user_role,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Rattrapage des utilisateurs Auth déjà créés sans profil.
insert into public.profiles (id, full_name, establishment_id, role, is_active)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email, 'Nouveau client'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'client'::public.user_role,
  true
from auth.users as u
where not exists (select 1 from public.profiles as p where p.id = u.id);

-- Finalisation d'un compte Client depuis le dashboard Super Admin.
-- L'utilisateur Auth est créé côté navigateur, puis cette fonction rattache
-- son profil et crée sa fiche client sans exposer de droits d'administration.
create or replace function public.complete_client_account(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment_id uuid;
  v_code text;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès réservé au Super Admin';
  end if;

  select id into v_establishment_id
  from public.establishments
  where is_active = true
  order by created_at
  limit 1;

  if v_establishment_id is null then
    raise exception 'Aucun établissement actif';
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      establishment_id = v_establishment_id,
      role = 'client'::public.user_role,
      is_active = true
  where id = p_user_id;

  if not found then
    raise exception 'Profil Client introuvable';
  end if;

  v_code := 'CLI-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
  insert into public.clients (establishment_id, code, full_name, phone, email)
  values (v_establishment_id, v_code, trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), lower(trim(p_email)))
  on conflict (code) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email;
end;
$$;

revoke all on function public.complete_client_account(uuid, text, text, text) from public;
grant execute on function public.complete_client_account(uuid, text, text, text) to authenticated;


-- Finalisation d'un compte Employé depuis le dashboard Super Admin.
create or replace function public.complete_employee_account(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_job_title text default 'Mécanicien'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment_id uuid;
  v_employee_id uuid;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès réservé au Super Admin';
  end if;

  select id into v_establishment_id from public.establishments where is_active = true order by created_at limit 1;
  if v_establishment_id is null then raise exception 'Aucun établissement actif'; end if;

  update public.profiles
  set full_name = trim(p_full_name), phone = nullif(trim(coalesce(p_phone, '')), ''), establishment_id = v_establishment_id, role = 'employee'::public.user_role, is_active = true
  where id = p_user_id;
  if not found then raise exception 'Profil Employé introuvable'; end if;

  insert into public.employees (establishment_id, profile_id, code, full_name, job_title, weekly_hours, active_permanent)
  values (v_establishment_id, p_user_id, 'EMP-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 8)), trim(p_full_name), trim(p_job_title), 40, true)
  returning id into v_employee_id;
end;
$$;

revoke all on function public.complete_employee_account(uuid, text, text, text, text) from public;
grant execute on function public.complete_employee_account(uuid, text, text, text, text) to authenticated;

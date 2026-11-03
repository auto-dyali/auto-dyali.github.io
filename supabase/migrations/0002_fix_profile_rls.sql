-- AUTO DYALI — Réparation RLS du profil Manager
-- À exécuter une fois dans Supabase SQL Editor sur une base déjà migrée.

-- Ces fonctions doivent lire le profil sans être bloquées par la policy
-- profiles_self_or_same_establishment, sinon la lecture du rôle du Manager
-- peut provoquer une récursion RLS.
create or replace function public.current_establishment_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select establishment_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.autoplus_current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_saas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.autoplus_current_role() = 'saas_admin'::public.user_role;
$$;

drop policy if exists profiles_self_or_same_establishment on public.profiles;
create policy profiles_self_or_same_establishment
  on public.profiles
  for select
  using (
    id = auth.uid()
    or establishment_id = public.current_establishment_id()
  );

drop policy if exists tenant_isolation on public.establishments;
create policy tenant_isolation
  on public.establishments
  for select
  using (
    id = public.current_establishment_id()
    or public.is_saas_admin()
  );

-- Vérification attendue après exécution : les deux lignes doivent apparaître.
select id, role, establishment_id
from public.profiles
where id in (
  '10c25c4e-4118-4a07-a488-2bc512c4fa1d'::uuid,
  '31b0ca43-413b-4559-ab93-bc0637e97bde'::uuid
);

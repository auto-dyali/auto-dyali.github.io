-- AUTO DYALI — Corrections finales Super Admin et accès
-- Ce script corrige les permissions après la migration 0006.

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
    or public.is_saas_admin()
  );

drop policy if exists tenant_isolation on public.establishments;
create policy tenant_isolation
  on public.establishments
  for select
  using (
    id = public.current_establishment_id()
    or public.is_saas_admin()
  );

drop policy if exists saas_admin_update_establishments on public.establishments;
create policy saas_admin_update_establishments
  on public.establishments
  for update
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant usage on schema public to authenticated;
grant select on public.establishments to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant execute on function public.get_my_profile() to authenticated;

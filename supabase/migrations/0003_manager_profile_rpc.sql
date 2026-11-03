-- AUTO DYALI — Lecture sécurisée du profil connecté
-- Cette fonction évite que la policy RLS de profiles bloque la connexion.

create or replace function public.get_my_profile()
returns table (
  role public.user_role,
  establishment_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.role, p.establishment_id
  from public.profiles as p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

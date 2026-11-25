-- =====================================================================
-- AUTO DYALI — RÉCONCILIATION 20261124 — Lecture des profils par le SA
-- CIBLE : STAGING yocufscgninxiihwiepa UNIQUEMENT.
--
-- Défauts reproduits le 24/11/2026 depuis l'interface Super Admin :
--   - la colonne « Manager » de la liste des abonnés affichait
--     « Aucun manager associé » pour les établissements créés via l'UI ;
--   - le tableau de bord affichait « 0 managers / 0 actifs » alors que
--     staging contient des dizaines de Managers actifs.
--
-- Cause : la seule policy SELECT sur public.profiles est
--   profiles_self_or_same_establishment (id = auth.uid() OU
--   establishment_id = current_establishment_id()). Un Super Admin n'a pas
--   d'établissement courant : il ne voit donc aucun profil Manager, et
--   l'embed PostgREST `establishments.profiles(*)` revient vide.
--
-- Correctif minimal : une policy SELECT supplémentaire, limitée aux
-- profils, réservée à is_saas_admin(). Aucune politique existante n'est
-- modifiée, aucune écriture n'est autorisée de plus (les policies UPDATE
-- existantes restent seules compétentes).
--
-- Idempotent. Hors supabase/migrations/ : jamais emporté par db push.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception 'ARRÊT : table public.profiles introuvable.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_saas_admin'
  ) then
    raise exception 'ARRÊT : fonction public.is_saas_admin() introuvable.';
  end if;
end $$;

drop policy if exists saas_admin_select_profiles on public.profiles;
create policy saas_admin_select_profiles on public.profiles
  for select to authenticated
  using (public.is_saas_admin());

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.profiles'::regclass
      and polname = 'saas_admin_select_profiles'
      and polcmd = 'r'
  ) then
    raise exception 'ÉCHEC : policy saas_admin_select_profiles absente.';
  end if;
  raise notice 'Réconciliation saas_admin_select_profiles — OK.';
end $$;

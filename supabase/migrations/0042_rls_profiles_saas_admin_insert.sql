-- =====================================================================
-- AUTO DYALI — 0042 (GV5 §87 bis) : RLS profiles — insertion Super Admin
-- STATUT : PRÉPARÉE — À APPLIQUER SUR STAGING UNIQUEMENT.
--
-- Objet :
--   La table public.profiles est protégée par RLS. La politique d'insertion
--   actuelle ne permet qu'à l'utilisateur connecté (auth.uid() = id) de
--   créer son propre profil. Un Super Admin ne peut donc pas créer un
--   profil Manager rattaché à un établissement, ce qui bloque le parcours
--   commercial complet (création garage + Manager + abonnement).
--
-- Cette migration ajoute une politique RLS permettant au saas_admin
-- d'insérer un profil pour n'importe quel établissement, avec vérification
-- du rôle via public.is_saas_admin(). Les opérations privilégiées restent
-- côté base de données, pas côté client.
--
-- Aucune donnée n'est supprimée. Aucun secret n'est manipulé.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT 0042: table profiles absente.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_saas_admin'
  ) then
    raise exception 'ARRÊT 0042: fonction is_saas_admin() absente.';
  end if;
  raise notice '0042 pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. Politique RLS : Super Admin peut insérer un profil pour tout établissement
-- ---------------------------------------------------------------------
drop policy if exists saas_admin_insert_profiles on public.profiles;
create policy saas_admin_insert_profiles on public.profiles
  for insert
  with check (public.is_saas_admin());

-- ---------------------------------------------------------------------
-- 2. Politique RLS : Super Admin peut mettre à jour tout profil
-- ---------------------------------------------------------------------
drop policy if exists saas_admin_update_profiles on public.profiles;
create policy saas_admin_update_profiles on public.profiles
  for update
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

-- ---------------------------------------------------------------------
-- 3. Vérification
-- ---------------------------------------------------------------------
do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public' and tablename='profiles' and policyname='saas_admin_insert_profiles';
  if v_count = 0 then
    raise exception 'ARRÊT 0042: politique saas_admin_insert_profiles absente.';
  end if;
  raise notice '0042 vérification OK : politique saas_admin_insert_profiles présente.';
end $$;

-- FIN 0042

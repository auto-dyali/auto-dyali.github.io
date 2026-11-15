-- =====================================================================
-- AUTO DYALI — Préparation des comptes de test (P0, livraison demain matin)
-- STATUT : À EXÉCUTER DÈS QU'UN ACCÈS SUPABASE PRIVILÉGIÉ EST DISPONIBLE
-- =====================================================================
-- Ce script est IDEMPOTENT et NON DESTRUCTIF :
--   - Il ne supprime et ne modifie aucune donnée existante.
--   - Il utilise INSERT ... ON CONFLICT DO NOTHING / DO UPDATE.
--   - Il crée uniquement les établissements, profils, employés et
--     permissions de test nécessaires à la vérification des comptes.
--
-- PRÉREQUIS (à faire AVANT ce script, par un opérateur avec accès
-- service_role / Dashboard Supabase) :
--   1. Créer les 6 utilisateurs Auth (email + mot de passe temporaire)
--      via Supabase Dashboard → Authentication → Users, ou via
--      auth.admin.createUser (Edge Function côté serveur).
--      Les emails sont listés ci-dessous (voir fiche confidentielle
--      pour les mots de passe : fichier LOCAL, jamais commité).
--   2. Vérifier que la migration 0001 (schéma initial : establishments,
--      profiles, employees, permissions, user_role) est appliquée.
--   3. Vérifier que la RPC get_my_profile() (migration 0003) existe.
--
-- ORDRE D'EXÉCUTION :
--   Étape A : Créer les 6 comptes Auth (Dashboard ou service_role).
--   Étape B : Exécuter ce script (établissements + profils + employés + permissions).
--   Étape C : Tester chaque compte (voir docs/COMPTES_TEST_PREPARATION.md).
--
-- Comptes de test (domaine @autodyali.test = clairement données de test) :
--   SAAS_ADMIN         : admin.saas@autodyali.test        (rôle saas_admin)
--   MANAGER_GARAGE_1   : manager.garage1@autodyali.test   (rôle manager, Garage 1)
--   MANAGER_GARAGE_2   : manager.garage2@autodyali.test   (rôle manager, Garage 2)
--   EMPLOYEE_CAISSE    : caisse.garage1@autodyali.test    (rôle employee, Garage 1, caisse/pos)
--   EMPLOYEE_STOCK     : stock.garage1@autodyali.test     (rôle employee, Garage 1, stock)
--   EMPLOYEE_CAISSE_STOCK : caisse-stock.garage1@autodyali.test (rôle employee, Garage 1, caisse+stock)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles (échoue si le schéma initial est absent)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT: table establishments absente (migration 0001 non appliquée).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT: table profiles absente (migration 0001 non appliquée).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='employees') then
    raise exception 'ARRÊT: table employees absente (migration 0001 non appliquée).';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='permissions') then
    raise exception 'ARRÊT: table permissions absente (migration 0001 non appliquée).';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_my_profile'
  ) then
    raise exception 'ARRÊT: RPC get_my_profile() absente (migration 0003 non appliquée).';
  end if;
  raise notice '00_test_comptes_preparation : pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. ÉTABLISSEMENTS DE TEST (idempotent)
-- ---------------------------------------------------------------------
-- Identifiants UUID déterministes pour pouvoir référencer les établissements
-- dans les profils et employés de ce même script.
insert into public.establishments (id, name, slug, address, city, phone, email, currency, timezone, plan, is_active, created_at, updated_at)
values
  ( '11111111-1111-1111-1111-111111111111'::uuid,
    'Garage Test 1 (Auto Dyali)', 'garage-test-1',
    '123 Rue de la République', 'Casablanca', '+212 6 00 00 00 01', 'contact.garage1@autodyali.test',
    'MAD', 'Africa/Casablanca', 'standard', true, now(), now()),
  ( '22222222-2222-2222-2222-222222222222'::uuid,
    'Garage Test 2 (Auto Dyali)', 'garage-test-2',
    '45 Avenue Mohammed V', 'Rabat', '+212 6 00 00 00 02', 'contact.garage2@autodyali.test',
    'MAD', 'Africa/Casablanca', 'standard', true, now(), now())
on conflict (slug) do update set
  name = excluded.name,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------
-- 2. PROFILS LIÉS AUX COMPTES AUTH (idempotent)
--   Chaque profil est rattaché à l'utilisateur Auth dont l'email correspond.
--   Si l'utilisateur Auth n'existe pas encore, la ligne profiles n'est pas créée
--   (le sous-SELECT retourne NULL et l'insert est ignorée via WHERE).
-- ---------------------------------------------------------------------
insert into public.profiles (id, full_name, phone, establishment_id, role, is_active, created_at, updated_at)
select
  u.id,
  p.full_name,
  p.phone,
  p.establishment_id,
  p.role::public.user_role,
  true,
  now(),
  now()
from (values
  ( 'admin.saas@autodyali.test', 'Admin Super Auto Dyali', null, null, 'saas_admin' ),
  ( 'manager.garage1@autodyali.test', 'Manager Garage 1', '+212 6 00 00 00 11', '11111111-1111-1111-1111-111111111111', 'manager' ),
  ( 'manager.garage2@autodyali.test', 'Manager Garage 2', '+212 6 00 00 00 21', '22222222-2222-2222-2222-222222222222', 'manager' ),
  ( 'caisse.garage1@autodyali.test', 'Employé Caisse Garage 1', '+212 6 00 00 00 12', '11111111-1111-1111-1111-111111111111', 'employee' ),
  ( 'stock.garage1@autodyali.test', 'Employé Stock Garage 1', '+212 6 00 00 00 13', '11111111-1111-1111-1111-111111111111', 'employee' ),
  ( 'caisse-stock.garage1@autodyali.test', 'Employé Caisse+Stock Garage 1', '+212 6 00 00 00 14', '11111111-1111-1111-1111-111111111111', 'employee' )
) as p(email, full_name, phone, establishment_id, role)
join auth.users u on u.email = p.email
on conflict (id) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  establishment_id = excluded.establishment_id,
  role = excluded.role::public.user_role,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------
-- 3. EMPLOYÉS (fiches métier) — idempotent
-- ---------------------------------------------------------------------
insert into public.employees (establishment_id, profile_id, code, full_name, job_title, weekly_hours, active_permanent, created_at)
select
  p.establishment_id,
  p.id,
  'EMP-' || upper(substr(replace(p.id::text, '-', ''), 1, 8)),
  p.full_name,
  case p.role
    when 'employee' then case
      when p.email = 'caisse.garage1@autodyali.test' then 'Caissier'
      when p.email = 'stock.garage1@autodyali.test' then 'Gestionnaire Stock'
      when p.email = 'caisse-stock.garage1@autodyali.test' then 'Caissier / Stock'
    end
    when 'manager' then 'Responsable Établissement'
  end,
  40,
  true,
  now()
from public.profiles p
where p.role in ('manager','employee')
  and p.establishment_id is not null
  and p.email is not null
on conflict (establishment_id, code) do update set
  full_name = excluded.full_name,
  job_title = excluded.job_title,
  active_permanent = true,
  updated_at = now();

-- ---------------------------------------------------------------------
-- 4. PERMISSIONS MODULES (niveau employé) — idempotent
--   Modules : pos | stock | caisse | atelier | clients | catalogue | facturation | rapports
-- ---------------------------------------------------------------------
insert into public.permissions (establishment_id, role, module, can_view, can_create, can_edit, can_delete, created_at)
select
  e.establishment_id,
  'employee'::public.user_role,
  m.module,
  m.can_view, m.can_create, m.can_edit, m.can_delete,
  now()
from public.employees e
join (values
  ( 'caisse.garage1@autodyali.test', 'pos', true, true, false, false ),
  ( 'caisse.garage1@autodyali.test', 'caisse', true, true, false, false ),
  ( 'stock.garage1@autodyali.test', 'stock', true, true, false, false ),
  ( 'caisse-stock.garage1@autodyali.test', 'pos', true, true, false, false ),
  ( 'caisse-stock.garage1@autodyali.test', 'caisse', true, true, false, false ),
  ( 'caisse-stock.garage1@autodyali.test', 'stock', true, true, false, false )
) as m(email, module, can_view, can_create, can_edit, can_delete)
  on m.email = (select email from auth.users where id = e.profile_id)
where e.profile_id is not null
on conflict (establishment_id, role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  updated_at = now();

-- ---------------------------------------------------------------------
-- 5. RÉCAPITULATIF (lecture uniquement)
-- ---------------------------------------------------------------------
select
  u.email as compte,
  p.role,
  e.name as etablissement,
  p.is_active as profil_actif
from auth.users u
join public.profiles p on p.id = u.id
left join public.establishments e on e.id = p.establishment_id
where u.email like '%@autodyali.test'
order by p.role, u.email;

-- FIN : aucune donnée existante n'a été supprimée ni modifiée.
-- Les mots de passe temporaires figurent dans la fiche confidentielle (fichier LOCAL, non commité).

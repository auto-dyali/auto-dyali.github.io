-- =====================================================================
-- AUTO DYALI — 0041 (GV5 §87) : Ajout colonne updated_at sur subscriptions
-- STATUT : PRÉPARÉE — À APPLIQUER SUR STAGING UNIQUEMENT.
--
-- Objet :
--   La fonction admin_set_subscription (migration 0040) effectue un UPDATE
--   sur public.subscriptions. Un trigger ou une contrainte de schéma tente
--   de mettre à jour updated_at, mais cette colonne n'existe pas dans la
--   table, provoquant une erreur 42703 (colonne introuvable).
--
-- Cette migration ajoute la colonne updated_at sur subscriptions (et
-- establishments si absente) pour permettre le fonctionnement correct
-- des RPC de gestion d'abonnement.
--
-- Aucune donnée n'est supprimée. Aucun secret n'est manipulé.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='subscriptions') then
    raise exception 'ARRÊT 0041: table subscriptions absente.';
  end if;
  raise notice '0041 pré-contrôles OK.';
end $$;

-- ---------------------------------------------------------------------
-- 1. Colonne updated_at sur subscriptions
-- ---------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- 2. Colonne updated_at sur establishments (si absente, pour cohérence)
-- ---------------------------------------------------------------------
alter table public.establishments
  add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- 3. Vérification
-- ---------------------------------------------------------------------
do $$
declare v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public' and table_name='subscriptions' and column_name='updated_at';
  if v_count = 0 then
    raise exception 'ARRÊT 0041: colonne updated_at toujours absente sur subscriptions.';
  end if;
  raise notice '0041 vérification OK : updated_at présente sur subscriptions.';
end $$;

-- FIN 0041

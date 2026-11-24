-- =====================================================================
-- AUTO DYALI — 0038 : Sécurité RLS et index (préparée, NON APPLIQUÉE)
--
-- Cible : corriger les anomalies de sécurité et de performance identifiées
-- dans l'audit GV5 §46 :
--   A5. Politiques RLS permissives multiples sur `audit_log` et `establishments`
--   A6. Clés étrangères sans index (61 fkeys non couvertes)
--
-- PRÉREQUIS OBLIGATOIRES (avant exécution distante) :
--   1) Sauvegarde/PITR vérifiée et exploitable.
--   2) Audit read-only de l'état réel (définitions, politiques RLS existantes,
--      index existants).
--   3) Autorisation explicite (levée ciblée gel P0).
--   4) Exécution contrôlée via SQL Editor (rôle owner/service role).
--
-- NE PAS supprimer de données. NE PAS modifier les données métier existantes.
-- Aucune clé secrète n'est manipulée dans ce fichier.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pré-contrôles (échoue si dépendances critiques absentes)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='audit_log') then
    raise exception 'ARRÊT 0038: table audit_log absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT 0038: table establishments absente.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'ARRÊT 0038: table profiles absente.';
  end if;
  raise notice '0038 pré-contrôles OK (dépendances présentes).';
end $$;

-- ---------------------------------------------------------------------
-- 1. Consolidation des politiques RLS sur audit_log
--    (anomalie A5 : 4 politiques multiples, dont 3 en commande * ou a)
--    On conserve uniquement les politiques nécessaires et on supprime les
--    politiques redondantes ou trop larges.
-- ---------------------------------------------------------------------
-- Politique de lecture tenant-only (remplace tenant_select_audit_log si elle existe déjà)
drop policy if exists tenant_select_audit_log on public.audit_log;

create policy tenant_select_audit_log on public.audit_log
  for select
  using (establishment_id = public.current_establishment_id() or public.is_saas_admin());

-- Politique d'insertion réservée à saas_admin et manager (remplace managers_insert_audit_log)
drop policy if exists managers_insert_audit_log on public.audit_log;

create policy managers_insert_audit_log on public.audit_log
  for insert
  with check (public.is_saas_admin() or public.is_manager());

-- Politique de modification complète réservée à saas_admin (remplace saas_admin_all_audit_log)
drop policy if exists saas_admin_all_audit_log on public.audit_log;

create policy saas_admin_all_audit_log on public.audit_log
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

-- Politique tenant_isolation supprimée car redondante avec tenant_select_audit_log pour la lecture
-- et saas_admin_all_audit_log pour l'écriture. On la supprime pour éviter les politiques multiples.
drop policy if exists tenant_isolation on public.audit_log;

-- ---------------------------------------------------------------------
-- 2. Consolidation des politiques RLS sur establishments
--    (anomalie A5 : 5 politiques multiples)
--    On conserve uniquement les politiques nécessaires.
-- ---------------------------------------------------------------------
-- Politique de lecture : tenant seulement (saas_admin voit tout via saas_admin_full_access)
drop policy if exists tenant_isolation on public.establishments;

create policy tenant_isolation on public.establishments
  for select
  using (id = public.current_establishment_id());

-- Politique d'insertion réservée à saas_admin
drop policy if exists saas_admin_insert_establishments on public.establishments;

create policy saas_admin_insert_establishments on public.establishments
  for insert
  with check (public.is_saas_admin());

-- Politique de modification réservée à saas_admin
drop policy if exists saas_admin_update_establishments on public.establishments;

create policy saas_admin_update_establishments on public.establishments
  for update
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

-- Politique d'accès complet réservée à saas_admin (remplace saas_admin_full_access)
drop policy if exists saas_admin_full_access on public.establishments;

create policy saas_admin_full_access on public.establishments
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

-- ---------------------------------------------------------------------
-- 3. Index sur les clés étrangères non couvertes (anomalie A6)
--    Index sur les colonnes establishment_id (fréquemment utilisées pour l'isolation
--    multi-tenant) et autres FK critiques.
-- ---------------------------------------------------------------------
create index if not exists idx_appointments_establishment_id on public.appointments (establishment_id);
create index if not exists idx_attendance_establishment_id on public.attendance (establishment_id);
create index if not exists idx_audit_log_establishment_id on public.audit_log (establishment_id);
create index if not exists idx_audit_log_actor_id on public.audit_log (actor_id);
create index if not exists idx_cash_sessions_establishment_id on public.cash_sessions (establishment_id);
create index if not exists idx_client_notifications_establishment_id on public.client_notifications (establishment_id);
create index if not exists idx_clients_establishment_id on public.clients (establishment_id);
create index if not exists idx_employees_establishment_id on public.employees (establishment_id);
create index if not exists idx_expenses_establishment_id on public.expenses (establishment_id);
create index if not exists idx_inventory_counts_establishment_id on public.inventory_counts (establishment_id);
create index if not exists idx_invoices_establishment_id on public.invoices (establishment_id);
create index if not exists idx_maintenance_reminders_establishment_id on public.maintenance_reminders (establishment_id);
create index if not exists idx_payments_establishment_id on public.payments (establishment_id);
create index if not exists idx_permissions_establishment_id on public.permissions (establishment_id);
create index if not exists idx_product_lots_establishment_id on public.product_lots (establishment_id);
create index if not exists idx_products_establishment_id on public.products (establishment_id);
create index if not exists idx_purchase_order_items_establishment_id on public.purchase_order_items (establishment_id);
create index if not exists idx_purchase_orders_establishment_id on public.purchase_orders (establishment_id);
create index if not exists idx_sale_items_establishment_id on public.sale_items (establishment_id);
create index if not exists idx_sales_establishment_id on public.sales (establishment_id);
create index if not exists idx_services_establishment_id on public.services (establishment_id);
create index if not exists idx_stock_movements_establishment_id on public.stock_movements (establishment_id);
create index if not exists idx_subscriptions_establishment_id on public.subscriptions (establishment_id);
create index if not exists idx_subscriptions_audit_establishment_id on public.subscriptions_audit (establishment_id);
create index if not exists idx_suppliers_establishment_id on public.suppliers (establishment_id);
create index if not exists idx_support_tickets_establishment_id on public.support_tickets (establishment_id);
-- ticket_messages n'a pas de colonne establishment_id (relation via ticket_id).
create index if not exists idx_ticket_messages_ticket_id on public.ticket_messages (ticket_id);
create index if not exists idx_vehicles_establishment_id on public.vehicles (establishment_id);
create index if not exists idx_work_order_tasks_establishment_id on public.work_order_tasks (establishment_id);
create index if not exists idx_work_orders_establishment_id on public.work_orders (establishment_id);

-- ---------------------------------------------------------------------
-- 4. Journalisation de l'opération de durcissement
-- ---------------------------------------------------------------------
insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
values (
  null,
  auth.uid(),
  'security_hardening_p0_phase2',
  'system',
  null,
  jsonb_build_object(
    'action', 'consolidate_rls_policies_and_add_indexes',
    'tables_consolidated', ARRAY['audit_log', 'establishments'],
    'indexes_added', 29,
    'rationale', 'Supprimer les politiques RLS multiples redondantes et ajouter des index sur les clés étrangères pour l isolation multi-tenant et la performance.'
  )
);

-- =====================================================================
-- FIN 0038 (préparée). À appliquer uniquement après sauvegarde vérifiée
-- et autorisation explicite, via SQL Editor (rôle owner ou service role).
-- =====================================================================

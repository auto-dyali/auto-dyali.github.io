-- GV5 §61 — 005_fk_index_recommendations.sql
-- STATUT : RECOMMANDATIONS — NON EXÉCUTÉ. Aucun CREATE INDEX distant.
-- Périmètre SUPER ADMIN uniquement : index utiles aux tables du portail SA.
-- Les FK des modules garages (POS/stock/atelier) sont hors périmètre.

-- Recommandations (non destructives, CREATE INDEX CONCURRENTLY en production) :
-- 1. audit_log.establishment_id — filtrage journal par établissement
-- create index concurrently if not exists audit_log_establishment_idx
--   on public.audit_log (establishment_id);

-- 2. profiles.establishment_id — isolation / helpers current_establishment_id
-- create index concurrently if not exists profiles_establishment_idx
--   on public.profiles (establishment_id);

-- 3. support_tickets.establishment_id — file tickets SA
-- create index concurrently if not exists support_tickets_establishment_idx
--   on public.support_tickets (establishment_id);

-- 4. crm_leads.owner_id — CRM commercial SA
-- create index concurrently if not exists crm_leads_owner_idx
--   on public.crm_leads (owner_id);

-- 5. subscriptions.plan_code — répartition formules / KPI dashboard
-- create index concurrently if not exists subscriptions_plan_code_idx
--   on public.subscriptions (plan_code);

-- Justification : accélère SELECT filtrés par establishment_id/plan utilisés
-- par les RLS et les requêtes Super Admin. Faible volume de données actuel
-- (2 établissements) => impact performance limité mais index peu coûteux.
-- CREATE INDEX CONCURRENTLY nécessite autocommit (pas dans une transaction).

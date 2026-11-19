-- ROLLBACK GV5 §79 / 003 — retire le journal Stripe et la RPC associée.
-- Les événements déjà reçus seraient supprimés : n'exécuter que sur décision
-- explicite et après export des preuves de paiement.

drop function if exists public.admin_record_billing_event(text,text,uuid,uuid,numeric,text,text,jsonb);
drop policy if exists saas_billing_events_saas_admin on public.saas_billing_events;
drop table if exists public.saas_billing_events;

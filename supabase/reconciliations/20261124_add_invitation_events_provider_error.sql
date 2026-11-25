-- =====================================================================
-- AUTO DYALI — RÉCONCILIATION 20261124 — Journalisation des invitations
-- CIBLE : STAGING yocufscgninxiihwiepa UNIQUEMENT.
--
-- Défaut reproduit le 24/11/2026 depuis l'interface Super Admin :
--   « Envoyer / Renvoyer » -> Edge Function send-invitation (HTTP 200) mais
--   admin_record_delivery échoue :
--   column "provider_error" of relation "invitation_events" does not exist.
--
-- La migration locale 0036 contient bien la colonne, mais l'historique
-- distant de staging est ad hoc et ne l'a jamais appliquée.
--
-- Idempotent, aucune donnée supprimée. Hors supabase/migrations/ :
-- jamais emporté par un `supabase db push`.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invitation_events'
  ) then
    raise exception 'ARRÊT : table public.invitation_events introuvable.';
  end if;
end $$;

alter table public.invitation_events
  add column if not exists provider_error text;

-- Contrôle post-application : la RPC d'enregistrement doit pouvoir écrire.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invitation_events'
      and column_name = 'provider_error'
  ) then
    raise exception 'ÉCHEC : provider_error toujours absent.';
  end if;
  raise notice 'Réconciliation provider_error — OK.';
end $$;

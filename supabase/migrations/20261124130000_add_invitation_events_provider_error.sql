-- AUTO DYALI — Migration versionnée du correctif GV5 §102 (commit fc20a1b).
-- Garantit la colonne utilisée par admin_record_delivery() pour tracer les
-- erreurs des fournisseurs e-mail/WhatsApp.
--
-- Idempotente : peut être rejouée sur une base où la colonne existe déjà
-- (staging, où le correctif a été appliqué via une réconciliation dédiée).
-- Aucune donnée supprimée, aucune politique modifiée.

alter table public.invitation_events
  add column if not exists provider_error text;

comment on column public.invitation_events.provider_error is
  'Erreur retournée par le fournisseur lors de la transmission (jamais un jeton).';

-- AUTO DYALI — 0017 : Notifications clients multi-canal
-- Canal : in-app (toujours), whatsapp (lien direct wa.me / API future), email.
-- Le journal des envois est conservé pour ne jamais simuler un envoi.

alter table public.client_notifications
  add column if not exists channel text not null default 'inapp'
        check (channel in ('inapp','whatsapp','email')),
  add column if not exists sent_at timestamptz,
  add column if not exists error text; -- motif si l'envoi a échoué (référence)

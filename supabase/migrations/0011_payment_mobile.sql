-- AUTO DYALI — 0011 : Paiement mobile money (espèces mobiles Maroc)
-- Étend l'enum payment_method sans migration destructive.

alter type public.payment_method add value if not exists 'mobile';

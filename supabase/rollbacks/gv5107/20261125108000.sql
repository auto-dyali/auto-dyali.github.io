-- Retour arrière de la corrective n°8 (sans perte de données).
drop function if exists public.gen_invitation_token();
drop function if exists public.hash_invitation_token(text);

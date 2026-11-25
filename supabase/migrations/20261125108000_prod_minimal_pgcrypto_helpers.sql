-- AUTO DYALI — GV5 §107 — migration CORRECTIVE n°8.
-- Cause : pgcrypto est installé dans le schéma `extensions` sur Supabase Free.
-- Les helpers créés par 20261125100000 n'ont pas de `search_path` propre :
-- `gen_random_bytes()` / `digest()` sont résolus à l'exécution avec le
-- search_path de l'appelant (`"$user", public`) et échouent en PGRST.
-- Correctif : définitions explicites, schéma qualifié, aucun SECURITY DEFINER,
-- aucun droit supplémentaire. Additive, idempotente, réversible.

create or replace function public.gen_invitation_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

revoke all on function public.gen_invitation_token() from public;

create or replace function public.hash_invitation_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hash_invitation_token(text) from public;
revoke all on function public.hash_invitation_token(text) from anon;
grant execute on function public.hash_invitation_token(text) to authenticated, service_role;

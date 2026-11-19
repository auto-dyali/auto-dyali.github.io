-- GV5 §76 — Correctif de sécurité CRITIQUE (STAGING, puis production sur autorisation)
--
-- Faille reproduite : un utilisateur AUTHENTIFIÉ SANS PROFIL avait
-- autoplus_current_role() = NULL, donc is_saas_admin() = NULL.
-- Dans un `if not is_saas_admin() then raise ...`, NOT NULL = NULL,
-- donc le garde-fou ne déclenchait PAS : lecture de fiche et écriture des
-- permissions étaient possibles pour un non-admin.
--
-- Correctif : is_saas_admin() renvoie TOUJOURS un booléen (coalesce) et
-- vérifie aussi is_active. Aucun appel légitime Super Admin n'est affecté.
--
-- Preuve après correction : non-admin -> 400 « Accès refusé. » ; SA -> 200.

create or replace function public.is_saas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'saas_admin' and p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Surcharge obsolète (12 paramètres) remplacée en §75 par la version 18
-- paramètres. Sa présence rendait l'appel RPC ambigu (PGRST203) et élargissait
-- la surface d'attaque. Aucune référence applicative ne l'utilise.
drop function if exists public.admin_update_establishment(uuid, text, text, text, text, text, text, text, text, text, text, text);

revoke execute on function public.is_saas_admin() from anon;
grant execute on function public.is_saas_admin() to authenticated;

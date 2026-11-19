-- AUTO DYALI — GV5 §75 — Champs administratifs dédiés (STAGING uniquement)
-- Réversible : voir 002_down.sql. Aucune donnée existante n'est modifiée.
-- Les colonnes sont NULL par défaut : les anciennes fiches restent lisibles.

alter table public.establishments
  add column if not exists country text,
  add column if not exists legal_info text,
  add column if not exists fiscal_info text,
  add column if not exists admin_info text,
  add column if not exists dossier_state text,
  add column if not exists complementary_contacts text;

comment on column public.establishments.country is 'GV5 §75 — Pays de l''établissement (champ dédié, hors notes).';
comment on column public.establishments.legal_info is 'GV5 §75 — Informations juridiques structurées.';
comment on column public.establishments.fiscal_info is 'GV5 §75 — Informations fiscales structurées.';
comment on column public.establishments.admin_info is 'GV5 §75 — Informations administratives structurées.';
comment on column public.establishments.dossier_state is 'GV5 §75 — État du dossier administratif.';
comment on column public.establishments.complementary_contacts is 'GV5 §75 — Coordonnées complémentaires structurées.';

-- Version étendue de la RPC d'édition (remplace la version 12 paramètres).
create or replace function public.admin_update_establishment(
  p_id uuid,
  p_name text,
  p_legal_name text,
  p_slug text,
  p_activity_type text,
  p_address text,
  p_city text,
  p_region text,
  p_phone text,
  p_email text,
  p_notes text,
  p_professional_id text,
  p_country text default null,
  p_legal_info text default null,
  p_fiscal_info text default null,
  p_admin_info text default null,
  p_dossier_state text default null,
  p_complementary_contacts text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avant jsonb;
  v_conflit uuid;
begin
  if not public.is_saas_admin() then raise exception 'Accès refusé.'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Le nom commercial est obligatoire.'; end if;
  if nullif(btrim(coalesce(p_slug, '')), '') is null then raise exception 'Le slug est obligatoire.'; end if;
  if p_email is not null and btrim(p_email) <> '' and btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  select to_jsonb(e) into v_avant from public.establishments e where e.id = p_id;
  if v_avant is null then raise exception 'Établissement introuvable.'; end if;

  select e.id into v_conflit from public.establishments e where e.slug = btrim(p_slug) and e.id <> p_id limit 1;
  if v_conflit is not null then raise exception 'Ce slug est déjà utilisé par un autre établissement.'; end if;
  if nullif(btrim(coalesce(p_professional_id, '')), '') is not null then
    select e.id into v_conflit from public.establishments e
      where e.professional_id = btrim(p_professional_id) and e.id <> p_id limit 1;
    if v_conflit is not null then raise exception 'Cet identifiant professionnel est déjà utilisé.'; end if;
  end if;

  update public.establishments set
    name = btrim(p_name),
    legal_name = nullif(btrim(coalesce(p_legal_name, '')), ''),
    slug = btrim(p_slug),
    activity_type = nullif(btrim(coalesce(p_activity_type, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    city = nullif(btrim(coalesce(p_city, '')), ''),
    region = nullif(btrim(coalesce(p_region, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    professional_id = nullif(btrim(coalesce(p_professional_id, '')), ''),
    country = nullif(btrim(coalesce(p_country, '')), ''),
    legal_info = nullif(btrim(coalesce(p_legal_info, '')), ''),
    fiscal_info = nullif(btrim(coalesce(p_fiscal_info, '')), ''),
    admin_info = nullif(btrim(coalesce(p_admin_info, '')), ''),
    dossier_state = nullif(btrim(coalesce(p_dossier_state, '')), ''),
    complementary_contacts = nullif(btrim(coalesce(p_complementary_contacts, '')), ''),
    updated_at = now()
  where id = p_id;

  insert into public.audit_log (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values (p_id, auth.uid(), 'update_establishment', 'establishment', p_id,
          jsonb_build_object('avant', v_avant - 'updated_at', 'champs',
            jsonb_build_object('name', btrim(p_name), 'slug', btrim(p_slug), 'country', nullif(btrim(coalesce(p_country, '')), ''))));

  return jsonb_build_object('ok', true, 'id', p_id);
end; $$;

revoke all on function public.admin_update_establishment(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.admin_update_establishment(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

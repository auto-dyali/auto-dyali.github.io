-- AUTO DYALI — GV5 — Migration ADDITIVE : notifications du Super Admin.
-- Cible : environnements de test ; APPLICATION PRODUCTION INTERDITE SANS GO.
-- Aucune table existante n'est modifiée, aucune donnée n'est supprimée.
-- Compatible Supabase Free (PostgreSQL standard, pas de fonctionnalité Pro).

create table if not exists public.super_admin_notifications (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  source_request_id   text not null,
  title               text not null,
  body                text not null,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  read_at             timestamptz,
  inapp_status        text not null default 'enregistre'
                      check (inapp_status in ('enregistre', 'indisponible')),
  email_status        text not null default 'non_configure'
                      check (email_status in ('non_demande', 'non_configure', 'en_attente', 'accepte_par_fournisseur', 'echec')),
  whatsapp_status     text not null default 'non_configure'
                      check (whatsapp_status in ('non_demande', 'non_configure', 'en_attente', 'accepte_par_fournisseur', 'echec')),
  email_ref           text,
  whatsapp_ref        text,
  last_error          text,
  updated_at          timestamptz not null default now()
);

-- Idempotence : une seule notification par création, même si l'EF rejoue.
create unique index if not exists super_admin_notifications_source_request_id_key
  on public.super_admin_notifications (source_request_id);

create index if not exists super_admin_notifications_created_at_idx
  on public.super_admin_notifications (created_at desc);

alter table public.super_admin_notifications enable row level security;

-- Aucun accès client direct : ni anon, ni Manager, ni garages tiers.
revoke all on table public.super_admin_notifications from public, anon, authenticated;
grant select, update on table public.super_admin_notifications to authenticated;
grant all on table public.super_admin_notifications to service_role;

drop policy if exists super_admin_notifications_sa_select on public.super_admin_notifications;
create policy super_admin_notifications_sa_select on public.super_admin_notifications
  for select to authenticated
  using (public.is_saas_admin());

drop policy if exists super_admin_notifications_sa_update on public.super_admin_notifications;
create policy super_admin_notifications_sa_update on public.super_admin_notifications
  for update to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

-- Insertion réservée à la RPC sécurisée (service_role). Aucune policy INSERT.
create or replace function public.admin_notify_new_subscriber(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request text;
  v_title text;
  v_body text;
  v_email text;
  v_whatsapp text;
  v_id uuid;
  v_insere boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Accès refusé : service_role requis.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload de notification invalide.';
  end if;

  v_request := nullif(btrim(coalesce(p_payload->>'source_request_id', '')), '');
  if v_request is null or length(v_request) > 120 then
    raise exception 'source_request_id invalide (1 à 120 caractères).';
  end if;

  v_title := coalesce(nullif(btrim(coalesce(p_payload->>'title', '')), ''), 'Nouvel abonné');
  v_body := coalesce(nullif(btrim(coalesce(p_payload->>'body', '')), ''), 'Création enregistrée.');
  v_email := coalesce(nullif(p_payload->>'email_status', ''), 'non_configure');
  v_whatsapp := coalesce(nullif(p_payload->>'whatsapp_status', ''), 'non_configure');

  if v_email not in ('non_demande','non_configure','en_attente','accepte_par_fournisseur','echec')
     or v_whatsapp not in ('non_demande','non_configure','en_attente','accepte_par_fournisseur','echec') then
    raise exception 'Statut de canal invalide : aucun succès de livraison ne peut être déclaré.';
  end if;

  insert into public.super_admin_notifications (
    source_request_id, title, body, payload,
    email_status, whatsapp_status, email_ref, whatsapp_ref, last_error
  ) values (
    v_request, v_title, v_body, p_payload,
    v_email, v_whatsapp,
    nullif(p_payload->>'email_ref', ''), nullif(p_payload->>'whatsapp_ref', ''),
    nullif(p_payload->>'last_error', '')
  )
  on conflict (source_request_id) do update
    set title = excluded.title,
        body = excluded.body,
        payload = excluded.payload,
        email_status = case when excluded.email_status in ('non_configure','non_demande')
                            then public.super_admin_notifications.email_status
                            else excluded.email_status end,
        whatsapp_status = case when excluded.whatsapp_status in ('non_configure','non_demande')
                               then public.super_admin_notifications.whatsapp_status
                               else excluded.whatsapp_status end,
        email_ref = coalesce(excluded.email_ref, public.super_admin_notifications.email_ref),
        whatsapp_ref = coalesce(excluded.whatsapp_ref, public.super_admin_notifications.whatsapp_ref),
        last_error = excluded.last_error,
        updated_at = now()
  returning id, (xmax = 0) into v_id, v_insere;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'idempotent', not v_insere,
    'inapp_status', 'enregistre'
  );
end;
$$;

revoke all on function public.admin_notify_new_subscriber(jsonb) from public, anon, authenticated;
grant execute on function public.admin_notify_new_subscriber(jsonb) to service_role;

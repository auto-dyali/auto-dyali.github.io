-- AUTO DYALI — GV5 §103 — Renouvellement d'une invitation RÉVOQUÉE.
--
-- Décision de sécurité : on ne ressuscite jamais une invitation annulée.
-- Une NOUVELLE invitation est créée, avec un nouveau jeton (seul son hash est
-- stocké) ; l'ancien lien reste invalide car l'ancienne ligne reste
-- `cancelled` et son token_hash n'est pas modifié.
--
-- Appelé par la Edge Function send-invitation (session Super Admin réelle,
-- vérifiée côté base par is_saas_admin()). Idempotent : CREATE OR REPLACE.

create or replace function public.admin_create_invitation_renewal(
  p_old_invitation_id uuid,
  p_token_hash text,
  p_request_id text,
  p_expires_at timestamptz,
  p_channels text[]
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old public.invitations%rowtype;
  v_new_id uuid;
  v_expires timestamptz;
begin
  if not public.is_saas_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;
  if p_old_invitation_id is null or nullif(btrim(coalesce(p_request_id, '')), '') is null then
    raise exception 'Paramètres de renouvellement incomplets.';
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Empreinte de jeton invalide.';
  end if;

  select * into v_old from public.invitations where id = p_old_invitation_id for update;
  if not found then
    raise exception 'Invitation introuvable.';
  end if;
  if v_old.status = 'accepted' then
    raise exception 'Invitation déjà acceptée : renouvellement impossible.';
  end if;
  if v_old.status <> 'cancelled' then
    raise exception 'Renouvellement réservé à une invitation révoquée.';
  end if;
  if v_old.last_request_id = p_request_id then
    raise exception 'Demande de renouvellement déjà traitée.';
  end if;
  if exists (select 1 from public.invitations where token_hash = p_token_hash) then
    raise exception 'Empreinte de jeton déjà utilisée.';
  end if;

  v_expires := coalesce(p_expires_at, now() + interval '7 days');

  insert into public.invitations (
    token_hash, email, manager_user_id, establishment_id, manager_full_name,
    manager_phone, plan_code, status, email_status, whatsapp_status,
    expires_at, last_request_id
  ) values (
    p_token_hash, v_old.email, v_old.manager_user_id, v_old.establishment_id,
    v_old.manager_full_name, v_old.manager_phone, v_old.plan_code, 'prepared',
    case when 'email' = any(coalesce(p_channels, '{}'::text[])) then 'en_attente' else 'non_demande' end,
    case when 'whatsapp' = any(coalesce(p_channels, '{}'::text[])) then 'en_attente' else 'non_demande' end,
    v_expires, p_request_id
  ) returning id into v_new_id;

  update public.invitations
     set last_request_id = p_request_id, updated_at = now()
   where id = v_old.id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  select v_new_id, canal, 'resent',
         jsonb_build_object('request_id', p_request_id, 'from_invitation_id', v_old.id)
    from unnest(coalesce(p_channels, '{}'::text[])) as canal
   where canal in ('email', 'whatsapp');

  return jsonb_build_object(
    'invitation_id', v_new_id,
    'old_invitation_id', v_old.id,
    'status', 'prepared',
    'expires_at', v_expires
  );
end $$;

revoke all on function public.admin_create_invitation_renewal(uuid, text, text, timestamptz, text[]) from public;
revoke all on function public.admin_create_invitation_renewal(uuid, text, text, timestamptz, text[]) from anon;
grant execute on function public.admin_create_invitation_renewal(uuid, text, text, timestamptz, text[]) to authenticated, service_role;

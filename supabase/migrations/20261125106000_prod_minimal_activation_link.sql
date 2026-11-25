-- AUTO DYALI — GV5 §107-PROD-FINAL — Migration CORRECTIVE.
-- Défaut reproduit par audit du code : la fiche Manager n'offre aucun moyen
-- de récupérer le lien d'activation quand aucun fournisseur e-mail n'est
-- configuré. Cette RPC émet un NOUVEAU jeton (ancien invalidé), ne stocke
-- que son empreinte SHA-256 et renvoie le lien au Super Admin authentifié.
-- Reversible : CREATE OR REPLACE. Aucune donnée existante modifiée hormis
-- l'invitation ciblée et son événement d'émission.

create or replace function public.admin_issue_activation_link(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.invitations%rowtype;
  v_token text;
  v_request_id text;
  v_expires timestamptz;
begin
  if coalesce(public.is_saas_admin(), false) is not true then
    raise exception 'Accès refusé : Super Admin requis.';
  end if;
  if p_invitation_id is null then
    raise exception 'Invitation requise.';
  end if;

  select * into v from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'Invitation introuvable.';
  end if;
  if v.status in ('accepted','cancelled','expired') then
    raise exception 'Invitation non activable.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_request_id := gen_random_uuid()::text;
  v_expires := now() + interval '7 days';

  update public.invitations
     set token_hash = public.hash_invitation_token(v_token),
         expires_at = v_expires,
         last_request_id = v_request_id,
         status = 'prepared',
         updated_at = now()
   where id = v.id;

  insert into public.invitation_events (invitation_id, channel, event_type, metadata)
  values (v.id, 'system', 'resent',
          jsonb_build_object('request_id', v_request_id, 'source', 'admin_issue_activation_link'));

  return jsonb_build_object(
    'url', '/activer/#token=' || v_token,
    'expires_at', v_expires,
    'invitation_id', v.id
  );
end $$;

revoke all on function public.admin_issue_activation_link(uuid) from public;
revoke all on function public.admin_issue_activation_link(uuid) from anon;
grant execute on function public.admin_issue_activation_link(uuid) to authenticated;

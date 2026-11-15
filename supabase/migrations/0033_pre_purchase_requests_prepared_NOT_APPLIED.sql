-- AUTO DYALI — 0033 : Demandes de pré-achat (préparation commerciale SaaS)
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- Ne pas exécuter à distance sans :
--   1) sauvegarde / export / PITR vérifiée,
--   2) vérification des dépendances et de l'état réel distant,
--   3) autorisation explicite (levée ciblée du gel P0).
--
-- Objet : enregistrer les demandes de pré-achat/souscription soumises par des
-- futurs clients professionnels, avec suivi des états, historique et contrôles
-- d'accès réservés au Super Admin (saas_admin). Aucune donnée de paiement ne
-- doit être marquée "confirmée" sans preuve réelle du fournisseur.

-- ---------------------------------------------------------------------
-- 1. TABLE DES DEMANDES DE PRÉ-ACHAT
-- ---------------------------------------------------------------------
create table if not exists public.pre_purchase_requests (
  id                uuid primary key default uuid_generate_v4(),
  request_key       text not null unique,                 -- idempotence côté client/flux
  status            text not null default 'soumis'
                    check (status in (
                      'brouillon','soumis','en_attente_verification',
                      'en_attente_paiement','paiement_confirme','valide',
                      'compte_cree','invitation_envoyee','compte_active',
                      'refuse','annule'
                    )),
  company_name      text not null,
  legal_name        text not null,
  professional_id   text,
  sector            text not null,
  business_type     text not null,
  address           text not null,
  city              text not null,
  phone             text not null,
  email             text not null,
  manager_name      text not null,
  plan_code         text not null references public.plans(code),
  period            text not null check (period in ('mensuel','annuel')),
  desired_users     integer not null check (desired_users >= 1),
  desired_sites     integer not null check (desired_sites >= 1),
  desired_modules   jsonb not null default '[]'::jsonb,
  configured_amount numeric(10,2),                        -- montant issu de la config au moment de la demande (peut être null si non configuré)
  currency          text not null default 'MAD',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  notes             text,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  refusal_reason    text,
  establishment_id  uuid references public.establishments(id) on delete set null,
  manager_user_id   uuid references auth.users(id) on delete set null,
  submitted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pre_purchase_requests_status_idx on public.pre_purchase_requests (status, submitted_at desc);
create index if not exists pre_purchase_requests_email_idx  on public.pre_purchase_requests (lower(email));
create index if not exists pre_purchase_requests_company_idx on public.pre_purchase_requests (lower(company_name));

-- ---------------------------------------------------------------------
-- 2. HISTORIQUE DES CHANGEMENTS D'ÉTAT
-- ---------------------------------------------------------------------
create table if not exists public.pre_purchase_events (
  id           uuid primary key default uuid_generate_v4(),
  request_id   uuid not null references public.pre_purchase_requests(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  event_type   text not null,                            -- status_change, note, validation, refusal, conversion, etc.
  from_status  text,
  to_status    text,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists pre_purchase_events_request_idx on public.pre_purchase_events (request_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. RLS & ACCÈS (Super Admin uniquement côté plateforme)
-- ---------------------------------------------------------------------
alter table public.pre_purchase_requests enable row level security;
alter table public.pre_purchase_events   enable row level security;

drop policy if exists pre_purchase_requests_saas_admin on public.pre_purchase_requests;
create policy pre_purchase_requests_saas_admin on public.pre_purchase_requests
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists pre_purchase_events_saas_admin on public.pre_purchase_events;
create policy pre_purchase_events_saas_admin on public.pre_purchase_events
  for all using (public.is_saas_admin()) with check (public.is_saas_admin());

-- Insertion publique contrôlée (formulaire pré-achat) : à n'activer que via
-- une RPC/Edge Function sécurisée validant les entrées et l'idempotence.
-- Exemple (À ADAPTER/VALIDER AVANT APPLICATION) :
-- create or replace function public.submit_pre_purchase_request(...) returns jsonb
-- language plpgsql security definer set search_path = public as $$ ... $$;
-- revoke all on function public.submit_pre_purchase_request(...) from public;
-- grant execute on function public.submit_pre_purchase_request(...) to anon, authenticated;

grant select, insert, update, delete on public.pre_purchase_requests to authenticated;
grant select, insert on public.pre_purchase_events to authenticated;

-- Aucune écriture exécutée par ce fichier en l'état (préparation uniquement).

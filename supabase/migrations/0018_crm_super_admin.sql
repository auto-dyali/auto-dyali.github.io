-- AUTO DYALI — 0018 : CRM Super Admin (pipeline commercial plateforme)
-- Prospects, démonstrations, essais, relances, conversions.
-- Table PLATEFORME (pas multi-tenant) : réservée au Super Admin.

create table if not exists public.crm_leads (
  id               uuid primary key default uuid_generate_v4(),
  company          text not null,
  contact_name     text,
  email            text,
  phone            text,
  city             text,
  activity         text,                          -- garage, magasin, centre pneus…
  stage            text not null default 'prospect'
                   check (stage in ('prospect','demo','trial','negotiation','won','lost')),
  plan_interest    text check (plan_interest in ('standard','silver','gold')),
  owner_id         uuid references auth.users(id) on delete set null,
  notes            text,
  next_action_at   date,                          -- prochaine relance
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  converted_establishment_id uuid references public.establishments(id) on delete set null
);

create table if not exists public.crm_events (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  event_type  text not null default 'note'
              check (event_type in ('note','call','email','demo','trial_start','stage_change')),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists crm_leads_stage_idx on public.crm_leads (stage, updated_at desc);
create index if not exists crm_events_lead_idx on public.crm_events (lead_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_events enable row level security;

-- Exclusivement Super Admin (aucun tenant ne doit voir le CRM plateforme)
drop policy if exists crm_leads_saas_admin on public.crm_leads;
create policy crm_leads_saas_admin on public.crm_leads for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

drop policy if exists crm_events_saas_admin on public.crm_events;
create policy crm_events_saas_admin on public.crm_events for all
  using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select, insert, update, delete on public.crm_leads, public.crm_events to authenticated;

-- =====================================================================
-- AUTO DYALI — APPLICATION MINIMALE DE LA MIGRATION 0018 (CRM)
-- =====================================================================
-- PRÉ-FLIGHT (lecture seule) : exécution ENTIÈRE annulée si un objet
-- critique manque. AUCUNE donnée existante n'est modifiée/supprimée.
-- PRÉ-REQUIS : sauvegarde/PITR vérifiée + autorisation explicite STOP.
-- Projet : nxmsqqoflskfajqrqddw
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname='public' and p.proname='is_saas_admin') then
    raise exception 'ARRÊT: is_saas_admin() absente.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='establishments') then
    raise exception 'ARRÊT: table establishments absente.';
  end if;
  raise notice 'PRÉ-FLIGHT OK : application CRM autorisée.';
end $$;

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

-- =====================================================================
-- POST-CHECKS (lecture seule)
-- =====================================================================
select table_name, 'présente' as etat
from information_schema.tables
where table_schema='public' and table_name in ('crm_leads','crm_events')
order by table_name;

select tablename, policyname, cmd
from pg_policies
where schemaname='public' and tablename in ('crm_leads','crm_events')
order by tablename, policyname;

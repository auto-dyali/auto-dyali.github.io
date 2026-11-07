-- AUTO DYALI — 0019 : Module chèques (capture, OCR, échéances, alertes)
-- Non destructive : création de table uniquement, RLS multi-tenant.

create table if not exists public.cheques (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references public.establishments(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  sale_id           uuid references public.sales(id) on delete set null,
  bank              text not null default '',
  number            text not null default '',
  beneficiary       text not null default '',
  amount            numeric(12,2) not null check (amount > 0),
  issue_date        date,
  received_date     date,
  due_date          date,
  status            text not null default 'en_attente'
                    check (status in ('en_attente','encaisse','rejete','annule')),
  image_url         text,
  ocr_text          text,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.cheques is 'Chèques reçus : capture image, OCR des champs lisibles, échéance, statuts et alertes J-7/J-3/J-1. Le CMC7/MICR nécessite un lecteur magnétique dédié.';

create index if not exists cheques_establishment_idx on public.cheques(establishment_id);
create index if not exists cheques_due_date_idx on public.cheques(due_date);
create index if not exists cheques_status_idx on public.cheques(status);

alter table public.cheques enable row level security;

drop policy if exists tenant_isolation on public.cheques;
create policy tenant_isolation on public.cheques
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

grant select, insert, update, delete on public.cheques to authenticated;

-- Alertes échéances : J-7, J-3, J-1 (lecture seule, security definer)
create or replace function public.cheques_echeances_proches()
returns table(
  cheque_id uuid,
  bank text,
  number text,
  beneficiary text,
  amount numeric,
  due_date date,
  jours_restants integer,
  urgence text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.bank, c.number, c.beneficiary, c.amount, c.due_date,
         (c.due_date - current_date) as jours_restants,
         case
           when c.due_date <= current_date then 'EN RETARD'
           when c.due_date <= current_date + 1 then 'J-1'
           when c.due_date <= current_date + 3 then 'J-3'
           when c.due_date <= current_date + 7 then 'J-7'
           else 'OK'
         end as urgence
    from public.cheques c
   where c.establishment_id = public.current_establishment_id()
     and c.status = 'en_attente'
     and c.due_date is not null
     and c.due_date <= current_date + 7
   order by c.due_date asc;
$$;

grant execute on function public.cheques_echeances_proches() to authenticated;

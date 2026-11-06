-- AUTO DYALI — 0015 : Support & tickets
-- Tickets de support plateforme + échanges de messages.
-- Un établissement ne voit QUE ses tickets (RLS tenant) ; le Super Admin les voit tous.

create table if not exists public.support_tickets (
  id               uuid primary key default uuid_generate_v4(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  requester_id     uuid references auth.users(id) on delete set null,
  subject          text not null,
  body             text not null,
  category         text not null default 'other'
                   check (category in ('bug','question','billing','feature','other')),
  status           text not null default 'open'
                   check (status in ('open','in_progress','waiting_reply','resolved','closed')),
  priority         text not null default 'normal'
                   check (priority in ('low','normal','high','urgent')),
  plan_code        text,                                -- forfait au moment de la demande
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);

create table if not exists public.ticket_messages (
  id         uuid primary key default uuid_generate_v4(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  is_staff   boolean not null default false,            -- réponse support vs client
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- L'établissement voit ses tickets ; le Super Admin voit tout.
drop policy if exists support_tickets_tenant on public.support_tickets;
create policy support_tickets_tenant on public.support_tickets
  for all using (
    establishment_id = public.current_establishment_id() or public.is_saas_admin()
  )
  with check (
    establishment_id = public.current_establishment_id() or public.is_saas_admin()
  );

drop policy if exists ticket_messages_tenant on public.ticket_messages;
create policy ticket_messages_tenant on public.ticket_messages
  for all using (
    public.is_saas_admin()
    or exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id
         and t.establishment_id = public.current_establishment_id()
    )
  )
  with check (
    public.is_saas_admin()
    or exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id
         and t.establishment_id = public.current_establishment_id()
    )
  );

grant select, insert, update on public.support_tickets, public.ticket_messages to authenticated;

-- Vue : nombre de tickets ouverts par établissement (KPI plateforme)
create or replace function public.open_ticket_count(p_establishment_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.support_tickets
   where establishment_id = p_establishment_id
     and status in ('open','in_progress','waiting_reply');
$$;

grant execute on function public.open_ticket_count(uuid) to authenticated;

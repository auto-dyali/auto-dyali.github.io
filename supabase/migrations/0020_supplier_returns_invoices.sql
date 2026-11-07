-- AUTO DYALI — 0020 : Retours fournisseurs & factures fournisseurs (§12 Achats)
-- Non destructive : création de tables uniquement, RLS multi-tenant.
-- Dépend de : 0001 (establishments, suppliers, purchase_orders, products, stock_movements)

-- ---------------------------------------------------------------------
-- Retours fournisseurs (marchandise renvoyée → sortie de stock tracée)
-- ---------------------------------------------------------------------
create table if not exists public.supplier_returns (
  id                    uuid primary key default uuid_generate_v4(),
  establishment_id      uuid not null references public.establishments(id) on delete cascade,
  supplier_id           uuid references public.suppliers(id) on delete set null,
  purchase_order_id     uuid references public.purchase_orders(id) on delete set null,
  reference             text not null,
  reason                text not null default '',
  total_amount          numeric(12,2) not null default 0,
  status                text not null default 'en_attente'
                        check (status in ('en_attente','expedie','rembourse','annule')),
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (establishment_id, reference)
);
alter table public.supplier_returns add constraint supplier_returns_tenant_id_unique unique (establishment_id, id);

-- Lignes du retour : quantités rendues par produit
create table if not exists public.supplier_return_items (
  id                    uuid primary key default uuid_generate_v4(),
  establishment_id      uuid not null references public.establishments(id) on delete cascade,
  return_id             uuid not null,
  product_id            uuid references public.products(id) on delete set null,
  label                 text not null,
  quantity              numeric(10,2) not null check (quantity > 0),
  unit_price            numeric(10,2) not null default 0
);
alter table public.supplier_return_items
  add constraint supplier_return_items_return_fk
  foreign key (establishment_id, return_id)
  references public.supplier_returns(establishment_id, id) on delete cascade;

-- ---------------------------------------------------------------------
-- Factures fournisseurs (documents entrants, rapprochement commandes)
-- ---------------------------------------------------------------------
create table if not exists public.supplier_invoices (
  id                    uuid primary key default uuid_generate_v4(),
  establishment_id      uuid not null references public.establishments(id) on delete cascade,
  supplier_id           uuid references public.suppliers(id) on delete set null,
  purchase_order_id     uuid references public.purchase_orders(id) on delete set null,
  number                text not null,
  invoice_date          date not null default current_date,
  due_date              date,
  total                 numeric(12,2) not null check (total >= 0),
  paid_amount           numeric(12,2) not null default 0 check (paid_amount >= 0),
  status                text not null default 'a_payer'
                        check (status in ('a_payer','partiellement_payee','payee','contestee','annulee')),
  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (establishment_id, number)
);

create index if not exists supplier_returns_establishment_idx on public.supplier_returns(establishment_id);
create index if not exists supplier_returns_supplier_idx on public.supplier_returns(supplier_id);
create index if not exists supplier_invoices_establishment_idx on public.supplier_invoices(establishment_id);
create index if not exists supplier_invoices_due_date_idx on public.supplier_invoices(due_date);
create index if not exists supplier_invoices_status_idx on public.supplier_invoices(status);

alter table public.supplier_returns enable row level security;
alter table public.supplier_return_items enable row level security;
alter table public.supplier_invoices enable row level security;

drop policy if exists tenant_isolation on public.supplier_returns;
create policy tenant_isolation on public.supplier_returns
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists tenant_isolation on public.supplier_return_items;
create policy tenant_isolation on public.supplier_return_items
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists tenant_isolation on public.supplier_invoices;
create policy tenant_isolation on public.supplier_invoices
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

grant select, insert, update, delete on public.supplier_returns to authenticated;
grant select, insert, update, delete on public.supplier_return_items to authenticated;
grant select, insert, update, delete on public.supplier_invoices to authenticated;

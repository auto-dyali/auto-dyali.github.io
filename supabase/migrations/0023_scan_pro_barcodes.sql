-- AUTO DYALI — 0023 : SCAN PRO — Plusieurs codes-barres / QR par produit
-- Non destructive : création de table + migration des barcode existants
-- depuis products.barcode vers product_barcodes (aucune suppression).
--
-- Table product_barcodes : un produit peut avoir plusieurs codes associés
-- (code-barres fabricant, QR de traçabilité, code par variante, par lot,
-- référence OEM, etc.). Chaque association est unique pour éviter les
-- doublons et les ambiguïtés.
--
-- Exécuter dans le SQL Editor Supabase (Dashboard).

-- ---------------------------------------------------------------------
-- 1. TABLE product_barcodes
-- ---------------------------------------------------------------------
create table if not exists public.product_barcodes (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references public.establishments(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  barcode           text not null,                 -- le code lisible (EAN, QR, SKU…)
  type              text not null default 'ean13'  check (type in (
    'ean13','ean8','upca','upce','code128','code39','qr','datamatrix','sku'
  )),
  format            text,                          -- détection estimée (jamais une preuve)
  variant           text,                          -- variante du produit (taille, parfum,…)
  lot_id            uuid references public.product_lots(id) on delete set null, -- lot spécifique
  is_primary        boolean not null default false, -- code principal du produit
  created_at        timestamptz not null default now(),
  unique (establishment_id, barcode),              -- pas de doublon de code
  unique (establishment_id, product_id, lot_id, variant) -- pas d'association ambiguë
);

alter table public.product_barcodes enable row level security;

-- Policies : isolation établissement (tenant) + SaaS admin voit tout
drop policy if exists tenant_isolation on public.product_barcodes;
create policy tenant_isolation on public.product_barcodes
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists saas_admin_all_product_barcodes on public.product_barcodes;
create policy saas_admin_all_product_barcodes on public.product_barcodes
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant select, insert, update, delete on public.product_barcodes to authenticated;

-- ---------------------------------------------------------------------
-- 2. MIGRATION : codes existants de products.barcode → product_barcodes
--    (idempotente : on ne crée que si le produit a un barcode non null
--     et qu'aucune entrée n'existe encore pour ce produit/code)
-- ---------------------------------------------------------------------
insert into public.product_barcodes
  (establishment_id, product_id, barcode, type, format, is_primary, created_at)
select
  p.establishment_id,
  p.id,
  p.barcode,
  case
    when p.barcode ~ '^\d{13}$' then 'ean13'
    when p.barcode ~ '^\d{8}$'  then 'ean8'
    when p.barcode ~ '^\d{12}$' then 'upca'
    when p.barcode ~ '^\d{6}$'  then 'upce'
    when p.barcode ~ '^[A-Z0-9]{4,}$' then 'code128'
    else 'inconnu'
  end,
  'migration_0023',                                 -- format estimé à la création
  true,                                             -- le barcode historique est primaire
  now()
from public.products p
where p.barcode is not null
  and p.barcode <> ''
  and not exists (
    select 1 from public.product_barcodes b
     where b.establishment_id = p.establishment_id
       and b.product_id = p.id
       and b.barcode = p.barcode
  );

-- ---------------------------------------------------------------------
-- 3. RPC : résolution d'un code → produit (utilisée par le moteur de scan)
-- ---------------------------------------------------------------------
create or replace function public.resolve_product_by_barcode(
  p_barcode text
) returns table (
  product_id    uuid,
  product_sku   text,
  product_name  text,
  product_price numeric(10,2),
  product_stock numeric,
  barcode_text  text,
  barcode_type  text,
  origine       text
) language plpgsql security definer set search_path = public as $$
declare
  v_est uuid := public.current_establishment_id();
begin
  -- 1) Code enregistré (table product_barcodes) — prioritaire
  return query
  select
    p.id, p.sku, p.name, p.sale_price,
    coalesce(l.total_qty, 0),
    b.barcode, b.type, 'code_associé'
  from public.product_barcodes b
  join public.products p on p.id = b.product_id
  left join lateral (
    select sum(quantity) as total_qty
    from public.product_lots pl
    where pl.product_id = p.id
  ) l on true
  where b.establishment_id = v_est
    and b.barcode = p_barcode
    and p.is_active = true;

  -- 2) Code-barres direct sur le produit (colonne historique products.barcode)
  return query
  select
    p.id, p.sku, p.name, p.sale_price,
    coalesce(l.total_qty, 0),
    p.barcode, 'ean13', 'code_barres_produit'
  from public.products p
  left join lateral (
    select sum(quantity) as total_qty
    from public.product_lots pl
    where pl.product_id = p.id
  ) l on true
  where p.establishment_id = v_est
    and p.barcode = p_barcode
    and p.is_active = true
    and not exists (
      select 1 from public.product_barcodes b
       where b.establishment_id = v_est and b.product_id = p.id
        and b.barcode = p_barcode
    );

  -- 3) Référence SKU en dernier recours
  return query
  select
    p.id, p.sku, p.name, p.sale_price,
    coalesce(l.total_qty, 0),
    p.sku, 'sku', 'reference_sku'
  from public.products p
  left join lateral (
    select sum(quantity) as total_qty
    from public.product_lots pl
    where pl.product_id = p.id
  ) l on true
  where p.establishment_id = v_est
    and p.sku = p_barcode
    and p.is_active = true
    and not exists (
      select 1 from public.product_barcodes b
       where b.establishment_id = v_est and b.product_id = p.id
        and b.barcode = p_barcode
    )
    and not exists (
      select 1 from public.products p2
       where p2.establishment_id = v_est and p2.barcode = p_barcode
        and p2.is_active = true
    );

  return;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC : ajouter un code à un produit (avec contrôle de doublon)
-- ---------------------------------------------------------------------
create or replace function public.add_product_barcode(
  p_product_id  uuid,
  p_barcode     text,
  p_type        text default 'ean13',
  p_variant     text default null,
  p_lot_id      uuid default null,
  p_is_primary  boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_est uuid := public.current_establishment_id();
  v_id  uuid;
begin
  -- Vérifier que le produit appartient à l'établissement
  if not exists (
    select 1 from public.products
     where id = p_product_id and establishment_id = v_est and is_active = true
  ) then
    raise exception 'Produit introuvable dans votre établissement.';
  end if;

  -- Si on marque comme primaire, désactiver les autres primaires de ce produit
  if p_is_primary then
    update public.product_barcodes
       set is_primary = false
     where establishment_id = v_est and product_id = p_product_id;
  end if;

  insert into public.product_barcodes
    (establishment_id, product_id, barcode, type, variant, lot_id, is_primary)
  values
    (v_est, p_product_id, p_barcode, p_type, p_variant, p_lot_id, p_is_primary)
  returning id into v_id;

  -- Journaliser
  insert into public.audit_log
    (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values
    (v_est, auth.uid(), 'add_product_barcode', 'product_barcodes', v_id,
     jsonb_build_object('product_id', p_product_id, 'barcode', p_barcode, 'type', p_type));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC : supprimer un code d'un produit
-- ---------------------------------------------------------------------
create or replace function public.remove_product_barcode(p_barcode_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_est uuid := public.current_establishment_id();
begin
  delete from public.product_barcodes
   where id = p_barcode_id and establishment_id = v_est;

  -- Journaliser
  insert into public.audit_log
    (establishment_id, actor_id, action, entity, entity_id, payload_json)
  values
    (v_est, auth.uid(), 'remove_product_barcode', 'product_barcodes', p_barcode_id,
     jsonb_build_object('barcode_id', p_barcode_id));

  return;
end;
$$;

grant execute on function public.resolve_product_by_barcode(text) to authenticated;
grant execute on function public.add_product_barcode(uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.remove_product_barcode(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Retour arrière
-- ---------------------------------------------------------------------
-- drop function if exists public.remove_product_barcode(uuid);
-- drop function if exists public.add_product_barcode(uuid, text, text, text, uuid, boolean);
-- drop function if exists public.resolve_product_by_barcode(text);
-- drop table if exists public.product_barcodes;

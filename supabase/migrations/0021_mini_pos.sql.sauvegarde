-- AUTO DYALI — 0021 : Mini-POS automobile (ergonomie PHARMA+, métier auto)
-- Non destructive : ajouts de colonnes NULLables, extension de contrainte
-- (sous-ensemble des anciennes valeurs conservées) et RPC d'encaissement
-- transactionnel. Aucune donnée existante n'est modifiée ni supprimée.
--
-- Exécuter dans le SQL Editor Supabase (Dashboard), dans l'ordre.
-- Retour arrière : bloc commenté en fin de fichier.

-- ---------------------------------------------------------------------
-- 1. Produits : recherche multi-références + photo (colonnes optionnelles)
-- ---------------------------------------------------------------------
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists manufacturer_ref text;
alter table public.products add column if not exists oem_ref text;
alter table public.products add column if not exists image_url text;

comment on column public.products.brand IS 'Marque / fabricant (Bosch, Mahle, Michelin…).';
comment on column public.products.manufacturer_ref IS 'Référence fabricant.';
comment on column public.products.oem_ref IS 'Référence OEM constructeur.';
comment on column public.products.image_url IS 'URL photo produit (renseignée seulement si réelle).';

-- ---------------------------------------------------------------------
-- 2. Vente associée au véhicule (optionnel : vente magasin sans véhicule)
-- ---------------------------------------------------------------------
alter table public.sales add column if not exists vehicle_id uuid
  references public.vehicles(id) on delete set null;
create index if not exists sales_vehicle_idx on public.sales(vehicle_id);

-- ---------------------------------------------------------------------
-- 3. Catégories automobiles (extension de la contrainte, sans retrait)
--    L'ancien ensemble reste inclus : aucune ligne existante n'est invalide.
-- ---------------------------------------------------------------------
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in (
  -- anciennes valeurs (conservées)
  'piece','accessoire','lubrifiant','merchandise','autrep','pneumatique','filtre',
  -- familles automobiles
  'moteur','freinage','embrayage','suspension','electricite','batterie',
  'refroidissement','climatisation','jantes','carrosserie','eclairage',
  'injection','outillage','main_oeuvre','autres'
));

-- ---------------------------------------------------------------------
-- 4. Encaissement transactionnel : vente + lignes (produits ET services)
--    + règlements + mouvements de stock + décrément, en UNE transaction.
--    - Les lignes service (service_id, ou ligne libre sans produit) ne
--      touchent JAMAIS au stock.
--    - Garde-fous serveur : client obligatoire au crédit, remise et crédit
--      soumis aux permissions (module 'pos') pour les rôles non managers.
--    - Anti-doublon : contrainte unique (establishment_id, reference)
--      fait échouer toute seconde tentative avec la même référence.
-- ---------------------------------------------------------------------
create or replace function public.create_pos_sale(
  p_reference     text,
  p_client_id     uuid,
  p_vehicle_id    uuid,
  p_work_order_id uuid,
  p_subtotal      numeric,
  p_discount      numeric,
  p_tax_total     numeric,
  p_total         numeric,
  p_paid_total    numeric,
  p_status        text,
  p_items         jsonb,   -- [{product_id, service_id, label, quantity, unit_price, tax_rate, discount}]
  p_payments      jsonb    -- [{method, amount}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est      uuid := public.current_establishment_id();
  v_role     public.user_role := public.autoplus_current_role();
  v_sale     uuid;
  v_item     jsonb;
  v_pay      jsonb;
  v_product  uuid;
  v_service  uuid;
  v_qty      numeric;
  v_qty_int  integer;
begin
  if v_est is null then
    raise exception 'Établissement introuvable pour cet utilisateur.';
  end if;

  -- Client obligatoire pour un crédit (paiement différé).
  if p_status = 'open' and p_client_id is null then
    raise exception 'Un client est obligatoire pour une vente à crédit.';
  end if;

  -- Permission côté serveur (rôle non manager → permissions pos.can_edit) :
  -- remise ET crédit différé sont des actes commerciaux sensibles.
  if coalesce(p_discount, 0) > 0
     and v_role not in ('manager', 'saas_admin')
     and not exists (
       select 1 from public.permissions pe
        where pe.establishment_id = v_est
          and pe.role = v_role
          and pe.module = 'pos'
          and pe.can_edit
     ) then
    raise exception 'Permission refusée : remise non autorisée (module POS).';
  end if;

  if p_status = 'open'
     and v_role not in ('manager', 'saas_admin')
     and not exists (
       select 1 from public.permissions pe
        where pe.establishment_id = v_est
          and pe.role = v_role
          and pe.module = 'pos'
          and pe.can_edit
     ) then
    raise exception 'Permission refusée : vente à crédit non autorisée (module POS).';
  end if;

  -- Vente (la contrainte unique (establishment_id, reference) bloque tout doublon).
  insert into public.sales
    (establishment_id, client_id, vehicle_id, work_order_id, reference,
     status, subtotal, discount, tax_total, total, paid_total)
  values
    (v_est, p_client_id, p_vehicle_id, p_work_order_id, p_reference,
     p_status::public.sale_status, p_subtotal, coalesce(p_discount,0),
     p_tax_total, p_total, p_paid_total)
  returning id into v_sale;

  -- Lignes : produits ET services (les libres ont product_id et service_id nuls).
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_product := nullif(v_item->>'product_id', '')::uuid;
    v_service := nullif(v_item->>'service_id', '')::uuid;
    v_qty     := coalesce((v_item->>'quantity')::numeric, 1);
    v_qty_int := greatest(0, round(coalesce(v_qty, 1)))::integer;

    insert into public.sale_items
      (establishment_id, sale_id, product_id, service_id, label,
       quantity, unit_price, tax_rate, discount)
    values
      (v_est, v_sale, v_product, v_service, coalesce(v_item->>'label', ''),
       v_qty,
       coalesce((v_item->>'unit_price')::numeric, 0),
       coalesce((v_item->>'tax_rate')::numeric, 20),
       coalesce((v_item->>'discount')::numeric, 0));

    -- Stock UNIQUEMENT pour un produit réel : les prestations ne décrémentent rien.
    if v_product is not null and v_qty_int > 0 then
      insert into public.stock_movements
        (establishment_id, product_id, direction, quantity, reference, actor_id)
      values
        (v_est, v_product, 'out', v_qty, p_reference, auth.uid());

      update public.products
         set stock = greatest(coalesce(stock, 0) - v_qty_int, 0)
       where id = v_product
         and establishment_id = v_est;
    end if;
  end loop;

  -- Règlements (espèces, carte, chèque, virement, mobile… — jusqu'à N modes,
  -- ce qui couvre le règlement mixte : espèces + carte par exemple).
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) > 0 then
      insert into public.payments
        (establishment_id, sale_id, method, amount, received_by)
      values
        (v_est, v_sale, (v_pay->>'method')::public.payment_method,
         (v_pay->>'amount')::numeric, auth.uid());
    end if;
  end loop;

  return v_sale;
end;
$$;

revoke execute on function public.create_pos_sale(text, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb) from public, anon;
grant  execute on function public.create_pos_sale(text, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb) to authenticated;

comment on function public.create_pos_sale(...) IS
  'Encaissement POS transactionnel : vente, lignes (produits + services), règlements, mouvements de stock. Les services ne decrementent jamais le stock. Permission serveur sur remise et crédit.';

-- ---------------------------------------------------------------------
-- Retour ar : déposer la fonction puis les ajouts
-- ---------------------------------------------------------------------
-- drop function if exists public.create_pos_sale(text, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb);
-- alter table public.sales drop column if exists vehicle_id;
-- alter table public.products drop column if exists image_url;
-- alter table public.products drop column if exists oem_ref;
-- alter table public.products drop column if exists manufacturer_ref;
-- alter table public.products drop column if exists brand;
-- alter table public.products drop constraint if exists products_category_check;
-- alter table public.products add constraint products_category_check check (category in
--   ('piece','accessoire','lubrifiant','merchandise','autrep','pneumatique','filtre'));

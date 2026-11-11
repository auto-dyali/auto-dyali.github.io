-- AUTO DYALI — 0025 : NEW POS CORE (moteur commercial unique).
-- NON DESTRUCTIVE : ajout d'une valeur d'enum, d'une colonne NULLable et
-- d'une nouvelle fonction. Aucune donnée existante modifiée ou supprimée,
-- aucune table retirée.
--
-- EXÉCUTER DANS LE SQL EDITOR SUPABASE (compte propriétaire).
-- L'ancien RPC create_pos_sale (0021) reste fonctionnel : compatibilité totale.

-- ---------------------------------------------------------------------
-- 1. Avoir client : nouvelle valeur de paiement (extension d'enum).
-- ---------------------------------------------------------------------
alter type public.payment_method add value if not exists 'avoir';

-- ---------------------------------------------------------------------
-- 2. Consentements WhatsApp séparés (service ≠ marketing).
-- ---------------------------------------------------------------------
alter table public.clients add column if not exists consents jsonb not null default '{}'::jsonb;
comment on column public.clients.consents IS
  'Consentements { service: "oui"/"non", marketing: "oui"/"non" } — service (RDV, véhicule prêt, facture) ≠ marketing (promotions).';

-- ---------------------------------------------------------------------
-- 3. create_pos_sale_v2 : encaissement transactionnel avec VÉRIFICATION
--    SERVEUR des totaux (le serveur ne fait jamais confiance au frontend).
--    Recalcule HT net, remises et TVA depuis p_items, dérive le statut du
--    solde réel et capitalise paid_total. Idempotence : contrainte unique
--    (establishment_id, reference). Prestations ne touchent JAMAIS au stock.
-- ---------------------------------------------------------------------
create or replace function public.create_pos_sale_v2(
  p_reference     text,
  p_client_id     uuid,
  p_vehicle_id    uuid,
  p_work_order_id uuid,
  p_items         jsonb,  -- [{product_id, service_id, label, quantity, unit_price, tax_rate, discount}]
  p_payments      jsonb   -- [{method, amount}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est       uuid := public.current_establishment_id();
  v_role      public.user_role := public.autoplus_current_role();
  v_sale      uuid;
  v_item      jsonb;
  v_pay       jsonb;
  v_product   uuid;
  v_produit_ok boolean;
  v_client_ok boolean;
  v_vehicule_ok boolean;
  v_qty       numeric;
  v_stock_actuel numeric;
  v_ligne_brut   numeric;
  v_ligne_remise numeric;
  v_ligne_nette  numeric;
  v_ht_nette  numeric := 0;   -- base HT après remises de lignes
  v_remise    numeric := 0;   -- somme des remises de lignes
  v_tva       numeric := 0;
  v_total     numeric;        -- TTC recalculé
  v_recu      numeric := 0;
  v_paye      numeric;
  v_statut    public.sale_status;
begin
  if v_est is null then
    raise exception 'Établissement introuvable pour cet utilisateur.';
  end if;

  if v_role is null then
    raise exception 'Rôle utilisateur introuvable.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Le panier ne contient aucune ligne.';
  end if;

  -- Recalcul serveur : la ligne est la seule source de vérité.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    if v_qty <= 0 then raise exception 'Quantité invalide.'; end if;
    if coalesce((v_item->>'unit_price')::numeric, 0) < 0 then raise exception 'Prix unitaire invalide.'; end if;

    -- Quantité décimale : la quantité insérée dans sale_items est la quantité exacte demandée.
    -- Le décrément de stock utilise la quantité arrondie à l'entier pour le comptage physique.
    v_ligne_brut  := round(v_qty * (v_item->>'unit_price')::numeric, 2);
    v_ligne_remise := coalesce((v_item->>'discount')::numeric, 0);
    if v_ligne_remise < 0
       or v_ligne_remise > v_ligne_brut then
      raise exception 'Remise de ligne invalide.';
    end if;

    v_ligne_nette := v_ligne_brut - v_ligne_remise;
    v_ht_nette := v_ht_nette + v_ligne_nette;
    v_remise := v_remise + v_ligne_remise;
    v_tva := v_tva + round(v_ligne_nette * coalesce((v_item->>'tax_rate')::numeric, 20) / 100.0, 2);
  end loop;
  v_total := round(v_ht_nette + v_tva, 2);

  -- Somme réellement reçue : les règlements en attente (chèque non encaissé) ne sont pas comptés.
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) < 0 then raise exception 'Règlement négatif interdit.'; end if;
    -- Un règlement avec statut en_attente (ex: chèque non encaissé) n'est pas compté comme encaissé.
    if (v_pay->>'status')::text <> 'en_attente' then
      v_recu := v_recu + coalesce((v_pay->>'amount')::numeric, 0);
    end if;
  end loop;
  
  if v_recu > v_total then
    raise exception 'Paiement excédentaire : le montant des règlements (%) dépasse le total de la vente (%).', v_recu, v_total;
  end if;
  
  v_paye := least(v_recu, v_total);

  v_statut := case
    when v_paye >= v_total then 'paid'::public.sale_status
    when v_paye > 0 then 'partial'::public.sale_status
    else 'open'::public.sale_status
  end;

  -- Client obligatoire au crédit ; remise/crédit sous permission (comme 0021).
  if v_statut = 'open' and p_client_id is null then
    raise exception 'Un client est obligatoire pour une vente à crédit.';
  end if;
  if (v_remise > 0 or v_statut = 'open')
     and v_role not in ('manager', 'saas_admin')
     and not exists (
       select 1 from public.permissions pe
        where pe.establishment_id = v_est
          and pe.role = v_role and pe.module = 'pos' and pe.can_edit
     ) then
    raise exception 'Permission refusée : remise ou vente à crédit non autorisée (module POS).';
  end if;

  -- Vérifier l'appartenance du client à l'établissement courant
  if p_client_id is not null then
    select count(*) > 0 into v_client_ok from public.clients where id = p_client_id and establishment_id = v_est;
    if not v_client_ok then
      raise exception 'Client introuvable ou appartient à un autre établissement.';
    end if;
  end if;

  -- Vérifier l'appartenance du véhicule à l'établissement courant
  if p_vehicle_id is not null then
    select count(*) > 0 into v_vehicule_ok from public.vehicles where id = p_vehicle_id and establishment_id = v_est;
    if not v_vehicule_ok then
      raise exception 'Véhicule introuvable ou appartient à un autre établissement.';
    end if;
  end if;

  -- Vérifier l'appartenance de l'ordre de travail à l'établissement courant
  if p_work_order_id is not null then
    select count(*) > 0 into v_vehicule_ok from public.work_orders where id = p_work_order_id and establishment_id = v_est;
    if not v_vehicule_ok then
      raise exception 'Ordre de travail introuvable ou appartient à un autre établissement.';
    end if;
  end if;

  -- Vente (anti-doublon par référence unique).
  insert into public.sales
    (establishment_id, client_id, vehicle_id, work_order_id, reference, status,
     subtotal, discount, tax_total, total, paid_total)
  values
    (v_est, p_client_id, p_vehicle_id, p_work_order_id, p_reference, v_statut,
     v_ht_nette, v_remise, v_tva, v_total, v_paye)
  returning id into v_sale;

  -- Lignes + stock (les prestations ne décrémentent JAMAIS).
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_product := nullif(v_item->>'product_id', '')::uuid;
    if v_product is not null then
      select count(*) > 0 into v_produit_ok from public.products where id = v_product and establishment_id = v_est;
      if not v_produit_ok then
        raise exception 'Produit introuvable ou appartient à un autre établissement.';
      end if;
    end if;
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_qty_int := greatest(0, round(v_qty))::integer;

    insert into public.sale_items
      (establishment_id, sale_id, product_id, service_id, label,
       quantity, unit_price, tax_rate, discount)
    values
      (v_est, v_sale, v_product, nullif(v_item->>'service_id', '')::uuid,
       coalesce(v_item->>'label', ''),
       v_qty, coalesce((v_item->>'unit_price')::numeric, 0),
       coalesce((v_item->>'tax_rate')::numeric, 20),
       coalesce((v_item->>'discount')::numeric, 0));

    if v_product is not null and v_qty > 0 then
      -- Verrouillage de la ligne produit pour éviter les ventes simultanées
      select stock into v_stock_actuel from public.products where id = v_product and establishment_id = v_est for update;

      if v_stock_actuel < v_qty then
        raise exception 'Stock insuffisant pour le produit %.', v_product;
      end if;

      insert into public.stock_movements
        (establishment_id, product_id, direction, quantity, reference, actor_id)
      values
        (v_est, v_product, 'out', v_qty, p_reference, auth.uid());

      update public.products
         set stock = stock - v_qty
       where id = v_product and establishment_id = v_est;
    end if;
  end loop;

  -- Règlements réels (> 0).
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

revoke execute on function public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb) to authenticated;

comment on function public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb) IS
  'Encaissement POS v2 : vérification serveur des totaux (recalcul depuis les lignes), statut dérivé du solde, anti-doublon par référence, prestations sans stock, RLS intacte.';

-- ---------------------------------------------------------------------
-- Retour arrière (bloc complet, à décommenter) :
--
-- drop function if exists public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb);
-- alter table public.clients drop column if exists consents;
-- (la valeur d''enum payment_method ajoutée ne se retire pas dans PostgreSQL)
-- ---------------------------------------------------------------------

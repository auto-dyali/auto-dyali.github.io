-- AUTO DYALI — 0012 : RPC de sortie de stock depuis le POS
-- Décrémente le stock réel de façon atomique et journalisée.

create or replace function public.decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
begin
  if not (public.is_manager() or public.is_saas_admin()) then
    raise exception 'Accès refusé : réservé aux managers.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantité invalide : %', p_quantity;
  end if;

  update public.products
     set stock = greatest(coalesce(stock, 0) - p_quantity, 0),
         updated_at = now()
   where id = p_product_id
     and establishment_id = public.current_establishment_id()
  returning stock into v_stock;

  if v_stock is null then
    raise exception 'Produit introuvable dans votre établissement.';
  end if;
end;
$$;

grant execute on function public.decrement_product_stock(uuid, integer) to authenticated;

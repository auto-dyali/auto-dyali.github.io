import re

with open('supabase/migrations/0021_mini_pos.sql', 'r') as f:
    content = f.read()

old_block = '''    if v_product is not null and v_qty_int > 0 then
      insert into public.stock_movements
        (establishment_id, product_id, direction, quantity, reference, actor_id)
      values
        (v_est, v_product, 'out', v_qty, p_reference, auth.uid());

      update public.products
         set stock = greatest(coalesce(stock, 0) - v_qty_int, 0)
       where id = v_product
         and establishment_id = v_est;
    end if;'''

new_block = '''    if v_product is not null and v_qty > 0 then
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
    end if;'''

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    with open('supabase/migrations/0021_mini_pos.sql', 'w') as f:
        f.write(content)
    print('Remplacement effectue avec succes')
else:
    print('Bloc non trouve')
    lines = content.split('\n')
    for i, line in enumerate(lines[170:182], start=171):
        print(f'{i}: {repr(line)}')
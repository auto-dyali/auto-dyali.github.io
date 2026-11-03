-- AUTO DYALI — Catalogue de test Stock/POS
-- Tarifs indicatifs en MAD : à confirmer avec les fournisseurs.
insert into public.products
  (establishment_id, sku, name, category, unit, purchase_price, sale_price, tax_rate, min_stock)
values
  ('00000000-0000-0000-0000-000000000001', 'FIL-BOS-045', 'Filtre à huile P 3274', 'piece', 'unité', 55, 85, 20, 10),
  ('00000000-0000-0000-0000-000000000001', 'FIL-MAN-W712', 'Filtre à huile W 712/95', 'piece', 'unité', 62, 95, 20, 8),
  ('00000000-0000-0000-0000-000000000001', 'FIL-PUR-LS933', 'Filtre à huile LS933', 'piece', 'unité', 48, 78, 20, 8),
  ('00000000-0000-0000-0000-000000000001', 'LUB-TOT-10W40', 'Quartz 7000 10W-40 — 5L', 'lubrifiant', 'bidon', 210, 285, 20, 5),
  ('00000000-0000-0000-0000-000000000001', 'LUB-MOT-5W40', '8100 X-clean 5W-40 — 5L', 'lubrifiant', 'bidon', 390, 520, 20, 3),
  ('00000000-0000-0000-0000-000000000001', 'LUB-CAS-15W40', 'GTX Diesel 15W-40 — 5L', 'lubrifiant', 'bidon', 235, 310, 20, 4),
  ('00000000-0000-0000-0000-000000000001', 'ACC-OSR-TAPIS', 'Tapis caoutchouc universels', 'accessoire', 'jeu', 125, 180, 20, 4),
  ('00000000-0000-0000-0000-000000000001', 'ACC-BOS-LED-H7', 'Ampoule LED H7', 'accessoire', 'paire', 165, 240, 20, 4),
  ('00000000-0000-0000-0000-000000000001', 'ACC-USB-12V', 'Chargeur USB double 12V', 'accessoire', 'unité', 95, 150, 20, 3)
on conflict (establishment_id, sku) do update set
  name = excluded.name,
  sale_price = excluded.sale_price,
  purchase_price = excluded.purchase_price,
  min_stock = excluded.min_stock,
  is_active = true;

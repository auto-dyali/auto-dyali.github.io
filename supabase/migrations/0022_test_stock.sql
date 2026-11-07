-- AUTO DYALI — 0022 : STOCK DE TEST (filtres, lubrifiants de vidange, pneus)
-- 15 produits de démonstration, 100 unités de stock chacun.
-- Idempotent : ré-exécution sans effet (on conflict do nothing).
-- Aucune donnée existante n'est modifiée ni supprimée.
--
-- Fonctionne AVANT ou APRÈS 0021 : les colonnes brand/manufacturer_ref/
-- oem_ref sont ajoutées ici si absentes (identique à 0021, if not exists).
-- Catégories valides sous l'ancienne contrainte 0014 ('filtre','lubrifiant',
-- 'pneumatique') : le script passe donc dans les deux cas.
--
-- ⚠️ Données de TEST : les codes-barres suivants sont des schémas EAN-13 de
--    démonstration, non enregistrés GS1 — à remplacer par vos vrais EAN.
--    Les références OEM (oem_ref) restent NULL : jamais de référence inventée.

alter table public.products add column if not exists brand text;
alter table public.products add column if not exists manufacturer_ref text;
alter table public.products add column if not exists oem_ref text;
alter table public.products add column if not exists image_url text;

-- ---------------------------------------------------------------------
-- FILTRES (5) — catégorie 'filtre'
-- ---------------------------------------------------------------------
insert into public.products
  (establishment_id, sku, barcode, name, category, brand, manufacturer_ref,
   unit, purchase_price, sale_price, tax_rate, min_stock, is_active, stock)
values
  ('00000000-0000-0000-0000-000000000001', 'FIL-MAH-OL01',  '9990000000017', 'Filtre à huile Mahle OL01',        'filtre', 'Mahle',       'OL 01',     'unité', 45,  72,  20, 5, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'FIL-MAN-W712',  '9990000000024', 'Filtre à huile W 712/95',          'filtre', 'MANN-FILTER', 'W 712/95',  'unité', 58,  95,  20, 5, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'FIL-PUR-LS933', '9990000000031', 'Filtre à huile LS933',             'filtre', 'Purflux',     'LS933',     'unité', 48,  78,  20, 5, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'FIL-BOS-045',   '9990000000048', 'Filtre à huile P 3274',            'filtre', 'Bosch',       'P 3274',    'unité', 52,  85,  20, 5, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'FIL-HER-AK55',  '9990000000055', 'Filtre habitacle',                 'filtre', 'Hering',      'AK55',      'unité', 38,  65,  20, 5, true, 100)
on conflict (establishment_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- LUBRIFIANTS DE VIDANGE (5) — catégorie 'lubrifiant'
-- ---------------------------------------------------------------------
insert into public.products
  (establishment_id, sku, barcode, name, category, brand, manufacturer_ref,
   unit, purchase_price, sale_price, tax_rate, min_stock, is_active, stock)
values
  ('00000000-0000-0000-0000-000000000001', 'LUB-TOT-10W40', '9990000000062', 'Quartz 7000 10W-40 — 5L',   'lubrifiant', 'TotalEnergies', 'QUARTZ7000-10W40', 'bidon', 185, 285, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'LUB-TOT-5W30',  '9990000000079', 'Quartz 5000 5W-30 — 5L',    'lubrifiant', 'TotalEnergies', 'QUARTZ5000-5W30',  'bidon', 170, 265, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'LUB-MOT-5W40',  '9990000000086', '8100 X-clean 5W-40 — 5L',   'lubrifiant', 'Motul',         '8100-XCLEAN-5W40',  'bidon', 340, 520, 20, 3, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'LUB-CAS-HX8',   '9990000000093', 'Edge 5W-30 SN 5L',           'lubrifiant', 'Castrol',       'EDGE-5W30-SN',      'bidon', 220, 340, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'LUB-ELF-5W30',  '9990000000109', 'Synergie 5W-30 — 5L',        'lubrifiant', 'Elf',           'SYNERGIE-5W30',     'bidon', 220, 340, 20, 4, true, 100)
on conflict (establishment_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- PNEUS (5) — catégorie 'pneumatique'
-- ---------------------------------------------------------------------
insert into public.products
  (establishment_id, sku, barcode, name, category, brand, manufacturer_ref,
   unit, purchase_price, sale_price, tax_rate, min_stock, is_active, stock)
values
  ('00000000-0000-0000-0000-000000000001', 'PNE-MIC-2055516', '9990000000116', 'Energy Saver 205/55 R16 91V',   'pneumatique', 'Michelin',     'ES-205-55-R16',     'unité', 520, 780, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'PNE-CON-1956515', '9990000000123', 'PremiumContact 195/65 R15 91V', 'pneumatique', 'Continental',  'PC6-195-65-R15',    'unité', 430, 650, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'PNE-BRI-2254517', '9990000000130', 'Turanza 225/45 R17 94W',       'pneumatique', 'Bridgestone',  'TZ-225-45-R17',     'unité', 620, 950, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'PNE-PIR-2055016', '9990000000147', 'Cinturato 205/50 R16 91V',     'pneumatique', 'Pirelli',      'CINT-205-50-R16',   'unité', 480, 720, 20, 4, true, 100),
  ('00000000-0000-0000-0000-000000000001', 'PNE-DEX-1856515', '9990000000154', 'Sport BluResponse 185/65 R15 88H', 'pneumatique', 'Dunlop',    'SBR-185-65-R15',    'unité', 390, 590, 20, 4, true, 100)
on conflict (establishment_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- PRESTATIONS DE BASE (idempotent) — pour tester le panier à services
-- (montage/équilibrage existent déjà via 0013 ; on ajoute vidange,
--  diagnostic et main-d'œuvre si absents). Jamais de suppression.
-- ---------------------------------------------------------------------
insert into public.services (establishment_id, name, category, price, duration_min)
select e.id, p.name, p.category, p.price, p.duration_min
  from public.establishments e
  cross join (values
    ('Vidange moteur (main-d''œuvre)', 'vidange',      150, 45),
    ('Forfait vidange (huile + filtre + pose)', 'vidange', 250, 60),
    ('Diagnostic électronique (lecture défauts)', 'diagnostic', 200, 40),
    ('Main-d''œuvre à l''heure', 'autre', 300, 60)
  ) as p(name, category, price, duration_min)
 where e.id = '00000000-0000-0000-0000-000000000001'
   and not exists (
     select 1 from public.services s
      where s.establishment_id = e.id
        and s.name = p.name
   );

-- ---------------------------------------------------------------------
-- OPTIONNEL — remettre le stock de test à 100 après avoir vendu dessus
-- (décommenter et exécuter uniquement si besoin ; ne touche qu'aux 15 SKUs).
-- ---------------------------------------------------------------------
-- update public.products set stock = 100
--  where establishment_id = '00000000-0000-0000-0000-000000000001'
--    and sku in ('FIL-MAH-OL01','FIL-MAN-W712','FIL-PUR-LS933','FIL-BOS-045',
--                'FIL-HER-AK55','LUB-TOT-10W40','LUB-TOT-5W30','LUB-MOT-5W40',
--                'LUB-CAS-HX8','LUB-ELF-5W30','PNE-MIC-2055516','PNE-CON-1956515',
--                'PNE-BRI-2254517','PNE-PIR-2055016','PNE-DEX-1856515');

-- Vérification attendue :
-- select sku, name, category, stock from public.products
--  where establishment_id = '00000000-0000-0000-0000-000000000001'
--    and sku like 'FIL-%' or sku like 'LUB-%' or sku like 'PNE-%'
--  order by category, sku;  -- 15 lignes, stock = 100 partout

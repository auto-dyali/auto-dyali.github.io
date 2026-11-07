# Phase POS rénovée + Scan Pro — Rapport final

Date : 7 novembre 2026 — dépôt `auto-plus` (branche `main`)

## 1. POS rénové (livré et déployé)
- `src/components/pos-module.tsx` : module complet (~2 100 lignes), toutes les features demandées actives :
  sidebar catégories dynamiques, recherche multi-champs, sélecteur véhicule 5 niveaux avec
  compatibilités vérifiées, cartes produit, panier produits + services, paiement compact 7 modes,
  reçu post-vente, devis avec services, permissions avant remise/crédit/remboursement,
  validation transactionnelle anti-doublon.
- Déployé : https://auto-dyali.github.io → 200 (commits `0b236e5`, `96727fa`, Actions success).

## 2. Scan Pro — moteur pur
- `src/lib/scan-pro.ts` : logique pure (détection honnête de format, clés EAN-8/EAN-13/UPC-A,
  tampon douchette HID, anti-double-lecture, résolution code → produit).
- `scripts/test-scan-pro.mjs` : **21 réussis / 0 échec** (rejoué le 07/11, preuve en sortie console).

## 3. Scan Pro — module React + page
- `src/components/scan-pro-module.tsx` : génération EAN-13 (préfixe GS1 ou code TEST marqué),
  dessin du code-barres via JSBarcode, association produit par RPC `add_product_barcode`,
  liste des codes associés (variante / lot / principal).
- `src/app/tableau-de-bord/scan-pro/page.tsx` : page dédiée, montée dans `ShellApp`
  (feature `pos`, donc visible sur tous les forfaits disposant du POS).
- `src/components/shell-app.tsx` : entrée de navigation « Scan Pro » (icône scanner).

## 4. Migrations non destructives (à exécuter dans le SQL Editor Supabase)
1. `supabase/migrations/0021_mini_pos.sql` — colonnes POS + catégories + RPC.
2. `supabase/migrations/0022_test_stock.sql` — stock de test 15 × 100 + prestations.
3. `supabase/migrations/0023_scan_pro_barcodes.sql` — table `product_barcodes`
   (multi-codes/produit), RLS par établissement, migration idempotente des codes existants
   `products.barcode` → `product_barcodes` (aucune suppression), RPC
   `add_product_barcode` / `remove_product_barcode` / `resolve_product_by_barcode`.

## 5. Vérifications locales (07/11)
- `npm run build` → vert, toutes pages statiques, y compris `○ /tableau-de-bord/scan-pro`.
- `npm run lint` → 0 erreur ; seul warning accepté : `<img>` dans `logo.tsx`.
- `node scripts/test-scan-pro.mjs` → 21 réussis, 0 échec.
- Dépendances nettoyées : `qrcode` retiré (plus importé), `jsbarcode` conservé (types intégrés).

## 6. Reste à faire (côté propriétaire)
1. Exécuter 0021 → 0022 → 0023 dans le SQL Editor Supabase (ordre important).
2. Vérifier après 0022 : 15 lignes, stock = 100 partout.
3. Vérifier après 0023 : table `product_barcodes` créée, codes existants migrés.
4. Passer les 9 tests de validation (pièce, pneu, forfait, prestation seule, client+véhicule,
   paiement partiel, moyens multiples, décrément stock, caisse).
5. Tester la page Scan Pro en production (génération → enregistrement → liste).

# RAPPORT AUDIT DASHBOARD & POS — AUTO DYALI (Phase 0)

**Date** : 2026-11-08 · **Dépôt** : `github.com/auto-dyali/auto-dyali.github.io` · **Branche** : `main` · **Dernier commit** : `9e5d61c` (push OK, Actions success) · **Production** : https://auto-dyali.github.io

## 1. État technique du dépôt
- Framework : Next.js 16.4.3 (export statique, `output: export`, dossier `out/`)
- CSS : Tailwind v4 + `@theme` dans `src/app/globals.css`
- React : 19.3.0
- Auth/DB : Supabase (`@supabase/supabase-js` ^2.118.0), routes côté client uniquement
- Dépendances clés : `html5-qrcode`, `jsbarcode`, `xlsx`
- Lint : 0 erreur (1 warning historique `logo.tsx`)
- Tests : Print Pro 24/24, Scan Pro 21/21
- Build : 40/40 pages statiques
- Déploiement : GitHub Pages, dernière action `completed success`

## 2. Inventaire des éléments (tableau obligatoire)

| Élément | Présent | Fonctionnel vérifié | À corriger | À conserver |
|---|---|---|---|---|
| Dashboard PC | Oui | Oui (KPI Supabase, graphiques) | Identité graphique palette officielle, structure claire | Moteur KPI, graphiques, raccourcis |
| Dashboard mobile | Oui (responsive ShellApp) | Partiel | Vues dédiées smartphone/tablette, navigation basse | Carte KPI, graphiques |
| POS PC | Oui | Oui (logique métier complète) | Architecture 3 zones (sidebar+cat+panier), cibles 48px, identité graphique | Moteur encaissement, panier, paiement |
| POS tactile | Oui (reprend PC) | Partiel | Interface dédiée tactile, pas de dépendance survol | Moteur partagé |
| POS smartphone | Oui | Oui (nav basse, panier feuille) | 4 boutons paiement déjà présents, améliorer visuel premium | Moteur partagé, panier feuille |
| POS tablette | Non (reprend PC) | Non | Disposition dédiée portrait/paysage | — |
| Panier | Oui | Oui | Conserver | Lignes, quantités, remises, TVA |
| Paiements | Oui (VISA/MC/Chèque/Espèces) | Oui (logique) | Logos officiels Visa/Mastercard, confirmation TPE | Modes, mixte, partiel, crédit |
| Scanner douchette | Oui (ScanChamp HID) | Non testé physiquement | Conserver | Détection code EAN/QR |
| Scanner caméra | Oui (scanner-camera.tsx) | Non testé physiquement | Intégrer BarcodeDetector si dispo | Caméra arrière |
| QR code | Oui (via ScanChamp) | Non testé physiquement | Conserver | Lecture, pas d'exécution directe |
| Stock | Oui (logique déduction) | Partiel (pas de données réelles) | Conserver | Vérification avant ajout |
| Facturation | Oui (modules facturation/devis) | Partiel | Conserver | Tickets, factures |
| Impression | Oui (Print Pro) | Oui (24 tests) | Conserver | ESC/POS, 58/80/A4, réimpression |
| Auth/RLS | Oui (features.ts) | Oui (logique) | Conserver | Rôles, permissions, moteur droits |

## 3. Fonctions réelles identifiées (pos-module.tsx, 2397 lignes)

**Catalogue & recherche**
- Chargement produits depuis Supabase (`products`) + repli catalogue de test
- Recherche multi-champs : désignation, EAN, ref fabricant, OEM, marque, catégorie, dimensions, compatibilité
- Catégories dynamiques (uniquement familles présentes)
- Sélecteur véhicule : Marque → Modèle → Année → Motorisation → Version (`vehicle_catalog`)
- Compatibilité pièce/véhicule : uniquement `part_compatibilities.verified = true`

**Panier**
- Produits + prestations (services + lignes libres)
- TVA et remise par ligne ; prestations ne touchent pas au stock
- Quantités +/−, suppression, prix unitaire modifiable (permission)
- Remise ticket (pourcentage + MAD, permission `pos.edit`)

**Paiement & encaissement**
- 4 moyens immédiatement visibles : VISA, MASTERCARD, CHÈQUE, ESPÈCES (déjà implémenté)
- Secondaires : virement, mobile, partiel, crédit
- Règlements mixtes (1..N modes)
- Espèces : montant reçu, monnaie à rendre, reste dû
- Encaissement transactionnel via RPC `create_pos_sale` (migration 0021) + repli legacy
- Verrou anti double-vente (`verrouEncaissement`)
- Reçu généré, panier reset, stocks rechargés

**Clients & véhicules**
- Sélection client + véhicule optionnels
- Création rapide client/véhicule (si permission)
- Historique client, interventions véhicule, ordres ouverts

**Scan & impression**
- `ScanChamp` : douchette USB/Bluetooth (HID clavier) + champ code-barres
- `scanner-camera.tsx` : caméra (html5-qrcode)
- Print Pro : tickets thermiques 58/80mm + A4, sélection imprimante, réimpression tracée

## 4. Défauts identifiés (écarts vs exigences de cette mission)

| Défaut | Gravité | Localisation |
|---|---|---|
| Identité graphique : variables CSS palette officielle incomplètes (manquent surface #303A38, surface-raised #37433E, succès #4D9B73, alerte #D6A34D, danger #C66A68) | Élevée | `src/app/globals.css` |
| Bouton "Ajouter" produit : `min-h-9` (36px) < 48px tactile requis | Moyenne | `pos-module.tsx` (ligne ~1710) |
| Bouton "Prestation libre" : `min-h-9` < 48px | Moyenne | `pos-module.tsx` (ligne ~1930) |
| POS tout dans un seul fichier (2397 lignes) — pas de séparation composants | Moyenne | `pos-module.tsx` |
| Tablette : pas de disposition dédiée (reprend PC) | Moyenne | `pos-module.tsx` |
| Dashboard : structure présente mais pas aux nouvelles variables de palette | Basse | `src/app/tableau-de-bord/page.tsx` |
| Logos Visa/Mastercard officiels absents (badges texte utilisés) | Basse | `public/` |
| Tests physiques imprimante/scanner/TPE non effectués (pas de matériel) | Blocage | — |

## 5. Éléments conservés (protection de l'existant)
- Moteur d'encaissement transactionnel (RPC + verrou anti double-vente)
- Logique panier, TVA, remises, stock
- Authentification, rôles, permissions, RLS
- Données Supabase, migrations (aucune suppression)
- Tests Print Pro / Scan Pro existants
- Classes design system historiques (`.btn-or`, `.carte`, `.champ`, `.titre-or`)

## 6. Plan d'exécution (phases 1→11)
1. **Phase 1** : identité graphique — variables CSS palette officielle + nouveaux tokens
2. **Phase 2** : dashboard — structure PC claire + vues smartphone/tablette
3. **Phase 3** : POS PC/tactile — architecture 3 zones, cibles 48px, réorganisation composants
4. **Phase 4** : POS smartphone/tablette — navigation basse, tablette dédiée
5. **Phase 5** : paiements — déjà présents (VISA/MC/Chèque/Espèces), confirmer visuel premium
6. **Phase 6** : scan — vérifier BarcodeDetector/caméra
7. **Phase 7-9** : tests multirésolution, régressions, build production
8. **Phase 10** : commit + push GitHub + vérification Actions
9. **Phase 11** : rapports finals (4 fichiers)

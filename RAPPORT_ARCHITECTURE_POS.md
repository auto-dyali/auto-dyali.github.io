# RAPPORT ARCHITECTURE POS — AUTO DYALI

**Date** : 2026-11-08 · **Branche** : `main` · **Commits** : `db8c101` → `9b70193` · **Production** : https://auto-dyali.github.io

## 1. Architecture réelle (respect de l'organisation existante)

Conformément à la consigne « examiner d'abord l'organisation réelle du dépôt et ne pas déplacer inutilement des fichiers », l'architecture **existante** a été conservée et renforcée plutôt que réorganisée massivement :

```text
src/
  app/                          → pages (routes)
    tableau-de-bord/point-de-vente/page.tsx   → POS (injecte PosModule)
    tableau-de-bord/page.tsx                  → Dashboard (KPI, graphiques, raccourcis)
  components/
    shell-app.tsx           → shell partagé : sidebar rétractable, header, nav mobile, droits
    pos-module.tsx          → moteur POS unique (3 interfaces, même panier/paiement)
    dashboard-kpis.tsx      → KPI réels Supabase (CA, bénéfice, dépenses, interventions)
    dashboard-graphiques.tsx→ courbe CA + donut (données 100% réelles)
    graphiques.tsx          → SVG responsive (viewBox)
    scan-champ.tsx          → douchette HID + caméra + saisie manuelle (instance unique)
    scanner-camera.tsx      → caméra (html5-qrcode)
    pave-numerique.tsx      → pavé tactile 48px
    print-pro-module.tsx / print-pro.ts / print-pro-client.ts → impression
    scan-pro-module.tsx / scan-pro.ts → Scan Pro
  lib/
    features.ts             → moteur de droits (rôles, forfaits, RLS côté serveur)
    supabase-browser.ts     → client Supabase
```

## 2. Interfaces du POS — un moteur, trois rendus

| Interface | Déclencheur | Disposition | Panier | Paiement |
|---|---|---|---|---|
| PC / écran tactile | ≥ 1024 px (`lg`) | Grille 3 colonnes : sidebar `auto` (230/72px rétractable) + catalogue `1fr` + panier latéral 23rem | Fixe à droite, sticky | Zone D en bas de sidebar (VISA/MC/Chèque/Espèces + ENCAISSER) |
| Tablette portrait | 640–1023 px | Vue mobile : en-tête compacte + catalogue plein écran | Feuille plein écran | Bouton PAY en-tête + onglet Paiement (4 boutons distincts) |
| Smartphone | < 640 px | Idem tablette portrait, grille produits 2 colonnes | Feuille plein écran | Idem + barre inférieure fixe 5 onglets |

**Règle fondamentale respectée** : deux expériences d'interface, un seul moteur métier (`encaisser()` unique), un seul panier, une seule base Supabase, mêmes règles commerciales.

## 3. Détection du mode d'affichage

Le rendu s'appuie sur les **media queries Tailwind** (`lg:` = 1024px) plutôt que sur un hook JS custom — aucun risque de perte de panier lors d'un redimensionnement (l'état React est conservé, seules les classes CSS changent). Le POS ne dépend d'aucun test `maxTouchPoints` : les cibles tactiles ≥ 48px et `touch-action: manipulation` couvrent souris ET doigt.

## 4. Sidebar rétractable (commune Dashboard/POS)

- Bouton `<>` en haut de chaque sidebar, `aria-label` + `title` (« Réduire/Développer le menu »)
- `.app-sidebar` : 230px développé / 72px réduit, transition 200ms
- `.menu-label` : opacity 0 + width 0 quand réduit (icônes conservées)
- Mémorisation `localStorage` (`auto-dyali-sidebar` / `auto-dyali-pos-sidebar`), initialisation paresseuse `useState(() => ...)` (pas de setState dans useEffect, conforme aux règles React 19 / eslint)
- Chaque entrée de menu : `title` + `aria-label` (accessible clavier et toucher quand les libellés sont masqués)
- POS : colonne grille `auto` → la largeur de colonne suit l'état rétractable sans chevauchement

## 5. Scanner (instance unique — correction de bug)

**Bug corrigé** : deux `ScanChamp` étaient rendus dans le POS (en-tête + zone scan). Chaque instance installe un écouteur clavier HID global → **un code scanné aurait été ajouté deux fois au panier**. Correction : un seul `ScanChamp` (écouteur global unique, détection Entrée + burst de chiffres, anti-double-lecture par tampon 120ms).

Chaîne scan complète : douchette USB/Bluetooth (HID) → champ + bouton Scanner → caméra (`getUserMedia`, caméra arrière, via html5-qrcode) → recherche produit (EAN/sku/réf) → ajout au panier ou message clair (code inconnu). QR codes pris en charge ; contenu traité comme donnée non fiable (jamais exécuté).

## 6. Paiements (moteur commun)

- 4 boutons distincts immédiatement visibles : VISA, Mastercard, Chèque, Espèces (badges texte — logos officiels indisponibles, documenté)
- Secondaires : virement, mobile, partiel, crédit
- Espèces : montant reçu → monnaie calculée ; Visa/MC → mode `card` avec distinction réseau côté UI ; Chèque → mode `cheque`
- Transactionnel : RPC `create_pos_sale` + verrou anti double-vente ; aucune prétention de débit bancaire réel sans TPE

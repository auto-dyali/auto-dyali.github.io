# RAPPORT TESTS DASHBOARD & POS — AUTO DYALI

**Date** : 2026-11-08 · **Commit** : `9b70193` · **Production** : https://auto-dyali.github.io

## 1. Tests automatisés exécutés

| Test | Résultat | Commande |
|---|---|---|
| Tests unitaires Print Pro | **24/24, 0 échec** | `node scripts/test-print-pro.mjs` |
| Tests unitaires Scan Pro | **21/21, 0 échec** | `node scripts/test-scan-pro.mjs` |
| Lint ESLint | **0 erreur** (1 warning `<img>` historique toléré) | `npm run lint` |
| TypeScript | **0 erreur** | `npx tsc --noEmit` |
| Build production | **40/40 pages statiques** | `npm run build` |
| GitHub Actions | **completed success** sur `9b70193` | API GitHub |
| Production HTTP | **200** sur `/`, `/connexion/`, `/tableau-de-bord/`, `/tableau-de-bord/point-de-vente/`, images | curl |

## 2. Tests de rendu réels par dimensions (preuves mesurées)

Méthode : page de test `docs-refonte/tests-responsive.html` servie localement, ouverte dans le navigateur Chromium. Chaque dimension est rendue dans une **iframe à la largeur exacte demandée** (les media queries CSS s'appliquent au viewport de l'iframe, comportement identique à un appareil réel pour le CSS). Les mesures sont effectuées dans le DOM de chaque iframe via JavaScript (`scrollWidth`, `matchMedia`, sélecteurs).

**Cible testée : page Connexion (design premium)**

| Dimension | Débordement horizontal | Breakpoint actif | Carte verre | « Bienvenue ! » | « Se connecter » | Footer marque | Champs |
|---|---|---|---|---|---|---|---|
| 360×640 | **0 px** | mobile | ✔ | ✔ | ✔ | ✔ | 3 |
| 390×844 | **0 px** | mobile | ✔ | ✔ | ✔ | ✔ | 3 |
| 430×932 | **0 px** | mobile | ✔ | ✔ | ✔ | ✔ | 3 |
| 768×1024 | **0 px** | tablette | ✔ | ✔ | ✔ | ✔ | 3 |
| 1024×768 | **0 px** | desktop | ✔ | ✔ | ✔ | ✔ | 3 |
| 1280×720 | **0 px** | desktop | ✔ | ✔ | ✔ | ✔ | 3 |
| 1440×900 | **0 px** | desktop | ✔ | ✔ | ✔ | ✔ | 3 |
| 1920×1080 | **0 px** | desktop | ✔ | ✔ | ✔ | ✔ | 3 |

**Aucun défaut détecté sur les 8 dimensions.**

Note tablette POS : la disposition 3 zones (sidebar + catalogue + panier latéral) est active dès **1024px** (`lg`) — la tablette paysage 1024×768 est donc testée par le même breakpoint (rendu desktop confirmé ci-dessus) ; le portrait 768px utilise la vue mobile (panier feuille), également confirmée (0px de débordement, breakpoint tablette).

## 3. Captures d'écran — blocage documenté

**Les captures d'écran n'ont pas pu être produites** : l'outil `browser.screenshot` exige une fenêtre Review visible côté utilisateur (« Screenshot needs a visible tab »). La fenêtre n'étant pas affichée pendant la session, aucune capture n'a été possible. **Aucun écran n'a donc été validé visuellement par capture** ; la validation repose sur les mesures DOM ci-dessus (débordement, breakpoints, présence des éléments) + vérification console (0 erreur JS sur la page de connexion).

À refaire par l'utilisateur : ouvrir la session dans l'app desktop (fenêtre Review visible) puis demander « capture d'écran » — les pages locales `http://localhost:3100/tests-responsive.html` et les pages de production sont prêtes.

## 4. Tests métier (couverture logique du code, relu et vérifié)

| Scénario | Couverture |
|---|---|
| Ajout produit / quantité / suppression | `ajouterProduit`, `augmenterLigne`, `retirerLigne`, `supprimerLigne` + garde stock |
| Remise ligne + ticket | champs ligne + REMISE_OPTIONS (permission `pos.edit`) |
| TVA par ligne | select TVA par ligne, calcul `montantTVA` |
| Espèces + monnaie | `montantRecu` → `monnaieRendue` (calcul auto) |
| VISA / Mastercard | modes distincts → `card` en BDD (réseau séparé côté UI) |
| Chèque | mode `cheque` |
| Paiement mixte | tableau `reglements` 1..N |
| Partiel / différé | modes dédiés + validations |
| Double clic encaissement | `verrouEncaissement` (ref) — vente unique |
| Stock | garde avant ajout + rechargement après vente |
| Douchette | écouteur HID global, suffixe Entrée, anti double-lecture |
| Caméra / QR | `ScannerCamera` (getUserMedia), contenu traité comme non fiable |
| Rôles / permissions | moteur `features.ts` + table `permissions` |

**Non exécutables ici** (blocages matériels/accès) : vente réelle en base (clés Supabase non configurées), TPE physique, imprimante thermique, douchette physique, caméra réelle.

## 5. Vérification console & réseau
- Page connexion (navigateur) : **0 message console erreur**.
- Production : routes 200, images de connexion servies (265 Ko desktop / 92 Ko mobile).

# PHASE COMPLÉMENTAIRE — AUTO DYALI TOUCH POS & PRINT PRO — Rapport

Date : 8 novembre 2026 — dépôt `auto-plus` (branche `main`)

## 1. Livré — complet

### A. Interface POS tactile
- **Pavé numérique tactile** (`src/components/pave-numerique.tsx`) : 16 touches
  48 × 48 px minimum, espacées (gap 6 px), `touch-manipulation` (suppression du
  délai 300 ms + zoom double-tap), anti-ghost (même touche < 120 ms ignorée),
  utilisable à la souris, au doigt et au clavier physique simultanément.
- Intégré au modal d'encaissement (montant reçu espèces) via bouton ⌨.
- Cibles tactiles relevées dans le POS : boutons modes de paiement 44 px,
  +/− quantité et suppressions 40 px espacées, champs prix/remise 36 px.
- Anti double-vente : `verrouEncaissement` (ref) + `disabled={saving}` sur
  l'encaissement, déjà présents — vérifiés, conservés.
- Aucune fonction essentielle dépendant du survol (audit : les `hover:` ne
  portent que des retours visuels, jamais des actions).

### B. Print Pro — gestion centralisée des imprimantes
- Moteur pur **`src/lib/print-pro.ts`** : formats 58 mm (32 col.) / 80 mm (48 col.)
  / A4, ESC/POS (init, alignement, gras, tailles, coupe `GS V B`), QR natif
  ESC/POS, gabarits HTML FR + AR (RTL), échappement HTML sûr.
- Client **`src/lib/print-pro-client.ts`** : config par établissement
  (`printer_configs`), impression par défaut PAR type de document, journal
  tracé (`print_jobs`), voies navigateur / USB (WebUSB) / Bluetooth (Web
  Bluetooth) / repli `.bin` universel.
- Module d'administration **`/tableau-de-bord/print-pro`** (+ navigation) :
  ajout/modification/désactivation (aucune suppression de données), test
  d'impression, copies (1-5), langue par imprimante, défauts par document,
  historique 50 dernières impressions avec statut et réimpression.
- Migration **`supabase/migrations/0024_print_pro.sql`** : 2 tables + RLS
  par établissement + trigger « un seul défaut par document » + RPC
  `count_print_jobs` — 100 % non destructif.

### C. Ticket de paiement
- Nouveau gabarit professionnel : établissement (nom, adresse, ville, tél,
  email), numéro unique de vente, date/heure, caissier, client + véhicule
  (plaque — marque modèle), articles avec références (réf. fab/OEM),
  quantités, remises par ligne, TVA, total, payé par moyen, monnaie, reste,
  référence de transaction (id de vente tronqué).
- QR de vérification : imprimé UNIQUEMENT si l'établissement configure
  `url_verification` (champ à venir / champ notes) — jamais de QR décoratif.
- Réimpression tracée : compteur `print_jobs`, mention « RÉIMPRESSION n°X »
  avec numéro initial conservé, depuis le modal de vente ET depuis
  l'**Historique des ventes** (bouton « Ticket », données réelles rechargées).

### D. Bon d'intervention atelier
- Gabarit thermique (58/80) **et** A4/PDF (avec zone de signature client).
- Contenu : numéro unique, date d'ouverture, établissement, client (+tél),
  véhicule (marque, modèle, plaque, kilométrage réel), diagnostic, travaux
  (tâches + statut), pièces réellement sorties (sale_items des ventes liées),
  main-d'œuvre (prix des tâches), technicien, statut traduit, livraison
  prévue (`due_at`), approbation client, ventes liées, total indicatif.
- Mention explicite « ne vaut ni facture ni ticket de paiement ».
- Imprimable à tout moment (ouverture → suivi → clôture) : boutons « Bon »
  (thermique) et « A4 » sur chaque ordre du module Atelier.

### F. Langues
- Français + arabe RTL (`dir="rtl"`, libellés traduits, montants inchangés,
  statuts et moyens de paiement traduits), choix de langue par imprimante.

## 2. Livré — partiel (décisions techniques documentées)

| Point | État | Raison honnête |
|---|---|---|
| E — Devis accepté → commande de travail | partiel | La chaîne existe : devis → vente (Devis), vente ↔ ordre (`work_order_id` au POS), pièces ↔ stock, prestations ↔ vente. La conversion directe devis→ordre n'est PAS automatisée pour éviter de dupliquer les référentiels client/véhicule. |
| E — Bon dans l'historique véhicule/client | partiel | Les impressions sont tracées dans `print_jobs` (réf. + `work_order_id`) ; pas encore de vue dédiée dans la fiche véhicule. |
| A — Page POS sans AUCUN défilement sur smartphone | partiel | Écran de caisse/tablette (xl) : conforme (zones internes seulement). Smartphone : barre fixe total+PAIEMENT toujours visible, panier en overlay plein écran scrollable, mais un léger défilement de page subsiste — le conteneur ShellApp est partagé par 24 pages, non modifié pour éviter toute régression. |
| QR de vérification | actif sous condition | Nécessite que l'établissement renseigne une URL de vérification réelle ; sans elle, aucun QR (exigence respectée). |
| Motif de visite / observations du bon | partiel | Champs absents du schéma `work_orders` (non destructif) — affichés « — ». Ajout possible par migration ultérieure si demandé. |

## 3. Matrice de validation (§G) — 14 points

| # | Test | Résultat |
|---|---|---|
| 1 | POS avec souris | ✅ vérifié (interactions boutons/inputs, build) |
| 2 | POS avec écran tactile | ⚠️ **non testé matériellement** — code prêt (pointer events, touch-manipulation, anti-ghost) ; à valider sur terminal réel |
| 3 | Mini POS tactile | ⚠️ idem #2 (même module) |
| 4 | Pavé numérique tactile | ✅ logique testée + ⚠️ matériel à valider |
| 5 | Paiement comptant | ✅ flux existant conservé + ticket enrichi |
| 6 | Paiement partiel | ✅ (reste, encaissement ultérieur, ticket « RESTE À PAYER » testé) |
| 7 | Ticket 58 mm | ✅ ESC/POS 32 col. testé par 24 tests ; ⚠️ imprimante physique NON testée |
| 8 | Ticket 80 mm | ✅ ESC/POS 48 col. testé ; ⚠️ matériel NON testé |
| 9 | Bon d'intervention | ✅ gabarits thermique + A4 testés ; ⚠️ matériel NON testé |
| 10 | Facture A4/PDF | ✅ impression facture existante conservée |
| 11 | Réimpression après erreur | ✅ compteur + mention + numéro initial (testés) |
| 12 | Impression FR et arabe | ✅ RTL + traductions testés (24 tests) |
| 13 | Montants et numéros | ✅ tests numériques (deux-colonnes, montants intacts, NBSP) |
| 14 | Absence doubles ventes/paiements | ✅ verrou + `disabled` + RPC transactionnelle (existants, vérifiés) |

### Imprimantes physiques
**Aucune imprimante thermique n'était connectée à l'environnement de
développement : AUCUN modèle, aucune connexion USB/Bluetooth/réseau n'a été
testé matériellement.** Les voies navigateur/PDF et la génération d'octets
ESC/POS sont testées automatiquement. Les modèles réels (ex. Xprinter,
Epson TM, Goojprt…) devront être validés avec la checklist du module
Print Pro (bouton « Tester » par voie).

## 4. Vérifications
- `npm run build` → **vert** (40 pages statiques, dont `/tableau-de-bord/print-pro`).
- `npm run lint` → **0 erreur** (seul warning accepté : `<img>` logo.tsx).
- `node scripts/test-print-pro.mjs` → **24 réussis / 0 échec** (nouveau).
- `node scripts/test-scan-pro.mjs` → **21 réussis / 0 échec** (non-régression).
- Aucune donnée supprimée ; migrations précédentes non modifiées.

## 5. À exécuter côté propriétaire
1. SQL Editor : `0024_print_pro.sql` (après 0021/0022/0023 si pas déjà fait).
2. Configurer ses imprimantes dans Print Pro et tester chaque voie (bouton Tester).
3. Valider la matrice tactile sur un vrai écran tactile et consigner les modèles testés.

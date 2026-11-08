# RAPPORT AUDIT POS — AUTO DYALI (Phase 1)

**Date** : 2026-11-08 · **Dépôt** : `github.com/auto-dyali/auto-dyali.github.io` · **Branche** : `main` · **Dernier commit** : `85e31b5` (push OK, Actions success) · **Production** : `https://auto-dyali.github.io`

## 1. État du dépôt
- Dernier commit : `85e31b5` — DOC rapport final mission globale.
- GitHub Actions : déploiement Pages `completed success` sur `85e31b5`.
- Build statique Next 16.4.3 (`out/`), lint 0 erreur (1 warning historique `logo.tsx`).
- Tests : Print Pro 24/24, Scan Pro 21/21.

## 2. Code réel du POS examiné

**Fichier principal** : `src/components/pos-module.tsx` (≈ 2230 lignes) — moteur métier unique pour PC, tactile et smartphone.

### Moteur de paiement existant (Présent et transactionnel)
- `encaisser()` : verrou anti double-vente (`verrouEncaissement`), validation montant, espèces insuffisantes, crédit client obligatoire, remise permissionnée.
- RPC `create_pos_sale` (migration 0021) transactionnel + repli `encaisserLegacy` si fonction absente.
- Reçu généré (`Recu`), panier reset, stocks rechargés (`charger()`).
- Modes actuels (`ModePaiement`) : `especes, carte, cheque, virement, mobile, partiel, credit`.
- `METHODE_BDD` : especes→cash, carte→card, cheque→cheque, virement→transfer, mobile→mobile.

### Paiement UI actuel (ÉCARTS vs exigences)
- Grid de modes (grid-cols-4) : Espèces / Carte / Chèque / Virement sur une ligne ; Mobile / Partiel / Crédit pas tous visibles simultanément.
- **Aucun bouton distinct VISA / MASTERCARD** — seulement une "Carte" générique.
- **Aucun logo Visa / Mastercard** (aucun fichier `visa*`, `mastercard*` dans `public/`).
- Pas de "Zone D" : actions de paiement fixes en bas de la barre latérale gauche (PC).
- Smartphone : bouton "Paiement" dans la barre inférieure ouvre un panneau ; les 4 moyens ne sont pas immédiatement visibles comme 4 boutons distincts.
- "Ajouter" catalogue : `min-h-9` (~36 px) < 48 px tactile requis.

### Structure 3 zones existante
- Zone 1 : barre latérale POS (12 boutons) — AJOUTÉE dans le commit précédent, toujours présente.
- Zone 2 : catalogue centre (recherche multi-champs, sélecteur véhicule, compatibilité vérifiée, grille produits).
- Zone 3 : panier droit fixe (PC) / feuille plein écran (smartphone) + barre fixe bas smartphone (panier + paiement).

### Fonctions métier préservées
Catalogue, recherche véhicule (Marque→Modèle→Année→Motorisation→Version), compatibilité pièces vérifiée, panier produits+prestations, TVA/remise par ligne, clients, véhicules, devis, tickets intervention, historique, facturation, imprimantes, Print Pro, Scan Pro, permissions rôles, RLS.

## 3. TABLEAU D'AUDIT — EXIGENCES vs ÉTAT ACTUEL

| Exigence | État actuel | Défaut | Correction |
|---|---|---|---|
| Barre latérale fixe PC | Présente (12 boutons) | Manque zone paiement en bas | Ajouter Zone D (VISA/MASTERCARD/CHÈQUE/ESPÈCES) fixe en bas de la sidebar |
| Actions fixes en bas | Absente | Aucune action paiement fixe sur la sidebar PC | Zone D paiement en bas de sidebar |
| Paiement VISA | Absent (carte générique) | Pas de bouton VISA distinct | Bouton VISA distinct + logo |
| Paiement Mastercard | Absent (carte générique) | Pas de bouton Mastercard distinct | Bouton Mastercard distinct + logo |
| Paiement chèque | Présent (partiel) | Dans grid mixte, pas immédiatement visible | Bouton CHÈQUE distinct |
| Paiement espèces | Présent | Dans grid mixte, pas immédiatement visible | Bouton ESPÈCES distinct |
| Interface tactile | Partielle | Cibles "Ajouter" 36px < 48px ; pas d'interface dédiée | Cibles 48px+, surface tactile dédiée |
| Interface smartphone | Partielle | Barre nav 5 onglets présente ; 4 moyens paiement pas distincts | 4 boutons paiement distincts, panier feuille, totaux lisibles |
| Panier fixe | Présent (PC droit / mobile feuille) | OK | Conserver |
| Encaissement transactionnel | Présent (RPC + verrou) | OK | Conserver, étendre modes visa/mastercard |

## 4. Fonctionnalités : présentes / absentes / partielles / non testées

### Présentes et vérifiées (code)
- Moteur de paiement transactionnel (RPC `create_pos_sale` + fallback), anti double-vente, validation montants.
- Panier produits + prestations, quantités, remises, TVA par ligne.
- Clients, véhicules, création rapide.
- Devis, tickets intervention, historique, facturation.
- Print Pro (24 tests), Scan Pro (21 tests).
- Permissions rôles + RLS.

### Présentes mais à corriger (UI)
- Quatre moyens de paiement distincts immédiatement visibles (VISA, MASTERCARD, CHÈQUE, ESPÈCES).
- Zone de paiement fixe en bas de la barre latérale PC.
- Cibles tactiles ≥ 48 px.

### Absentes (à documenter comme blocages)
- Logos Visa / Mastercard officiels : aucun fichier graphique disponible dans `public/` → badges texte en attendant.
- Paiement TPE réel : aucune intégration bancaire → simulation documentée (pas de prétention de paiement réel).
- Tests physiques imprimante / scanner / TPE : pas de matériel.

### Non testées
- Données Supabase réelles (clés non configurées → repli catalogue de test).
- Rendu visuel largeurs 1366×768 / 1920×1080 / 1280×800 / 1024×768 / 360×800 / 390×844 / 430×932 (pas d'outil d'émulation mobile, pas de fenêtre Review utilisateur).

## 5. Fichiers clés concernés par les corrections
- `src/components/pos-module.tsx` — moteur + UI (paiement, sidebar Zone D, targets tactiles, smartphone).
- `src/app/globals.css` — design system (déjà émeraude doux, conserver).
- Migrations 0021→0024 : à exécuter par la propriétaire (jamais par l'agent).

## 6. Décisions de correction (Phase 2→6)
1. Séparer "carte" en `visa` et `mastercard` (méthodes de règlement distinctes, toutes deux mappées vers `card` en BDD).
2. Quatre boutons de paiement distincts et immédiatement visibles : VISA, MASTERCARD, CHÈQUE, ESPÈCES (badges texte si pas de logos).
3. Zone D PC : bloc de paiement fixe en bas de la barre latérale gauche.
4. Targets tactiles ≥ 48 px (`min-h-12` min).
5. Smartphone : panier feuille, 4 boutons paiement visibles dans le panneau de paiement, navigation inférieure fixe conservée.
6. Moteur de paiement commun inchangé (`encaisser()`), modes étendus.

# RAPPORT CORRECTIONS POS — AUTO DYALI (Phase 2→6)

**Date** : 2026-11-08 · **Commit** : `4775255` · **Branche** : `main` · **Actions** : success · **Production** : https://auto-dyali.github.io (200)

## 1. Corrections apportées au POS

### A. Moteur de paiement — 4 moyens distincts immédiatement visibles
| Avant | Après |
|---|---|
| "Carte" générique dans un grid mixte | **VISA** et **MASTERCARD** comme boutons distincts |
| CHÈQUE et ESPÈCES dans le même grid | **CHÈQUE** et **ESPÈCES** comme boutons distincts |
| Certains moyens pas tous visibles simultanément | Les 4 moyens (VISA, MASTERCARD, CHÈQUE, ESPÈCES) toujours visibles |

**Modèle de données** (`src/components/pos-module.tsx`) :
- `ModePaiement` : `especes | visa | mastercard | cheque | virement | mobile | partiel | credit`
- `METHODE_BDD` : visa→card, mastercard→card, especes→cash, cheque→cheque, virement→transfer, mobile→mobile
- `Reglement.methode` : étendu à visa/mastercard
- `MOYENS_PAIEMENT` : 4 entrées (VISA, MASTERCARD, CHÈQUE, ESPÈCES) — toujours rendues
- `MODES_SECONDAIRES` : virement, mobile, partiel, crédit
- Sélecteur de règlement : options Visa / Mastercard ajoutées

### B. Interface PC — Zone de paiement fixe en bas de la barre latérale
- Nouvelle **Zone D** dans la barre latérale gauche (toujours visible, ne disparaît pas au défilement) :
  - 4 boutons de paiement distincts (VISA, MASTERCARD, CHÈQUE, ESPÈCES) avec état actif visuel
  - Bouton **ENCAISSER** fixe en dessous, appelle le moteur transactionnel
- Zone 1 : navigation POS (12 boutons) conservée
- Zone 2 : catalogue central (recherche, catégories, compatibilité véhicule) conservée
- Zone 3 : panier droit fixe (articles, quantités, remises, TVA, total HT/TTC) conservé

### C. Interface écran tactile
- Partage le même moteur et la même structure PC
- Cibles tactiles portées à **48 px minimum** (`min-h-12` sur les boutons "Ajouter" et les boutons de paiement)
- Aucun élément interactif ne dépend uniquement du survol (tous ont un `onClick`)
- Retour visuel immédiat (état actif, hover, enfoncement)
- Compatible mode paysage et portrait (grille responsive)

### D. Interface smartphone
- En-tête compacte : "AUTO DYALI POS", bouton panier, bouton PAY
- Barre de navigation inférieure fixe (5 onglets) : Catalogue, Panier, Clients, Paiement, Menu
- Panier en feuille mobile (glissière plein écran) : quantités modifiables, totaux lisibles, suppression, validation toujours accessible
- Paiement accessible directement (bouton PAY dans l'en-tête + onglet Paiement)
- Les 4 boutons de paiement distincts sont visibles dans le panneau de paiement (pas de menu caché)

### E. Moteur de paiement commun (toutes les interfaces)
- `encaisser()` unique appelé par PC, tactile et smartphone
- Transactionnel via RPC `create_pos_sale` (migration 0021) + repli legacy
- Verrou anti double-vente (`verrouEncaissement`) — pas de double enregistrement sur double clic
- Validation : montant insuffisant, espèces insuffisantes, crédit client obligatoire, remise permissionnée
- Paiement mixte (1 ou N règlements), partiel, différé (crédit)
- Reçu généré, panier reset, stocks rechargés

## 2. Éléments préservés (non cassés)
- Moteur métier : catalogue, recherche véhicule, compatibilité pièces, panier, stock, clients, devis, tickets, historique, facturation
- Imprimantes, Print Pro, Scan Pro
- Permissions rôles + RLS
- Authentification et redirections
- Design system émeraude doux (`#49675B`, `#A7B7A8`, `#D0C6AE`, `#252D2D`, `#E8ECE8`)
- Arrière-plan de connexion, logo, splash validés

## 3. Blocages documentés
- **Logos Visa / Mastercard officiels** : aucun fichier graphique dans `public/` → badges texte "VISA" / "Mastercard" utilisés. À remplacer par les logos officiels lorsqu'ils seront disponibles.
- **Paiement TPE réel** : aucune intégration bancaire effective → les paiements Visa/Mastercard sont enregistrés en simulation (statut "paid"/"partial"), aucun prétention de paiement bancaire réel.
- **Tests physiques** : pas de matériel imprimante/scanner/TPE disponible.

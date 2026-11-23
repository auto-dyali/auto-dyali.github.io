# RAPPORT PAIEMENTS — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)

---

## 1. ÉTAT EXISTANT DES PAGES DE PAIEMENTS

Deux pages existent déjà et sont complètes. Aucune modification n'a été nécessaire.

### 1.1 Plans & fonctionnalités (`src/app/super-admin/plans/page.tsx`)

**Objet** : Catalogue réel des forfaits STANDARD / SILVER / GOLD et matrice de droits.

**Fonctionnalités implémentées** :
- Édition des prix mensuel et annuel par forfait (via RPC `admin_save_plan`)
- Édition de la durée d'essai par forfait (jours, 0-365)
- Édition des limites (utilisateurs max, sites max, stockage Mo)
- Matrice de droits : activation/désactivation de chaque module par forfait (via RPC `admin_set_feature`)
- Matrice des fonctionnalités pilotées : workshop, appointments, tires, barcode, excel, purchasing, employees, stock_advanced, reports_finance, cheques, alerts, crm, ai, automation, analytics, multisite, whatsapp, custom_reports, advanced_permissions, advanced_suppliers
- Export CSV de la matrice de droits
- Journalisation côté serveur via RPC
- Aucun prix inventé : les prix sont lus depuis la base `plans` et `plan_features`

### 1.2 Finance & facturation (`src/app/super-admin/paiements/page.tsx`)

**Objet** : Vue réelle basée sur les abonnements et forfaits configurés.

**Fonctionnalités implémentées** :
- Liste réelle des abonnements avec statut (trial, active, past_due, suspended, expired, cancelled)
- MRR estimé (somme des prix mensuels des abonnements actifs + essais)
- Montants dus estimés (actifs + en retard)
- Historique & état de facturation par abonnement (entreprise, forfait, statut, prix mensuel, dû estimé, échéance, début)
- Filtrage par statut d'abonnement
- Export CSV
- Aucun fournisseur de paiement SaaS connecté : aucun encaissement confirmé n'est enregistré
- Aucun avoir SaaS modélisé actuellement

**Prérequis pour paiements réels** (documentés dans la page) :
1. Fournisseur de paiement configuré (secrets serveur), webhooks signés et idempotents
2. Modèle de factures/transactions SaaS distinct des ventes atelier, avec numérotation et statuts réels
3. Réconciliation automatique paiement ↔ abonnement, journalisation dans `audit_log`
4. Tests en environnement contrôlé avant toute activation

---

## 2. ARCHITECTURE DE PAIEMENT PRÉVUE (Non implémentée)

La page `paiements` documente l'architecture à mettre en place lorsque les secrets seront configurés :

| Élément | État | Détail |
|---|---|---|
| Fournisseur de paiement | Non configuré | Stripe, CMI, etc. à configurer côté serveur |
| Webhooks | Non implémentés | Doivent être signés et idempotents |
| Modèle de factures/transactions | Non implémenté | Distinct des ventes atelier |
| Numérotation des factures | Non implémentée | À prévoir |
| Réconciliation paiement ↔ abonnement | Non implémentée | À prévoir |
| Relance de paiement | Non implémentée | À prévoir |

**Règle respectée** : Aucun fournisseur non configuré n'est intégré artificiellement. Aucun paiement n'est déclaré réussi sur la seule base d'un retour frontend.

---

## 3. FORFAITS ET TARIFS

Les forfaits STANDARD, SILVER et GOLD existent dans la base `plans`. Leurs prix (`price_monthly`, `price_yearly`) sont actuellement NULL dans la base de production/staging (non configurés).

**Durées payantes proposées** : 1 mois, 3 mois, 6 mois, 1 an, 2 ans, durée personnalisée (1-120 mois).

**Durées d'essai proposées** : Aucun, 7, 15, 30, 45, 60 jours, durée personnalisée (1-365 jours).

**Règle** : L'essai est indépendant de la durée payante et ne la réduit jamais.

---

## 4. POURCENTAGES DE PROGRESSION

| Périmètre | Développement | Tests locaux | Staging | Production |
|---|---:|---:|---:|---:|
| Paiements | 80 % | 100 % (statique) | 0 % (fournisseur non configuré) | 0 % |

**Justification** : Les pages de paiements et de plans existent et sont complètes côté code. Aucun paiement réel ne peut être traité sans configuration des secrets fournisseurs (Stripe, etc.) et des tarifs réels en base.

---

## 5. CONFIRMATION

| Élément | Confirmation |
|---|---|
| Aucun paiement simulé | ✅ |
| Aucun faux encaissement déclaré | ✅ |
| Aucun fournisseur non configuré intégré | ✅ |
| Secrets fournisseurs absents (documenté) | ✅ |
| Tarifs NULL en base (documenté) | ✅ |

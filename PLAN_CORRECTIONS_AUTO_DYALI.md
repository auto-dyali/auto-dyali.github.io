# PLAN DE CORRECTIONS — AUTO DYALI

## Corrigé dans cette mission (Phase 1 + Phase 7)

| # | Défaut | Correction | Fichier |
|---|---|---|---|
| 1 | Panier non partagé Mini-POS / POS (état local) | Panier + règlements persistés (`auto-dyali-pos-panier`), hydratation au montage, sauvegarde à chaque changement ; vérifié en navigateur (Mini-POS → POS complet, même panier) | `src/modules/new-pos/hooks/use-pos.ts` |
| 2 | Double appel `nouvelleReference()` dans `construirePayloadVente()` | Référence unique générée une fois, utilisée dans payload et retour | `src/modules/new-pos/core/sales-engine.ts` |
| 3 | Repli legacy multi-INSERT (faux transactionnel) | Supprimé : RPC atomique seul (`create_pos_sale_v2` puis `create_pos_sale`), sinon file offline idempotente (aucune écriture partielle) | `src/modules/new-pos/services/sales.service.ts` |
| 4 | Invariant paiement manquant | `payloadValide` rejette `paid_total > total` et `somme règlements < paid_total` ; tests ajoutés | `sales-engine.ts`, `scripts/test-pos-core.mjs` |
| 5 | « Bénéfice net = CA − dépenses » présenté comme résultat net | Retitulé « Résultat intermédiaire » avec mention « coût des marchandises manquant, pas un bénéfice net » | `src/components/dashboard-kpis.tsx` |

## Phases 2 à 14 — état et plan

- **Phase 2 Catalogue** : adapter le schéma existant (ne pas créer de 2ᵉ table) ; sous-catégories extensibles à ajouter ; historique de prix d’achat et coût historique de vente à bâtir sur `products` / `sale_items` (migration additive, validation humaine requise).
- **Phase 3 Stock/Achats** : réception atomique/idempotente à confirmer en base ; réception partielle, retours, inventaire, alertes, traçabilité utilisateur.
- **Phase 4 Atelier** : rapprocher les statuts SQL existants du modèle métier (sans casser les données) ; mouvement de stock unique par pièce consommée.
- **Phase 5 CRM** : fiche, historique, solde, devis, RDV, rappels, fidélité, consentements (déjà séparés service/marketing).
- **Phase 6 Employés** : vérifier les droits côté serveur (pas seulement en masquant les boutons).
- **Phase 7 Finance** : coût des marchandises vendues manquant → marge brute/résultat net non calculables en l’état ; ne pas afficher de résultat net.
- **Phase 8 WhatsApp** : jeton uniquement côté serveur (jamais dans le navigateur) ; journal d’envoi ; aucune simulation.
- **Phase 9 Assistant IA** : si aucun fournisseur IA configuré, afficher la limite ; isolation multi-garage, journalisation, confirmation avant opération sensible.
- **Phase 10 Super Admin** : harmoniser BASIC/GOLD/PREMIUM avec les plans existants ; vérifier RPC admin + RLS.
- **Phase 11 Responsive/Performance** : design validé conservé ; pagination catalogue sur smartphone ; états chargement/vide/erreur/hors-ligne/sync/succès.
- **Phase 12 Multi-tenant/Sécurité** : vérifier `establishment_id` et RLS sur chaque table sensible ; ne jamais faire confiance au frontend ; ne jamais désactiver RLS.
- **Phase 13 Tests** : voir `TESTS_AUTO_DYALI.md`.
- **Phase 14 Déploiement** : voir `RAPPORT_DEPLOIEMENT_AUTO_DYALI.md`.

## Règle

Aucune migration destructive n’est exécutée par l’agent. Toute migration additive est préparée avec retour arrière et attente de validation humaine (ex. `0025_pos_core.sql`).

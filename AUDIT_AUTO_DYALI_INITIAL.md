# AUDIT INITIAL — AUTO DYALI

**Date** : 9 novembre 2026 · **Branche** : `main` · **HEAD** : `1903b0d` · **Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Stack** : Next.js 16.4.3, React 19.3.0, TypeScript, Supabase JS 2.118.0, GitHub Pages (export statique).  
**Sauvegarde code** : branche `sauvegarde-finalisation-auto-dyali` (code + configurations non secrètes).  
**Environnement (noms uniquement)** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (valeurs non affichées).  
**Migrations** : `0001` → `0025` (25 fichiers, non destructives). Tests : `test-print-pro.mjs`, `test-scan-pro.mjs`, `test-pos-core.mjs`, `check-db.mjs`. Workflow : `deploy-pages.yml`.  
**Design** : validé et verrouillé (Dashboard image 1, Point de Vente image 2). Aucune modification visuelle dans cette mission sauf correction ciblée documentée.

## Stratégie de sauvegarde des données

Aucune migration destructive n’est exécutée par l’agent. Toute migration additive est préparée avec un bloc de retour arrière commenté et doit être exécutée par la propriétaire via le SQL Editor Supabase. Aucune suppression de tables, données, utilisateurs ou fichiers Storage.

## Inventaire par module

| Module | Présent | Fonctionnel vérifié | Partiel | Absent | Fichiers | Défauts | Tests |
|---|---|---|---|---|---|---|---|
| Point de Vente (POS complet) | Oui | Partiellement (moteur testé 38/38, rendu réel vérifié) | Panier non persistant entre Mini-POS/POS ; double génération de référence ; repli legacy multi-INSERT | — | `src/components/pos/PosMaquette.tsx`, `src/modules/new-pos/**` | Voir Phase 1 | `test-pos-core.mjs` 38/38 |
| Mini-POS (Dashboard) | Oui | Partiellement (rendu + ajout panier vérifiés) | Panier non partagé avec le POS | — | `src/modules/new-pos/mini-pos/mini-pos.tsx` | Panier local à chaque instance | Rendu navigateur |
| Catalogue automobile | Oui | Partiellement (recherche, familles, test catalogue marqué) | Pas de sous-catégories ; historique de prix d’achat absent ; coût historique de vente absent | — | `src/modules/new-pos/services/products.service.ts`, `catalogue-module.tsx`, `tire-module.tsx` | `purchase_price` utilisé comme coût actuel (estimation) | Tests moteur |
| Stock | Oui | Non testé en base | Mouvement + alertes présents ; inventaire à vérifier | — | `stock-module.tsx` | À auditer : réception atomique/idempotente | — |
| Fournisseurs & Achats | Oui | Non testé en base | Commande → réception → facture ; réception partielle/retour à vérifier | — | `suppliers-module.tsx`, `achats-complements-module.tsx` | À auditer | — |
| Atelier | Oui | Non testé en base | Parcours réception → facture présent ; statuts à rapprocher du modèle métier | — | `atelier-module.tsx` | Statuts SQL (`pending`, `in_progress`…) vs modèle (`received`, `diagnosis`…) | — |
| Clients & Véhicules (CRM garage) | Oui | Partiellement (création réelle, multi-véhicules) | Fidélité/rappels limités | — | `clients-module.tsx`, `vehicules-module.tsx`, `customers.service.ts` | Consentements WhatsApp en `clients.consents` (migration 0025, à déployer) | — |
| Employés | Oui | Non testé en base | Rôles/permissions présents ; productivité à vérifier | — | `employes-module.tsx`, `permissions-module.tsx` | Vérification serveur à confirmer | — |
| Finance / Bénéfice | Oui | Incorrect sur un point | `DashboardKpis` affiche « Bénéfice net = CA − dépenses » (non conforme) | Coût des marchandises historique manquant | `dashboard-kpis.tsx` | Voir Phase 7 | — |
| Caisse | Oui | Non testé en base | Ouverture/clôture/dépenses/encaissements par mode | — | `cash.service.ts`, `backoffice-modules.tsx` | À tester | — |
| Facturation / Devis / Créances / Chèques | Oui | Non testé en base | Numéro facture unique ; devis → vente ; échéances | — | `invoices.service.ts`, `quotes-module.tsx`, `echeances-module.tsx`, `cheques-module.tsx` | À tester | — |
| WhatsApp & Notifications | Oui | Non testé (aucun envoi simulé) | Service + consentements ; jeton serveur non configuré ici | — | `whatsapp.service.ts` | Jeton jamais exposé (vérifié) | — |
| Assistant IA | Oui | Non testé | À auditer : réponses prédéfinies vs IA réelle | — | `assistant-ai.tsx` | Limite à afficher si IA non configurée | — |
| Super Admin SaaS | Oui | Non testé | Établissements, plans, CRM SaaS, audit | — | `app/super-admin/**`, `crm-module.tsx` | Harmonisation BASIC/GOLD/PREMIUM à vérifier | — |
| Scan Pro / Print Pro | Oui | Testés (21/21, 24/24) | — | — | `scan-pro*.ts`, `print-pro*.ts` | — | 45/45 |
| Responsive / Performance | Oui | Partiellement (POS fixe grand écran, mobile défile) | Captures Desktop/tablette à refaire | — | `globals.css`, `shell-app.tsx` | Viewport de contrôle limité | Rendu navigateur |

## Défauts prioritaire (Phase 1)

1. **Panier non partagé** entre Mini-POS et POS complet (état local à chaque `usePos`).
2. **Double appel `nouvelleReference()`** dans `construirePayloadVente()` (payload et retour divergent → risque d’anti-doublon erroné).
3. **Repli legacy multi-INSERT** dans `sales.service.ts` (simule une transaction ; à remplacer par RPC + file offline).
4. **Invariant paiement manquant** : `paid_total > total` non contrôlé explicitement.
5. **Bénéfice net présenté comme `CA − dépenses`** (Phase 7).

## Référence Supabase

la mission indique `lwepnnecnrqdzadesyqo` ; le code utilise un fallback `nxmsqqoflskfajqrqddw` et la variable `NEXT_PUBLIC_SUPABASE_URL` de production. Aucune modification de référence/config sans justification. Les entrées `.env.local` sont des clés publiques (publishable), aucun secret affiché.

## Blocages externes identifiés dès la Phase 0

- Clés Supabase de production pour tests réels en base (non configurées dans cette session).
- Équipement physique : TPE, imprimante thermique, douchette HID, caméra.
- Migration `0025_pos_core.sql` : à exécuter par la propriétaire (SQL Editor).
- Jeton WhatsApp Business côté serveur (jamais dans le navigateur).

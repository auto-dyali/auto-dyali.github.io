# RAPPORT DE DÉPLOIEMENT — AUTO DYALI

**Date** : 9 novembre 2026 · **Branche** : `main` · **Dépôt** : `auto-dyali/auto-dyali.github.io`  
**URL** : https://auto-dyali.github.io

## Commit

- Correction Phase 1 + rapports de mission (voir `git log`). Design validé inchangé.
- `git diff --check` : OK · `npx tsc --noEmit` : 0 erreur · `npm run lint` : 0 erreur · tests : 40/40 + 24/24 + 21/21 · `npm run build` : OK.

## Vérification du déploiement (à compléter après push)

- [ ] Succès du workflow GitHub Actions (surveiller `actions/runs`).
- [ ] Commit déployé = HEAD `main`.
- [ ] Chargement du site (Dashboard + Point de Vente, 200).
- [ ] Chunk POS maquette présent en production (« Panier de Vente »).
- [ ] Erreurs console (401 attendus uniquement avec session de test factice).
- [ ] Données Supabase (lorsque l’accès est autorisé).

## Migrations réellement déployées

Aucune dans cette mission. `0025_pos_core.sql` reste à déployer par la propriétaire (SQL Editor). Preuve attendue : exécution manuelle documentée.

## Problèmes bloquants

1. Clés Supabase de production pour tests réels en base (non configurées dans cette session).
2. Équipement physique : TPE, imprimante thermique, douchette HID, caméra.
3. Jeton WhatsApp Business côté serveur (jamais dans le navigateur).
4. Coût historique des marchandises vendues manquant (marge brute / résultat net non calculables).

## Fonctionnalités non vérifiées

Opérations réelles en base (ventes, stock, caisse, factures, WhatsApp), tests RLS par rôle, isolation inter-garages, captures Desktop/tablette parfaites. Le présent rapport ne déclare pas la mission terminée sans ces preuves.

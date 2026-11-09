# TESTS — AUTO DYALI

## Suites exécutées (cette mission)

| Suite | Résultat |
|---|---|
| `scripts/test-pos-core.mjs` (moteurs : monnaie, remises, TVA, tarification, panier, paiements, ventes, offline) | **40/40** (dont référence unique et invariants paiement ajoutés) |
| `scripts/test-print-pro.mjs` (ESC/POS, gabarits, MAD, libellés) | **24/24** |
| `scripts/test-scan-pro.mjs` (EAN, HID, anti-doublon, résolution) | **21/21** |
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur** (warnings préexistants uniquement) |
| `npm run build` | **OK** (pages statiques générées) |
| Navigateur (session de test, sans données réelles) | Dashboard : 8 KPI, Alertes, Mini-POS Rapide, Activité, Accès Rapide ; POS : catégories, 8 produits, panier, Remise/Client/Mode, 5 moyens, Finaliser ; **panier partagé Mini-POS → POS complet vérifié** |

## Scénarios couverts par les moteurs (test-pos-core)

Monnaie entière (centimes, arrondi, répartition exacte) ; remises ligne/globale (plafonds, répartition sans perte) ; TVA par taux (exonérée, 7/10/14/20, taux invalides) ; tarification (cohérence base + remises = brut, TTC = base + TVA, monnaie) ; panier (fusion, refus au-dessus du stock, prestation libre, quantité 0, remise, prix) ; paiements (statuts, chèque non encaissé ≠ encaissement, virement non confirmé, monnaie espèces seule, validation avoir/crédit) ; ventes (payload, crédit sans client refusé, panier vide refusé, référence unique, invariants, file offline idempotente).

## Tests à ajouter (plan)

Manquants (absence de script `npm test` — signalé) : partage Mini-POS/POS en navigateur (vérifié manuellement ici), persistance après fermeture (vérifiée via localStorage), idempotence RPC (anti-doublon par référence unique, côté serveur), stock/réception fournisseur, intervention, facture, créance, marge, isolation multi-tenant, rôles/permissions, responsive. Ne pas modifier un test pour faire disparaître un défaut.

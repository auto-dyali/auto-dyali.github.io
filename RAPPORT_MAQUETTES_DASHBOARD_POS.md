# RAPPORT MAQUETTES — DASHBOARD (IMAGE 1) ET POINT DE VENTE (IMAGE 2)

**Projet** : AUTO DYALI — `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**Références** : IMAGE 1 = Dashboard, IMAGE 2 = Point de Vente (fournies par le propriétaire).  
**Principe** : reproduction visuelle des deux images, adaptation au métier automobile, moteur métier POS inchangé, aucun changement Supabase/auth/données.

---

## 1. CORRESPONDANCE MAQUETTE → IMPLÉMENTATION

| Élément de la référence | Élément AUTO DYALI | Composant / fichier | Comportement |
|---|---|---|---|
| Sidebar gauche noire/verte, logo AUTO DYALI | Sidebar maquette (Dashboard et Point de Vente) | `src/components/shell-app.tsx` (`modulesMaquetteDashboard`, `modulesMaquettePos`) | Navigation réelle filtrée par les droits du forfait ; état actif doré ; profil en bas ; déconnexion réelle |
| Dashboard actif en or | Entrée Dashboard active | `shell-app.tsx` (`labelActif`) | Lien `/tableau-de-bord` |
| Mini-POS | Mini-POS Rapide du Dashboard | `src/modules/new-pos/mini-pos/mini-pos.tsx` | Recherche produit, quantité, ajout au panier, total, « Encaisser » → POS complet |
| Point de Vente actif en vert | Entrée Point de Vente active | `shell-app.tsx` (`modulesMaquettePos`) | Lien `/tableau-de-bord/point-de-vente` |
| Recherche top center | Barre de recherche de l’en-tête maquette | `shell-app.tsx` (`.maquette-header`, `.maquette-search`) | Champ de recherche visible (formulaire existant) |
| Cloche notifications, calendrier, date/heure, avatar | Icônes d’en-tête | `shell-app.tsx` | Cloche → `/notifications`, calendrier → `/planning`, date/heure réelles de l’horloge, avatar = initiales du profil |
| Hero voiture verte + logo AUTO DYALI | Hero Dashboard / Point de Vente | `src/components/dashboard/dashboard-maquette.tsx` (`DashboardHero`) | Image existante `car-premium.jpg` teintée vert, titre et tagline de la maquette |
| 4 cartes KPI néon (CA, Bénéfices, Dépenses, Interventions) | 8 KPI réels Supabase | `src/components/dashboard-kpis.tsx`, `src/components/carte-kpi.tsx` | CA, bénéfice net, dépenses, ventes, interventions en cours, valeur du stock, créances clients, trésorerie — aucune valeur de démonstration présentée comme production |
| Évolution Financière (3 courbes) | Courbe multi-séries | `src/components/dashboard-graphiques.tsx`, `src/components/graphiques.tsx` | CA, Dépenses et Bénéfices des 6 derniers mois depuis `sales` + `expenses` |
| Répartition des Activités (donut) | Donut CA par catégorie | `DonutCAReel` | Répartition réelle depuis `sale_items` + `products`, couleurs de la maquette |
| Alertes Importantes | Alertes réelles | `DashboardAlertes` | Stock faible (`products.stock <= min_stock`), RDV demain (`appointments.slot_start`), intervention en cours (`work_orders`) |
| Mini-POS Rapide (recherche, produit, quantité, Ajouter, Total, Encaisser) | Mini-POS Rapide | `mini-pos.tsx` | Moteur `usePos` partagé avec le POS complet ; ajout/quantité/total réels du pricing-engine |
| Activité Récente (timeline) | Activité récente réelle | `DashboardActivite` | Dernières ventes, interventions et achats depuis Supabase |
| Accès Rapide (6 boutons) | Accès rapides | `DashboardAccesRapide` | Nouvelle Vente, Nouvelle Intervention, Gestion Stock, Rapport Financier, Planning, Paramètres — liens réels |
| POS : Point de Vente, recherche produit, Nouvelle Vente, Imprimer | Barre supérieure du POS | `src/components/pos/PosMaquette.tsx` | Recherche instantanée + scan (`ScanChamp`), Nouvelle Vente = vider le panier, Imprimer = impression navigateur |
| POS : catégories Tout / Pneumatiques / Vidange / Freinage / Filtration / Lubrifiants / Accessoires | Pastilles catégories | `PosMaquette.tsx` (`CATEGORIES`) | Filtrage réel du catalogue par catégorie automobile |
| POS : grille produits 5 colonnes, prix or, stock vert, panier | Grille produits | `PosMaquette.tsx` | Clic carte = ajout au panier (moteur `cart-engine`) ; prix et stock réels ; catalogue de test marqué « démo » quand la BDD est injoignable |
| POS : Panier de Vente avec compteur, lignes, quantités, suppression | Panier latéral | `PosMaquette.tsx` | Quantités +/- , suppression, sous-total HT, TVA par taux, total TTC — tous calculés par `pricing-engine` |
| POS : Remise / Client (Optionnel) / Mode de Paiement (bas du catalogue) | Trois contrôles bas | `PosMaquette.tsx` | Remise globale %, sélection/création client, sélection du mode de paiement |
| POS : Espèces / Carte Bancaire / Virement / Mobile / Chèque | Boutons de paiement | `PosMaquette.tsx` | Choix du mode, détails contextualisés (TPE, chèque, virement), ajout de règlements, paiements mixtes |
| POS : Finaliser la Vente (or) | Bouton final | `PosMaquette.tsx` | Validation via `validerVenteCourante` (RPC transactionnel, anti-doublon, offline) |
| POS : ticket | Aperçu ticket après vente | `TicketVente` (existante) | Affiché uniquement après enregistrement serveur/offline |

---

## 2. FICHIERS CRÉÉS

- `src/components/dashboard/dashboard-maquette.tsx` — Hero, Alertes, Activité, Accès Rapide.
- `src/components/pos/PosMaquette.tsx` — nouvel écran Point de Vente fidèle à l’image 2 (moteur `usePos` inchangé).
- `docs-refonte/captures-maquettes/dashboard-mobile.jpeg`, `pos-mobile.jpeg` — captures réelles de contrôle (viewport navigateur disponible).
- `RAPPORT_MAQUETTES_DASHBOARD_POS.md` — ce rapport.

## 3. FICHIERS MODIFIÉS

- `src/components/shell-app.tsx` — sidebar/en-tête maquette pour Dashboard et Point de Vente, libellés automobile, profil bas de sidebar.
- `src/app/tableau-de-bord/page.tsx` — mise en page Dashboard façon image 1.
- `src/app/tableau-de-bord/point-de-vente/page.tsx` — via `FullPos` → `PosMaquette`.
- `src/modules/new-pos/full-pos/full-pos.tsx` — branche le nouvel écran POS.
- `src/modules/new-pos/mini-pos/mini-pos.tsx` — Mini-POS Rapide façon image 1.
- `src/components/dashboard-kpis.tsx` — 8 KPI réels.
- `src/components/carte-kpi.tsx` — style néon des cartes KPI.
- `src/components/dashboard-graphiques.tsx`, `src/components/graphiques.tsx` — courbes CA/Dépenses/Bénéfices et couleurs donut de la maquette.
- `src/modules/new-pos/services/products.service.ts` — libellés familles alignés sur la maquette ; typage du repli produit.
- `src/modules/new-pos/hooks/use-pos.ts` — exposition de `setPanier` (utilisée par les actions de l’écran).
- `src/app/globals.css` — styles scopés `.maquette-shell`, `.maquette-dashboard`, `.maquette-pos` (néon/or uniquement pour ces deux écrans).
- Libellés `actif` mis à jour pour conserver la surbrillance : atelier, clients, caisse, employés, planning, rapports, assistant.

## 4. COMPOSANTS RÉUTILISÉS (inchangés dans leur logique)

`usePos`, `pricing-engine`, `payment-engine`, `cart-engine`, `sales-engine`, services Supabase, `ScanChamp`, `ClientFormulaire`, `TicketVente`, `print-pro`, `shell-app` (sécurité/rôles/forfait), graphiques SVG existants.

## 5. ÉLÉMENTS REPRODUITS

- Direction artistique générale : fond noir-vert, bordures néon émeraude, accents or, cartes opaques à glow, typographie blanche épaisse, logo AUTO DYALI et tagline.
- Structure Dashboard : hero, 4 KPI principaux + 4 KPI secondaires, Évolution / Répartition / Alertes, Mini-POS / Activité / Accès Rapide.
- Structure POS : hero, barre Point de Vente (recherche + Nouvelle Vente + Imprimer), catégories, grille produits, panier latéral avec compteur et total TTC or, contrôles Remise/Client/Mode de Paiement, boutons de paiement et Finaliser la Vente or.
- États actifs dorés/verts, boutons ≥ 48px, responsive mobile/tablette/PC via Tailwind et CSS scopé.

## 6. ÉLÉMENTS ADAPTÉS (et pourquoi)

- **Photos produits** : le dépôt ne contient pas de photos produits par article (pneu, huile, batterie…). Les cartes utilisent un visuel catégorie/monogramme sur fond néon — aucune image fictive présentée comme photo réelle.
- **Hero voiture** : l’image de référence (BMW verte de showroom) n’est pas dans le dépôt. Réutilisation de `car-premium.jpg` (existant) teintée vert via CSS.
- **Badge notifications « 3 »** : non reproduit pour ne pas inventer un nombre de notifications. La cloche mène aux vraies notifications.
- **Comptabilité** : il n’existe pas de module Comptabilité séparé. L’entrée pointe vers la Facturation (module réel existant).
- **Carte Bancaire** : l’image montre un seul bouton ; le moteur exige Visa et Mastercard distincts. Le bouton « Carte Bancaire » ouvre le choix Visa/Mastercard + référence TPE.
- **Crédit/Avoir** : présents dans « Mode de Paiement » (bas de page) plutôt que dans la rangée principale de l’image, pour conserver les 5 boutons de la maquette tout en gardant tous les moyens de paiement.
- **Données KPI/graphiques** : elles restent réelles Supabase. Les valeurs de la maquette (125 750 MAD, 148…) ne sont jamais affichées comme production.

## 7. ÉLÉMENTS NON REPRODUITS

- **Mise en attente / Reprise / Historique dans la barre POS** : l’image 2 ne les montre pas. L’historique reste accessible via la sidebar ; ces fonctions restent disponibles dans le moteur (`usePos`) mais ne sont pas dans la barre principale pour rester fidèle à l’image.
- **Aperçu facture PDF dédié dans le POS** : la facture est générée via le service existant (`invoices.service.ts`) et l’historique ; pas d’aperçu PDF supplémentaire dans cette phase visuelle.
- **Captures Desktop/tablette** : le navigateur de contrôle avait un viewport mobile. Les captures produites sont donc mobiles ; la vérification Desktop/tablette a été faite par DOM (éléments présents, pas de blocage) — voir §8.

## 8. TESTS ET PREUVES

| Contrôle | Résultat |
|---|---|
| Lint | 0 erreur (warnings préexistants uniquement) |
| TypeScript `tsc --noEmit` | 0 erreur |
| Build `npm run build` | ✓ pages statiques générées |
| Tests Print Pro / Scan Pro / POS core | 24/24 · 21/21 · 38/38 |
| Rendu réel local (navigateur, session de test) | Dashboard : hero, 8 KPI, Alertes, Mini-POS Rapide, Activité, Accès Rapide présents, non bloqué sur la session |
| Rendu réel local POS | Catégories Tout/Pneumatiques/Vidange/Freinage/Filtration/Lubrifiants/Accessoires, produits, panier, Remise, Client, Mode de Paiement, 5 moyens de paiement, Finaliser la Vente présents |
| Captures | `docs-refonte/captures-maquettes/dashboard-mobile.jpeg`, `pos-mobile.jpeg` |
| Supabase / auth / données | Non modifiés. Référence fournie dans la mission (`lwepn…`) différente du fallback historique du code (`nxms…`) : aucune modification de configuration effectuée ; la variable d’environnement de production reste la source de vérité |

## 9. PROBLÈMES RESTANTS

- Les 401 observés en test proviennent de la session factice de contrôle (aucune donnée réelle touchée). Les appels Supabase de production doivent être retestés avec le compte réel du propriétaire.
- Pour des captures Desktop/tablette parfaites, il faudrait redimensionner la fenêtre du navigateur de contrôle (viewport mobile pendant cette session) ou fournir les images de référence comme fichiers.
- Migration `0025_pos_core.sql` (préparée lors de la reconstruction) : à exécuter par la propriétaire via SQL Editor pour la vérification serveur des totaux.

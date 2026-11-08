# RAPPORT D'INVENTAIRE INITIAL — AUTO DYALI (Phase 1)

**Date** : 2026-11-08 · **Dépôt** : `github.com/auto-dyali/auto-dyali.github.io` · **Branche** : `main` · **Dernier commit** : `4b3e471` (push OK, Actions success) · **Production** : `https://auto-dyali.github.io` (200)

## 1. État du dépôt
- Dernier commit : `4b3e471` — Design system émeraude doux + scène connexion complète + splash % ; push + Actions success.
- Commit précédent : `faa13e9` — doc rapport opération identité verte.
- Commit `fba0d78` — identité verte (logo, splash, connexion maquette).
- Commit `9ba9ce7` — refonte premium graphite & vert doux (1546 couleurs remappées, connexion protégée).
- GitHub Actions : déploiement Pages vérifié `completed success` sur `4b3e471`.
- Build statique Next 16.4.3 (`output: export`, dossier `out/`), servi par `python3 -m http.server 3100 -d out`.
- Lint : 0 erreur, 1 warning historique `` logo.tsx (toléré).
- Tests : Print Pro 24/24, Scan Pro 21/21.

## 2. Inventaire des modules et fichiers

### Application (pages)
| Fichier | Rôle | Statut |
|---|---|---|
| `src/app/page.tsx` | Splash (chargement 0→100% + redirection /connexion) | Livré |
| `src/app/connexion/page.tsx` | Connexion (nouvelle scène garage, carte verre, « Bienvenue ! », bouton vert, footer marque) | Livré — logique auth intacte |
| `src/app/layout.tsx` | Racine, ShellApp, métadonnées, theme_color `#101F1A` | Livré |
| `src/app/globals.css` | Design system émeraude doux (tokens @theme, .btn-or, .champ, .carte, .panneau-connexion…) | Livré |
| `src/app/manifest.ts` | PWA, icônes 192/512, theme_color | Livré |
| `src/app/tableau-de-bord/page.tsx` | Shell conteneur des modules back-office | Livré |
| `src/app/tableau-de-bord/point-de-vente/page.tsx` | POS (injecte PosModule + RecentSalesModule) | Livré |
| `src/app/tableau-de-bord/catalogue/page.tsx` | Catalogue produits | Présent |
| `src/app/tableau-de-bord/stock/page.tsx` | Stock | Présent |
| `src/app/tableau-de-bord/clients/page.tsx` | Clients | Présent |
| `src/app/tableau-de-bord/vehicules/page.tsx` | Véhicules | Présent |
| `src/app/tableau-de-bord/atelier/page.tsx` | Atelier | Présent |
| `src/app/tableau-de-bord/pneumatiques/page.tsx` | Pneumatiques | Présent |
| `src/app/tableau-de-bord/facturation/page.tsx` | Facturation | Présent |
| `src/app/tableau-de-bord/devis/page.tsx` | Devis | Présent |
| `src/app/tableau-de-bord/caisse/page.tsx` | Caisse | Présent |
| `src/app/tableau-de-bord/cheques/page.tsx` | Chèques | Présent |
| `src/app/tableau-de-bord/creances/page.tsx` | Créances | Présent |
| `src/app/tableau-de-bord/employes/page.tsx` | Employés | Présent |
| `src/app/tableau-de-bord/rapports/page.tsx` | Rapports | Présent |
| `src/app/tableau-de-bord/parametres/page.tsx` | Paramètres | Présent |
| `src/app/tableau-de-bord/super-admin/page.tsx` | Super Admin | Présent |
| `src/app/tableau-de-bord/print-pro/page.tsx` | Print Pro | Livré (moteur) |
| `src/app/tableau-de-bord/scan-pro/page.tsx` | Scan Pro | Livré (moteur) |
| `src/app/employe/page.tsx` | Espace employé | Présent |
| `src/app/espace-client/page.tsx` | Espace client | Présent |
| `src/app/reservation/page.tsx` | Réservations | Présent |
| `src/app/super-admin/crm/page.tsx` | CRM | Présent |

### Composants partagés
| Fichier | Rôle | Statut |
|---|---|---|
| `src/components/pos-module.tsx` (2230 lignes) | **Moteur POS** : catégories, catalogue, recherche multi-champs (nom/EAN/ref/OEM/marque/dimensions/compat), sélecteur véhicule Marque→Modèle→Année→Motorisation→Version, panier produits+prestations, TVA/remise par ligne, paiement mixte (espèces/carte/chèque/virement/mobile/partiel/crédit), encaissement transactionnel RPC `create_pos_sale`, anti double-vente (verrou + ref unique), impression ticket, reçu enrichi, création rapide client/véhicule, pavé numérique tactile, ScanChamp | **Moteur métier complet** — structure visuelle à réorganiser (Phase 3/4/5) |
| `src/components/shell-app.tsx` | Shell connecté : sidebar 14 entrées, en-tête, déconnexion, droits, offline, barre mobile fixe | Livré |
| `src/components/logo.tsx` | Logo badge circulaire (nouveau) + sous-titre | Livré |
| `src/components/icones.tsx` | Icônes SVG (ca, voiture, carton, client, cle, pos, scanner, imprimante…) | Livré |
| `src/components/scan-champ.tsx` | Champ scan douchette/QR | Présent |
| `src/components/scanner-camera.tsx` | Scan caméra smartphone | Présent |
| `src/components/pave-numerique.tsx` | Pavé numérique tactile 48px | Livré |
| `src/components/print-pro-module.tsx` | Impression tickets/factures (ESC/POS, 58/80/A4, sélection imprimante, réimpression) | Livré |
| `src/components/scan-pro-module.tsx` | Scan Pro (EAN-13, JSBarcode, association produit) | Livré |
| `src/components/backoffice-modules.tsx` | RecentSalesModule + autres modules back-office | Présent |
| `src/components/carte-kpi.tsx`, `dashboard-kpis.tsx`, `dashboard-graphiques.tsx`, `dashboard-live.tsx` | Dashboard | Présent |
| `src/components/catalogue-module.tsx`, `stock-module.tsx`, `clients-module.tsx`, `vehicules-module.tsx`, `atelier-module.tsx`, `tire-module.tsx`, `facturation`-related, `quotes-module`, `cheques-module`, `employes-module`, `suppliers-module`, `achats-complements-module`, `reports-advanced-module`, `sales-history-module`, `echeances-module`, `excel-module`, `assistant-ai`, `crm-module`, `notifications-module`, `support-module`, `module-en-construction`, `module-table` | Modules back-office | Présents |

### Librairies
| Fichier | Rôle | Statut |
|---|---|---|
| `src/lib/print-pro.ts` (732 lignes) | Moteur impression HTML + ESC/POS + données ticket | Livré (24 tests) |
| `src/lib/print-pro-client.ts` | Impression navigateur, imprimantes, journal | Livré |
| `src/lib/scan-pro.ts` (343 lignes) | Moteur scan EAN-13/QR + association | Livré (21 tests) |
| `src/lib/features.ts` | Moteur droits (plans standard/silver/gold, RPC my_features, RLS has_feature) | Présent |
| `src/lib/supabase-browser.ts` | Client Supabase browser | Présent |
| `src/lib/catalogue-test.ts` | Catalogue de test hors-ligne | Présent |
| `src/lib/mock-data.ts` | Données mock | Présent |
| `src/lib/utils.ts` | `cn` utilitaire | Présent |

## 3. Moteur de vente (POS) — fonctions présentes
- Catalogue produits depuis Supabase (`products`) avec repli catalogue de test
- Recherche multi-champs : désignation, EAN, réf fabricant, OEM, marque, catégorie, dimensions pneus, compatibilité
- Sélecteur véhicule : Marque → Modèle → Année → Motorisation → Version (table `vehicle_catalog`)
- Compatibilité pièce/véhicule : **uniquement les compatibilités vérifiées** (`part_compatibilities.verified = true`)
- Panier : produits ET prestations (services + lignes libres) ; TVA et remise par ligne ; prestations ne touchent pas au stock
- Client + véhicule optionnels ; création rapide client/véhicule si permission
- Remise ticket (pourcentage + montant MAD) avec permission `pos.edit`
- Paiement : espèces, carte, chèque, virement, mobile, partiel, crédit ; règlements mixtes (1 ou N modes)
- Montant reçu, monnaie à rendre, reste dû
- Encaissement transactionnel via RPC `create_pos_sale` (migration 0021), repli multi-inserts
- Anti double-encaissement : verrou React ref + référence unique en base
- Impression ticket (Print Pro) + reçu enrichi (caissier, véhicule, règlements, réimpression tracée)
- Historique des ventes, réimpression contrôlée

## 4. Design system (tokens appliqués)
| Token | Valeur | Usage |
|---|---|---|
| `--color-fond` | `#252D2D` | Graphite — fond principal |
| `--color-fond2` | `#1F2626` | Graphite profond |
| `--color-carte` | `#2C3735` | Cartes |
| `--color-carte-2` | `#344440` | Cartes secondaires / champs |
| `--color-emeraude` | `#49675B` | Boutons primaires (émeraude doux) |
| `--color-emeraude-clair` | `#55776A` | Survol actions |
| `--color-sauge` | `#A7B7A8` | Texte secondaire |
| `--color-champagne` | `#D0C6AE` | Titres, relief |
| `--color-or` | `#8FB59B` | Accent, bordures, sélection, focus |
| `--color-ivoire` | `#E8ECE8` | Texte principal |
| `--color-succes` | `#5D9E7F` | Succès |
| `--color-erreur` | `#C5716B` | Erreur |

Classes conservées (anti-régression) : `.btn-or`, `.btn-or-3d`, `.carte`, `.carte-2`, `.champ`, `.champ-3d`, `.titre-or`, `.formulaire-3d`, `.panneau-connexion`, `.splash-bg`, `.splash-art`, `.apparaitre`.

## 5. Problèmes identifiés (PC / tablette / smartphone / tactile)

### POS (point-de-vente)
| Zone | Problème | Gravité |
|---|---|---|
| Structure PC | Actuellement `grid xl:grid-cols-[13rem_1fr_23rem]` : sidebar = catégories produits (pas une vraie barre de navigation POS avec les 12 boutons demandés) ; pas de barre latérale POS fixe dédiée | Moyenne |
| Smartphone | Barre fixe bas (panier + paiement) présente ; panier en feuille plein écran. Manque : en-tête compact dédié, barre de navigation inférieure 5 onglets (POS, Catalogue, Panier, Clients, Menu), recherche accessible, zones de sécurité iOS | Élevée |
| Tablette | Pas de disposition compacte dédiée (reprend la grille PC) | Moyenne |
| Cibles tactiles | Boutons « Ajouter » catalogue `min-h-9` (≈36px) < 48px demandés ; boutons modes paiement `min-h-11` OK | Moyenne |
| Défilement | `max-h-[52vh]` sur la grille catalogue — acceptable mais pas de verrouillage du défilement général | Basse |
| Clavier virtuel | Pas de prévention de masquage des champs (inputMode decimal sur montant reçu OK) | Moyenne |

### Autres pages
- Dashboard, stock, clients, véhicules, atelier, facturation, etc. : utilisent ShellApp (sidebar rétractable, en-tête) — utilisables sur smartphone mais non optimisés (pas de vues dédiées mobile)
- Connexion : arrière-plan image **protégé** (jamais modifié) — nouvelle scène servie, logo mural non coupé, variantes desktop/mobile

## 6. Permissions et transactions Supabase
- Auth : `supabase.auth.signInWithPassword`, `signOut`, `get_session`
- Rôles : `saas_admin`, `manager`, `employee`, `client` ; redirections après connexion
- Garde de rôle ShellApp : uniquement `manager` / `saas_admin` accèdent au back-office
- Moteur droits `features.ts` : plans + `my_features()` RPC + RLS `has_feature()` ; repli hors-ligne (fonctions de base ouvertes)
- POS : permissions `pos`, `clients`, `vehicules`, `atelier` via table `permissions`
- Transactions : `create_pos_sale` RPC (transactionnel), repli multi-inserts si migration absente
- Anti-doublon : verrou + référence unique
- **Aucune migration destructive** ; migrations `0021→0024` à exécuter par la propriétaire via SQL Editor (jamais par l'agent)

## 7. Scan Pro / Print Pro
| Fonction | Statut | Test |
|---|---|---|
| Scan caméra smartphone | Présent (`scanner-camera.tsx`) | Non testé physiquement |
| Scanner USB HID / Bluetooth | `scan-champ.tsx` (écoute clavier) | Non testé physiquement |
| Scan Bluetooth | Non spécifié | Non testé |
| Recherche EAN / OEM / référence | Dans moteur POS | Logique présente |
| Reconnaissance QR | `scan-pro.ts` | Présent |
| Association codes → produits | Dans moteur POS | Présent |
| Impression tickets / factures | Print Pro (ESC/POS, 58/80/A4) | 24 tests verts |
| Sélection imprimante | `print-pro-client.ts` | Présent |
| Réimpression contrôlée + historique | Reçu enrichi + journal | Présent |

**Règle respectée** : aucune compatibilité physique annoncée sans test.

## 8. Fonctionnalités : présentes / partielles / absentes / non vérifiables

### Présentes et vérifiées
- Design system émeraude doux appliqué à toute l'app
- Nouvel identite visuelle : logo badge, splash, scène connexion (maquette respectée)
- Moteur POS métier complet (catégorie, recherche, véhicule, panier, paiement, encaissement, impression)
- Print Pro 24/24, Scan Pro 21/21
- Auth + redirections rôles + garde de rôle
- Build statique 40/40, lint 0 erreur, déploiement prod vérifié

### Partielles
- Vues mobile dédiées par module (dashboard, stock, clients…) — pas de vues smartphone dédiées, seulement responsive via Tailwind
- Barre latérale POS fixe avec les 12 boutons demandés — à créer (Phase 3)

### Absentes / non vérifiables
- Test physique imprimante thermique (58/80mm) — non effectué (pas de matériel)
- Test physique scanner USB/Bluetooth — non effectué (pas de matériel)
- Paiement carte TPE physique — non testé (logique logicielle uniquement)
- Données Supabase réelles — non configurées (clés absentes) ; repli catalogue de test + message « Supabase n'est pas configuré »

## 9. Fichiers clés concernés par la suite de la mission
- `src/components/pos-module.tsx` — restructuration structure PC + smartphone + tablette
- `src/app/globals.css` — design system (déjà mis à jour, extensions tactiles 48px)
- `src/components/shell-app.tsx` — barre mobile (déjà présente, à adapter pour le POS)
- `src/components/pave-numerique.tsx` — pavé tactile (présent)
- `src/lib/print-pro.ts`, `src/lib/scan-pro.ts` — déjà livrés
- Migrations `0021→0024` SQL — à exécuter par la propriétaire (jamais par l'agent)

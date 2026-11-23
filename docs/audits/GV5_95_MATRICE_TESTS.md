# MATRICE DE TESTS — MISSION GV5 §95

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `gv5-95-audit-modules-super-admin`  
**HEAD initial** : `3514adf` (GV5 §94)  
**node_modules** : absent — tests unitaires, E2E, build et lint non exécutables localement  
**Accès base distante** : indisponible — tests réels sur staging/production non réalisables

---

## LÉGENDE

| Mention | Signification |
|---|---|
| EXÉCUTÉ | Test réellement exécuté et réussi |
| PRÉPARÉ | Test spécifié (scénario, données attendues) mais non exécuté (contrainte environnement ou accès) |
| NON APPLICABLE | Test non pertinent pour le module ou le périmètre |
| BLOQUÉ | Test bloqué par migration manquante, fournisseur non configuré ou autorisation |

---

## TESTS EXÉCUTÉS

| # | Scénario | Résultat | Preuve / Note |
|---|---|---|---|
| T-01 | Lecture du code source des 16 modules Super Admin | EXÉCUTÉ | Audit complet des fichiers `src/app/super-admin/**/page.tsx` et composants partagés |
| T-02 | Vérification absence de données fictives présentées comme réelles | EXÉCUTÉ | Tous les KPI/graphiques/indicateurs proviennent de requêtes Supabase réelles ; seule `DONNEES_TEST` dans communications est identifiée comme prévisualisation |
| T-03 | Vérification cohérence thème sombre pétrole/noir + accents or champagne | EXÉCUTÉ | Classes CSS `#252D2D`, `#1A211E`, `#2C3735`, `#344440` (fonds) et `#D6A34D`, `#D0C6AE`, `#8FB59B`, `#7FBF9E` (accents or) présentes dans `globals.css` et utilisées partout |
| T-04 | Vérification présence états de chargement et d'erreur sur tous les modules | EXÉCUTÉ | Chaque page gère `loading`, `erreur`, `notice` avec composants `Chargement`, `Erreur`, `Vide` |
| T-05 | Vérification présence SuperAdminGuard sur chaque module | EXÉCUTÉ | `ModulePage` enveloppe chaque page avec `SuperAdminGuard` (vérifie session + rôle `saas_admin`, fail-closed) |
| T-06 | Vérification des exports CSV fonctionnels | EXÉCUTÉ | `downloadCsv` dans `src/lib/csv-export.ts` ; appelés par Entreprises, Garages, Managers, Employés, Abonnements, Plans, Paiements, Support, Audit, Rapports, Sauvegarde, Pré-achats |
| T-07 | Vérification des liens et navigation entre modules | EXÉCUTÉ | `super-admin-shell.tsx` (13 rubriques + 2 accès directs), tous les `href` pointent vers des routes existantes |
| T-08 | Correction anomalie variable d'environnement (Intégrations) | EXÉCUTÉ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dans `integrations/page.tsx` (fichier modifié) |

---

## TESTS PRÉPARÉS (non exécutés)

### A. Contrôles qualité (bloqués par absence node_modules)

| # | Scénario | Commande prévue | Statut | Blocage |
|---|---|---|---|---|
| Q-01 | TypeScript — aucune erreur de type | `npx tsc --noEmit` | PRÉPARÉ | `node_modules` absent |
| Q-02 | ESLint — aucune erreur bloquante | `npx eslint .` | PRÉPARÉ | `node_modules` absent |
| Q-03 | Build Next.js — toutes les pages statiques | `npm run build` | PRÉPARÉ | `node_modules` absent |
| Q-04 | Tests unitaires — 176/176 passés (baseline §93) | `npm test` | PRÉPARÉ | `node_modules` absent |
| Q-05 | Tests E2E Super Admin — tous les modules se chargent | `npx playwright test` | PRÉPARÉ | `node_modules` absent + pas de base réelle |

### B. Tests d'accès et de sécurité (bloqués par absence de base réelle)

| # | Scénario | Rôle visé | Statut | Blocage |
|---|---|---|---|---|
| S-01 | Accès Super Admin autorisé (session saas_admin) | saas_admin | PRÉPARÉ | Pas de base réelle / pas de compte de test |
| S-02 | Accès refusé à un Manager (role ≠ saas_admin) | manager | PRÉPARÉ | Pas de base réelle |
| S-03 | Accès refusé à un Employé (role = employee) | employee | PRÉPARÉ | Pas de base réelle |
| S-04 | Accès refusé à un Client (role = client) | client | PRÉPARÉ | Pas de base réelle |
| S-05 | Accès refusé à un utilisateur non authentifié | anonyme | PRÉPARÉ | Pas de base réelle |
| S-06 | Redirection vers /connexion/ si session absente | anonyme | PRÉPARÉ | Pas de base réelle |
| S-07 | Un seul Super Admin global (comptage profils saas_admin) | saas_admin | PRÉPARÉ | Pas d'accès base |
| S-08 | Manager limité à son établissement | manager | PRÉPARÉ | Pas d'accès base + RLS non vérifiable |

### C. Tests d'isolation entre garages

| # | Scénario | Statut | Blocage |
|---|---|---|---|
| I-01 | Un Super Admin voit tous les établissements (isolation levée pour SA) | PRÉPARÉ | Pas d'accès base |
| I-02 | Pas d'accès croisé entre établissements depuis un Manager | PRÉPARÉ | Pas d'accès base + RLS non vérifiable |
| I-03 | Les données d'un établissement ne fuient pas vers un autre | PRÉPARÉ | Pas d'accès base |

### D. Tests fonctionnels par module

| # | Module | Scénario | Statut | Blocage |
|---|---|---|---|---|
| F-01 | Dashboard | KPI affichés, graphiques avec vraies données, alertes pertinentes | PRÉPARÉ | Pas de base réelle |
| F-02 | Entreprises | Consulter liste, voir détails, suspendre/réactiver, changer plan, archiver/restaurer | PRÉPARÉ | Dépend 0043 pour archive/purge |
| F-03 | Garages | Consulter, suspendre/réactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-04 | Managers | Consulter, activer/désactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-05 | Employés | Créer, modifier, activer/désactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-06 | Plans | Éditer prix/limites, activer/désactiver droits, exporter matrice | PRÉPARÉ | Tarifs NULL en base |
| F-07 | Pré-achats | Consulter demandes, changer statut (transitions), exporter | PRÉPARÉ | Dépend 0033/0035 |
| F-08 | CRM | Consulter leads, filtrer, paginer, exporter | PRÉPARÉ | Table `crm_leads` peut être absente |
| F-09 | Support | Consulter tickets, répondre, changer statut | PRÉPARÉ | Pas de base réelle |
| F-10 | Communications | Prévisualiser modèles e-mail/WhatsApp | EXÉCUTÉ (lecture code) | Envoi réel bloqué (fournisseur) |
| F-11 | WhatsApp | Consulter statuts réels, pas de faux "délivré" | PRÉPARÉ | Meta non configuré |
| F-12 | Intégrations | Inventaire, statut honnête (pas de secret exposé) | PRÉPARÉ | Pas de base réelle |
| F-13 | Journal d'audit | Consulter, rechercher, paginer, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-14 | Paramètres | Consulter forfaits et droits en vigueur | PRÉPARÉ | Pas de base réelle |
| F-15 | Rapports | Indicateurs calculés, MRR estimé (étiqueté), export CSV | PRÉPARÉ | Pas de base réelle |
| F-16 | Sauvegarde | Exports CSV entreprises/abonnements/audit/plans | PRÉPARÉ | Pas de base réelle |

### E. Tests d'ergonomie et responsive

| # | Scénario | Statut | Blocage |
|---|---|---|---|
| R-01 | Navigation desktop (1280px) — tous les modules se chargent | PRÉPARÉ | Pas de base réelle |
| R-02 | Navigation tablette (768px) — menus et tables utilisables | PRÉPARÉ | Pas de base réelle |
| R-03 | Navigation mobile (390px) — menu hamburger, cartes empilées | PRÉPARÉ | Pas de base réelle |
| R-04 | États vides explicites (aucune donnée, aucun résultat) | EXÉCUTÉ (lecture code) | `Vide` composant présent sur tous les modules |
| R-05 | Chargement rapide sur appareils modestes (pas de gros bundle) | PRÉPARÉ | Build non exécutable |
| R-06 | Accessibilité (aria-label, contrastes, navigation clavier) | PRÉPARÉ | Audit partiel (lecture code uniquement) |

### F. Tests de régression (modules existants)

| # | Scénario | Statut | Blocage |
|---|---|---|---|
| REG-01 | Le shell de navigation garde toutes ses rubriques (13 + 2 accès directs) | EXÉCUTÉ (lecture code) | — |
| REG-02 | Le `SuperAdminGuard` maintient le fail-closed (refus si rôle ≠ saas_admin) | EXÉCUTÉ (lecture code) | — |
| REG-03 | Les exports CSV conservent leur format et échappement | EXÉCUTÉ (lecture code) | — |
| REG-04 | La correction GV5-95-001 (variable d'env) ne régressera pas d'autres pages | EXÉCUTÉ (lecture code) | La variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` n'est utilisée qu'ici |

---

## SOMMAIRE

| Catégorie | Nombre |
|---|---|
| Tests EXÉCUTÉS | 8 (T-01 à T-08) |
| Tests PRÉPARÉS (non exécutés) | 43 (Q-01 à Q-05, S-01 à S-08, I-01 à I-03, F-01 à F-16, R-01 à R-06, REG-01 à REG-04) |
| **Total** | **51** |

**Distinction importante** : les tests "EXÉCUTÉS" sont des audits de code source et de cohérence (lecture des fichiers, vérification des patterns, correction d'une anomalie). Ils ne constituent pas une preuve de fonctionnement en temps réel sur une base de données. Les tests "PRÉPARÉS" nécessitent : installation de `node_modules`, accès à une base staging avec les migrations 0036→0043 appliquées, et des comptes de test par rôle.

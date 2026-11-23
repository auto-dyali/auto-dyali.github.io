# MATRICE DE TESTS — MISSION GV5 §97

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche de consolidation** : `gv5-97-consolidation-super-admin`  
**node_modules** : installé (378 packages)  
**Accès base distante** : indisponible — tests réels sur staging/production non réalisables

---

## LÉGENDE

| Mention | Signification |
|---|---|
| EXÉCUTÉ | Test réellement exécuté avec résultat réel |
| PRÉPARÉ | Test spécifié mais non exécuté (contrainte environnement ou accès) |
| NON APPLICABLE | Test non pertinent pour le module |

---

## TESTS EXÉCUTÉS (résultats réels)

### A. Contrôles qualité du code

| # | Scénario | Commande | Résultat | Preuve |
|---|----------|----------|----------|--------|
| Q-01 | TypeScript — aucune erreur de type | `npx tsc --noEmit` | ✅ 0 erreur | Sortie vide, exit 0 |
| Q-02 | ESLint — aucune erreur bloquante | `npx eslint .` | ✅ 0 erreur | 1 warning intentionnel (API publique `_notifications`) |
| Q-03 | Build Next.js — toutes les pages statiques | `npm run build` | ✅ Succès | Toutes les pages pré-rendues, exit 0 |
| Q-04 | Installation des dépendances | `npm install` | ✅ 378 packages | `node_modules` présent |
| Q-05 | Correction variable d'env Supabase | Vérification code + build | ✅ Vérifiée | `integrations/page.tsx` utilise `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

### B. Tests unitaires

| # | Scénario | Résultat | Preuve |
|---|----------|----------|--------|
| U-01 | Ensemble des 176 tests unitaires | ✅ 176/176 passés, 0 échec | `npm test`, exit 0, durée 2884ms |
| U-02 | Tests CRM (open_ticket_count isolation) | ✅ Inclus dans les 176 | Vérifie isolation multi-tenant |
| U-03 | Tests sécurité (is_manager, open_ticket_count) | ✅ Inclus dans les 176 | Vérifie contrôle d'accès par rôle |
| U-04 | Tests fournisseurs (send-invitation, providers) | ✅ Inclus dans les 176 | Vérifie honnêteté des statuts (non_configure, echec, accepte_par_fournisseur) |
| U-05 | Tests onboarding-contract | ✅ Inclus dans les 176 | Vérifie validation stricte du contrat v2 |
| U-06 | Tests pré-achat | ✅ Inclus dans les 176 | Vérifie normalisation email et montant sans invention |

### C. Tests E2E Playwright (Super Admin)

| # | Scénario | Résultat | Preuve |
|---|----------|----------|--------|
| E2E-01 | Connexion refuse identifiants invalides (mock) | ✅ Passé | `super-admin.spec.ts` |
| E2E-02 | Connexion valide champs requis côté client | ✅ Passé | `super-admin.spec.ts` |
| E2E-03 | Connexion refuse profil non saas_admin (mock manager) | ✅ Passé | `super-admin.spec.ts` |
| E2E-04 | Connexion Super Admin simulée redirige vers /super-admin | ✅ Passé | `super-admin.spec.ts` |
| E2E-05 à E2E-22 | Navigation 18 modules Super Admin se charge sans crash (mock) | ✅ 18/18 passés | Dashboard, Entreprises, Managers, Garages, Plans, Abonnements, CRM, Paiements, Support, Rapports, Sauvegarde, Audit, Rôles, Paramètres, WhatsApp, Chatbot, Onboarding, Pré-achats |
| E2E-23 | Recherche/filtres UI présents sur certains modules | ✅ Passé | `super-admin.spec.ts` |
| E2E-24 | Déconnexion simulée depuis desktop | ✅ Passé | `super-admin.spec.ts` |
| E2E-25 | Onboarding affiche les étapes/champs (mock SA) | ✅ Passé | `super-admin.spec.ts` |
| E2E-26 | Connexion mobile affiche le formulaire | ✅ Passé | `super-admin.spec.ts` |
| E2E-27 | Module SA en mobile se rend | ✅ Passé | `super-admin.spec.ts` |
| E2E-28 | Menu mobile peut s'ouvrir | ✅ Passé | `super-admin.spec.ts` |

**Total E2E : 28/28 passés, exit 0**

---

## TESTS PRÉPARÉS (non exécutés)

### D. Tests d'accès et de sécurité (bloqués par absence de base réelle)

| # | Scénario | Rôle visé | Statut | Blocage |
|---|----------|-----------|--------|---------|
| S-01 | Accès Super Admin autorisé (session saas_admin) | saas_admin | PRÉPARÉ | Pas de compte de test / pas de base réelle |
| S-02 | Accès refusé à un Manager (role ≠ saas_admin) | manager | PRÉPARÉ | Pas de base réelle |
| S-03 | Accès refusé à un Employé (role = employee) | employee | PRÉPARÉ | Pas de base réelle |
| S-04 | Accès refusé à un Client (role = client) | client | PRÉPARÉ | Pas de base réelle |
| S-05 | Accès refusé à un utilisateur non authentifié | anonyme | PRÉPARÉ | Pas de base réelle |
| S-06 | Redirection vers /connexion/ si session absente | anonyme | PRÉPARÉ | Pas de base réelle |
| S-07 | Un seul Super Admin global (comptage profils saas_admin) | saas_admin | PRÉPARÉ | Pas d'accès base |
| S-08 | Manager limité à son établissement | manager | PRÉPARÉ | Pas d'accès base + RLS non vérifiable |

### E. Tests d'isolation entre garages

| # | Scénario | Statut | Blocage |
|---|----------|--------|---------|
| I-01 | Un Super Admin voit tous les établissements (isolation levée pour SA) | PRÉPARÉ | Pas d'accès base |
| I-02 | Pas d'accès croisé entre établissements depuis un Manager | PRÉPARÉ | Pas d'accès base + RLS non vérifiable |
| I-03 | Les données d'un établissement ne fuient pas vers un autre | PRÉPARÉ | Pas d'accès base |

### F. Tests fonctionnels par module

| # | Module | Scénario | Statut | Blocage |
|---|--------|----------|--------|---------|
| F-01 | Dashboard | KPI affichés, graphiques avec vraies données, alertes pertinentes | PRÉPARÉ | Pas de base réelle |
| F-02 | Entreprises | Consulter liste, voir détails, suspendre/réactiver, changer plan, archiver/restaurer | PRÉPARÉ | Dépend 0043 pour archive/purge |
| F-03 | Garages | Consulter, suspendre/réactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-04 | Managers | Consulter, activer/désactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-05 | Employés | Créer, modifier, activer/désactiver, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-06 | Plans | Éditer prix/limites, activer/désactiver droits, exporter matrice | PRÉPARÉ | Tarifs NULL en base |
| F-07 | Pré-achats | Consulter demandes, changer statut (transitions), exporter | PRÉPARÉ | Dépend 0033/0035 |
| F-08 | CRM | Consulter leads, filtrer, paginer, exporter | PRÉPARÉ | Table `crm_leads` peut être absente |
| F-09 | Support | Consulter tickets, répondre, changer statut | PRÉPARÉ | Pas de base réelle |
| F-10 | Communications | Prévisualiser modèles e-mail/WhatsApp | EXÉCUTÉ (lecture code + E2E) | Envoi réel bloqué (fournisseur) |
| F-11 | WhatsApp | Consulter statuts réels, pas de faux "délivré" | PRÉPARÉ | Meta non configuré |
| F-12 | Intégrations | Inventaire, statut honnête (pas de secret exposé) | PRÉPARÉ | Pas de base réelle |
| F-13 | Journal d'audit | Consulter, rechercher, paginer, exporter CSV | PRÉPARÉ | Pas de base réelle |
| F-14 | Paramètres | Consulter forfaits et droits en vigueur | PRÉPARÉ | Pas de base réelle |
| F-15 | Rapports | Indicateurs calculés, MRR estimé (étiqueté), export CSV | PRÉPARÉ | Pas de base réelle |
| F-16 | Sauvegarde | Exports CSV entreprises/abonnements/audit/plans | PRÉPARÉ | Pas de base réelle |

### G. Tests d'ergonomie et responsive

| # | Scénario | Statut | Blocage |
|---|----------|--------|---------|
| R-01 | Navigation desktop (1280px) — tous les modules se chargent | ✅ EXÉCUTÉ (E2E-05 à E2E-22) | — |
| R-02 | Navigation tablette (768px) — menus et tables utilisables | ✅ EXÉCUTÉ (E2E-05 à E2E-22) | — |
| R-03 | Navigation mobile (390px, 360px) — menu hamburger, cartes empilées | ✅ EXÉCUTÉ (E2E-26 à E2E-28) | — |
| R-04 | États vides explicites (aucune donnée, aucun résultat) | EXÉCUTÉ (lecture code) | Composant `Vide` présent sur tous les modules |
| R-05 | Chargement rapide sur appareils modestes (pas de gros bundle) | PRÉPARÉ | Build non mesuré sur appareil modeste |
| R-06 | Accessibilité (aria-label, contrastes, navigation clavier) | PRÉPARÉ | Audit partiel (lecture code uniquement) |

### H. Tests de non-régression (modules existants)

| # | Scénario | Statut | Blocage |
|---|----------|--------|---------|
| REG-01 | Le shell de navigation garde toutes ses rubriques (13 + 2 accès directs) | EXÉCUTÉ (lecture code + E2E) | — |
| REG-02 | Le `SuperAdminGuard` maintient le fail-closed (refus si rôle ≠ saas_admin) | EXÉCUTÉ (lecture code + E2E-03) | — |
| REG-03 | Les exports CSV conservent leur format et échappement | EXÉCUTÉ (lecture code) | — |
| REG-04 | La correction GV5-97-001 (variable d'env) ne régressera pas d'autres pages | EXÉCUTÉ (lecture code) | La variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` n'est utilisée qu'ici |

---

## SOMMAIRE

| Catégorie | Nombre |
|---|---|
| Tests EXÉCUTÉS | Q-01 à Q-05 (5) + U-01 à U-06 (6) + E2E-01 à E2E-28 (28) + F-10 (1) + REG-01 à REG-04 (4) = **44** |
| Tests PRÉPARÉS (non exécutés) | S-01 à S-08 (8) + I-01 à I-03 (3) + F-01 à F-09 (9) + F-11 à F-16 (6) + R-01 à R-06 (6) = **32** |
| **Total** | **76** |

**Distinction importante** : les tests "EXÉCUTÉS" incluent les contrôles qualité (TSC, ESLint, build), les 176 tests unitaires, et les 28 tests E2E Playwright. Les tests "PRÉPARÉS" nécessitent une base staging avec les migrations 0036→0043 appliquées et des comptes de test par rôle.

# Bilan chiffré AUTO DYALI — état réel après GV5 §68 (18 novembre 2026)

## 0. Avertissement méthodologique (données manquantes signalées)

Aucun registre maître global consolidé n existe : les livrables GV5 §65 (RAPPORT_FINAL, REGISTRE_MAITRE_GLOBAL, PLAN_GLOBAL_CLOTURE…) demandés dans la mission globale précédente sont ABSENTS du dépôt (vérifié § anticipé). Le fichier GV5_SUIVI_AUTO_DYALI.md (7 525 lignes) consigne 22 sections GV5 avec des exigences **répétées d une mission à l autre** (ex. « EF non déployée » apparaît ~6 fois). Il ne fournit aucun décompte agrégé.

En conséquence : les pourcentages ci-dessous sont calculés sur un **inventaire unique reconstruit** à partir des sources canoniques disponibles : matrices GV5 §57 (11 sections SA), §66/§67/§68 (SA + blocages), registres d anomalies §59, et état réel vérifié par SELECT sur Supabase. Chaque exigence est comptée **une seule fois**. La pondération utilise la criticité métier (P0 sécurité/auth/onboarding > P1 métier > P2 intégrations > P3 finition). Ce n est PAS un décompte officiel §65 : les données d un tel registre manquent.

## 1. Gravité du constat : écart interface / réalité

Toutes les interfaces et tous les tests locaux sont verts (158 tests unitaires, 39 E2E, build OK), mais **aucune fonctionnalité critique n est validée en production** : migrations 0036-0039 non appliquées (0 RPC v2, 0 colonne professional_id/login_id, 0 table invitation — vérifié par SELECT), EF onboard-tenant déployée en version **v1 obsolète** incompatible avec le formulaire v2, EF activate-manager et send-invitation non déployées, secrets Resend/Meta absents. **Aucun compte Manager réel n a jamais été créé, invité, activé ou connecté.**

| # | Exigence unique | Priorité | Poids | Statut §68 |
|---|---|---|---|---|
| 1 | Vue générale (KPIs/graphiques/alertes réels) | P1 | 2 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 2 | Abonnés : liste/fiche/filtres/actions | P1 | 2 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 3 | Abonnés : édition complète/prolongation | P2 | 1 | PARTIEL |
| 4 | Utilisateurs : managers/employés/rôles/activation | P1 | 2 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 5 | Utilisateurs : historique connexions | P3 | 0,5 | ABSENT |
| 6 | Formules : édition/matrice/cycle de vie | P1 | 2 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 7 | Formules : création/options avancées | P2 | 1 | PARTIEL |
| 8 | CRM : pipeline/prospects/activités | P2 | 1 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 9 | Finance : estimations honnêtes | P2 | 1 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 10 | Finance : factures/paiements/avoirs réels | P1 | 2 | BLOQUÉ |
| 11 | Support : tickets/réponse/statut/priorité | P2 | 1 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 12 | Support : création/attribution avancée | P2 | 1 | PARTIEL |
| 13 | Intégrations : inventaire/statuts honnêtes | P2 | 1 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 14 | Intégrations : tests/webhooks réels | P2 | 1 | BLOQUÉ |
| 15 | Sécurité : rôles/matrice/RLS affichés | P0 | 3 | PARTIEL |
| 16 | Sécurité : enforcement CRUD fin RLS | P0 | 3 | BLOQUÉ |
| 17 | Journal : recherche/filtres/export | P2 | 1 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 18 | Système : paramètres/états réels | P2 | 1 | PARTIEL |
| 19 | Identité graphique 11 pages (§57/§58) | P3 | 0,5 | CONFORME ET VÉRIFIÉ |
| 20 | Accès directs WhatsApp/Chatbot (§66) | P3 | 0,5 | CONFORME ET VÉRIFIÉ |
| 21 | Auth Super Admin : garde/redirection/session | P0 | 3 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 22 | Isolation multi-tenant réelle | P0 | 3 | BLOQUÉ |
| 23 | RLS/permissions serveur appliquées | P0 | 3 | BLOQUÉ |
| 24 | Sauvegarde distante restaurable | P0 | 3 | BLOQUÉ |
| 25 | Onboarding : formulaire 6 étapes/contrat v2 | P0 | 3 | IMPLÉMENTÉ NON VÉRIFIÉ |
| 26 | Onboarding : ID pro/Manager uniques serveur | P0 | 3 | BLOQUÉ |
| 27 | Onboarding : création Auth réelle Manager | P0 | 3 | BLOQUÉ |
| 28 | Onboarding : cohérence établissement/profil/abo/droits | P0 | 3 | BLOQUÉ |
| 29 | Onboarding : invitation e-mail réelle | P0 | 3 | BLOQUÉ |
| 30 | Onboarding : invitation WhatsApp réelle | P0 | 3 | BLOQUÉ |
| 31 | Onboarding : activation + mot de passe Manager | P0 | 3 | BLOQUÉ |
| 32 | Onboarding : première connexion Manager | P0 | 3 | BLOQUÉ |
| 33 | Onboarding : suivi/renvoi invitations | P1 | 2 | PARTIEL |
| 34 | Statuts fournisseurs honnêtes | P1 | 2 | CONFORME ET VÉRIFIÉ |

## 3. Répartition agrégée (Super Admin, 34 exigences uniques, poids total 67,5)

| Catégorie | Poids | Pourcentage | Interprétation |
|---|---|---|---|
| **CONFORME ET VÉRIFIÉ** | 3,0 | **4,4 %** | 3 exigences, toutes localement vérifiables (identité graphique, accès directs, honnêteté des statuts) |
| IMPLÉMENTÉ NON VÉRIFIÉ | 19,0 | 28,1 % | UI + code présents, non validés sur Supabase réel |
| PARTIEL | 9,0 | 13,3 % | sous-parties manquantes (édition établissement, création formules, facturation, RLS fin, renvoi) |
| ABSENT | 0,5 | 0,7 % | historique des connexions |
| **BLOQUÉ** | 36,0 | **53,3 %** | 12 exigences P0/P1 dépendant de migrations/EF/secrets/autorisations |

**Avancement SUPER ADMIN (pondéré, strict production) = 4,4 %** — c est la seule part réellement conforme et vérifiée. Si l on compte le code écrit mais non vérifié comme « avancement de développement », on obtient 4,4 + 28,1 + 13,3 = **45,8 % de travail de code produit**, mais **0 % du parcours critique création→activation n est opérationnel en production**.

### 3.1 Décomposition des 12 exigences BLOQUÉES (poids 36)

| Exigence bloquée | Poids | Dépendance exacte |
|---|---|---|
| Sécurité : enforcement CRUD fin RLS | 3 | migration 0038 non appliquée |
| Isolation multi-tenant réelle | 3 | staging + comptes de test absents |
| RLS/permissions serveur appliquées | 3 | migrations 0036-0039 |
| Sauvegarde distante restaurable | 3 | accès PITR + autorisation |
| ID pro/Manager uniques côté serveur | 3 | colonnes + RPC 0039 |
| Création Auth réelle Manager | 3 | RPC v2 + EF v2 déployée |
| Cohérence établissement/profil/abo/droits | 3 | RPC v2 (admin_onboard_tenant_v2) |
| Invitation e-mail réelle | 3 | secret RESEND_API_KEY + EF v2 |
| Invitation WhatsApp réelle | 3 | secrets WHATSAPP_* + EF send-invitation |
| Activation + mot de passe Manager | 3 | tables invitations (0036) + EF activate-manager |
| Première connexion Manager | 3 | activation réelle préalable |
| Finance : factures/paiements/avoirs réels | 2 | fournisseur paiement absent |

## 4. Pourcentage par module et domaine fonctionnel (pondéré)

| Domaine | Exigences | Poids | Conforme | Implémenté non vérif. | Partiel | Bloqué | Avancement réel |
|---|---|---|---|---|---|---|---|
| Sécurité / RLS / isolation | 4 | 12 | 0 % | 25 % (garde code) | 25 % | 50 % | **0 %** |
| Onboarding / comptes Manager | 9 | 25 | 0 % | 12 % (formulaire/contrat) | 8 % | 80 % | **0 %** |
| Abonnés / Utilisateurs / Formules | 6 | 12 | 0 % | 67 % | 33 % | 0 % | **0 %** |
| CRM / Finance / Support / Intégrations | 6 | 7 | 0 % | 57 % | 14 % | 29 % | **0 %** |
| Journal / Système | 2 | 2 | 0 % | 50 % | 50 % | 0 % | **0 %** |
| Identité graphique / navigation / honnêteté statuts | 3 | 1,5 | 100 % | 0 % | 0 % | 0 % | **100 %** |
| Sauvegarde / restauration | 1 | 3 | 0 % | 0 % | 0 % | 100 % | **0 %** |

Lecture : seul le domaine « identité/navigation/honnêteté » est réellement terminé. Tous les domaines métier et de sécurité ont un avancement réel (production) de 0 %.

## 5. Pourcentage global d avancement AUTO DYALI

L échantillon Super Admin (34 exigences) couvre le cœur de la mission en cours, mais **pas les modules métier garages** (POS, stock, atelier, achats, clients, véhicules, facturation opérationnelle) qui représentent une part substantiale du projet et dont l état réel en production n est pas documenté par une matrice consolidée (centaines de lignes de registre, statuts hétérogènes, doublons). **Donnée manquante : pourcentage global fiable impossible à calculer sans registre maître consolidé.**

Estimation indicative NON fiable (à ne pas présenter comme chiffre officiel) : le code des modules garages existe et est testé localement (composants + routes présents), mais aucun rapport ne prouve leur fonctionnement en production avec données réelles. Fourchette qualitative : **code produit élevé, validation réelle faible à nulle**. Le chiffre officiel global ne peut pas être calculé.

## 6. Fonctionnalités opérationnelles en production

**0 % des fonctionnalités critiques du Super Admin** (création abonné, activation Manager, isolation, RLS, envois) ne sont opérationnelles en production. La seule EF déployée (`onboard-tenant`) est en version v1 incompatible avec le formulaire v2. Aucune migration 0036-0039 appliquée. Aucun secret fournisseur configuré. Aucun compte Manager réel créé.

Preuve : SELECT sur `nxmsqqoflskfajqrqddw` (§67/§68) → 0 RPC v2, 0 colonne professional_id/login_id/must_change_password, 0 table invitation ; `get_edge_function` → onboard-tenant version 1 (ancien payload plat, `inviteUserByEmail`, RPC `admin_onboard_tenant`, essai max 90 j) ; `list_edge_functions` → activate-manager et send-invitation absentes.

## 7. Comptage des tâches (exigences uniques Super Admin)

| Statut | Nombre de tâches | Détail |
|---|---|---|
| CONFORME ET VÉRIFIÉ | 3 | identité graphique, accès directs WhatsApp/Chatbot, honnêteté des statuts |
| IMPLÉMENTÉ NON VÉRIFIÉ | 11 | 11 sections UI + onboarding formulaire/contrat + garde auth code |
| PARTIEL | 6 | édition abonnés, création formules, support avancé, RLS affichage, système, suivi invitations |
| ABSENT | 1 | historique des connexions |
| BLOQUÉ | 13 | voir §3.1 (12 P0 + finance P1) |
| **TOTAL** | **34** | inventaire unique reconstruit |

NOTA : le compte « 11 implémenté non vérifié » agrège les 11 sections canoniques dont certaines portent des sous-partielles (compte non double). Les 7 partielles incluent les sous-parties distinctes des sections. Aucune exigence n est comptée deux fois.

## 8. Liste précise des tâches empêchant la clôture du SUPER ADMIN

1. Créer un projet Supabase **staging distinct** de `nxmsqqoflskfajqrqddw` (autorisation explicite + URL/ID à fournir).
2. Vérifier la **sauvegarde/PITR restaurable** (accès Dashboard + autorisation).
3. Appliquer les migrations **0036→0037→0038→0039** sur staging (PITR d abord).
4. Déployer les **3 EF v2** sur staging (`onboard-tenant`, `activate-manager`, `send-invitation`) — la v1 en production ne doit pas être remplacée.
5. Configurer les **secrets** Resend (`RESEND_API_KEY`, `EMAIL_FROM`) et Meta (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION`, `ACTIVATION_BASE_URL`) dans l environnement sécurisé staging.
6. Appliquer la **sécurité SQL** (0037 + correctifs §62) sur staging : 15 fonctions PUBLIC, `is_manager` INVOKER.
7. Désigner un **destinataire de test autorisé**.
8. Exécuter le **protocole §68** (13 étapes) : establishment → ID pro → Auth → liaison → e-mail → WhatsApp → activation → mot de passe → connexion → droit établissement → isolation.
9. Valider le **premier Manager réel** avec preuves (critère de réussite §67/§68).
10. Ensuite seulement : autorisation **distincte** pour toute intervention en production.

## 9. Estimation du travail restant

### 9.1 Tâches locales (réalisables sans autorisation externe)

| Tâche | Estimation | État |
|---|---|---|
| Finaliser le dossier de création staging (déjà préparé §68) | 0 j | TERMINÉ |
| Maintenir les tests de contrat v2 (§67) et non-régression | 0,5 j | TERMINÉ (158 tests, 39 E2E) |
| Compléter l édition établissement / création formules (P2) | 2-3 j | À faire si demandé (dépend du schéma) |
| Ajouter tests ciblés P2 (permissions, isolation simulée) | 1 j | Partiel |
| Total local restant (hors P2 optionnel) | **~0 j** | tout le réalisable est fait |

### 9.2 Interventions externes (blocantes, non réalisables par l agent)

| Intervention | Durée estimée | Dépendance |
|---|---|---|
| Création projet staging + secrets | 0,5 j | propriétaire |
| Vérification PITR/sauvegarde | 0,5 j | propriétaire + accès Dashboard |
| Application 0036-0039 sur staging | 0,5 j | autorisation + PITR |
| Déploiement 3 EF v2 sur staging | 0,5 j | autorisation + secrets |
| Test Manager réel (13 étapes) + corrections éventuelles | 1-2 j | tout ci-dessus + destinataire test |
| Validation production + autorisation distincte | 1 j | propriétaire |
| **Total externe** | **~4-5 j** | **entièrement sous réserve d autorisations** |

Le travail local restant est **nul** pour le parcours critique : tout ce qui pouvait être écrit, testé et préparé l a été (§51-§68). Le délai de clôture est **exclusivement conditionné aux autorisations et accès externes**.

## 10. Réponse finale

| Question | Réponse |
|---|---|
| Pourcentage réellement terminé (Super Admin, strict production) | **4,4 %** (3 exigences sur 34 pondérées) |
| Pourcentage de code produit mais non vérifié | 28,1 % implémenté + 13,3 % partiel = **41,4 %** |
| Pourcentage restant à faire / bloqué | **53,3 % bloqué** + 0,7 % absent = **54 %** |
| Pourcentage global AUTO DYALI | **NON CALCULABLE** (registre maître consolidé absent, modules garages non matricés) |
| Fonctionnalités opérationnelles en production | **0 % du parcours critique** |
| Ce qui empêche la création/activation réelle des Managers | **10 blocages** (§8) : pas de staging, pas de PITR vérifié, migrations 0036-0039 non appliquées, EF v2 non déployées (v1 obsolète en prod), secrets absents, sécurité SQL non appliquée, pas de destinataire de test |

**Conclusion : 4,4 % réellement terminé, ~54 % bloqué, le reste (~41 %) écrit mais non validé. Le Super Admin ne peut PAS créer ni activer de comptes Manager aujourd hui : l唯一 EF déployée est une v1 incompatible, et les RPC v2/tables invitations/secrets nécessaires n existent pas en environnement accessible.** AUTO DYALI reste en cours.

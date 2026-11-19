# GV5 §58 — Registre des corrections Super Admin

Date : 17 novembre 2026. Branche main @ 64359da. Aucune opération distante.

Défauts classés P0 (bloquant), P1 (majeur), P2 (mineur), P3 (cosmétique/dette).

## 1. Défauts corrigés

| # | Défaut | Page(s) | Priorité | Cause | Correction | Fichier modifié | Test validation | Statut |
|---|---|---|---|---|---|---|---|---|
| D1 | Titre dupliqué (bandeau §57 + ModuleHeader h1) | 10 pages non-dashboard | P1 | §57 a ajouté un bandeau avec h1 sans retirer le h1 du ModuleHeader | Classes `ad-mh-surtitre`/`ad-mh-titre` + CSS masquant ces éléments quand un bandeau précède ; description et actions conservées | src/components/super-admin-page.tsx, src/app/globals.css | Playwright : visibleH1 = 1 sur audit (avant 2) | CORRIGÉ |
| D2 | Texte bandeau écrasé sur tablette (h1 69px) | Journal d'activité (motif « lignes ») | P1 | Motif décoratif 6×24px (~174px) volait l'espace flex du texte à 768px | Motif masqué sous 1024px + spans lignes réduits à 14px | src/app/globals.css | Playwright : h1 69px → 259px sur tablet-768, capture FIXED | CORRIGÉ |

## 2. Défauts restant ouverts (hors périmètre local / dépendance externe)

| # | Défaut | Priorité | Cause | Traitement |
|---|---|---|---|---|
| O1 | 14 vulns HIGH picomatch (dev toolchain) | P2 | Avis GHSA-fc5q-39xc-vjpf publié après §57 ; aucun patch compatible Next 16 | Non corrigé : --force casserait eslint-config-next@14. 0 vuln en production. Attendre correctif amont. |
| O2 |Création formules/options avancées limitée | P2 | Schéma/RPC existants | BLOQUÉ (migration locale possible mais non appliquée sans autorisation) |
| O3 | Facturation/paiements/avoirs réels absents | P1 | Aucun fournisseur connecté | BLOQUÉ (dépendance externe) |
| O4 | Envois e-mail/WhatsApp/activation réels | P1 | Migrations/EF/secrets absents | BLOQUÉ (dépendance externe) |
| O5 | Enforcement CRUD fin RLS non prouvé | P1 | RLS distante non vérifiable | BLOQUÉ (dépendance externe) |
| O6 | Audit clavier approfondi non automatisé | P3 | Outils limités | Contrôle statique des aria effectué ; test manuel à prévoir |

## 3. Synthèse

Défauts trouvés : 8 (2 P1 locaux corrigés, 4 P1/P2 bloqués externes, 1 P2 dette, 1 P3). Défauts P0 : 0. Corrigés : 2. Restants : 6.


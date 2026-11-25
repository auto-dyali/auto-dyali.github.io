# GV5 §104 — Migrations sur Postgres réel, activation Manager et plan de déploiement production

Date : 24/11/2026
Branche : `gv5-104-real-postgres-and-activation` (créée depuis `ec8a6e1`)
Cible d'écriture unique : **STAGING `yocufscgninxiihwiepa`**. Aucune écriture, migration ou déploiement en production.

## 0. Git

Références vérifiées conformes : §103 `ec8a6e1`, §102 `96c89c5`, §101 `31d5d57`, §97 `d5526cc`, `main` `81ca143`. Branche dédiée créée ; aucun commit sur les branches précédentes.

---

## 1. Tableau des tests

| Étape | Statut | Niveau de preuve | Preuve |
|---|---|---|---|
| Références Git | OK | TESTÉ SCRIPT/SQL | `git rev-parse` (§0) |
| Moyen Postgres réel identifié | OK | TESTÉ SCRIPT/SQL | PGlite 0.6.0 / PostgreSQL 19.0 WASM installé hors dépôt |
| Projet temporaire Supabase | Impossible | TESTÉ SCRIPT/SQL | Plan de l'organisation refuse la création (`plan does not include this feature`) |
| 45 migrations sur base vierge (1er passage) | **OK : 45/45, 0 erreur, ~1,6 s** | TESTÉ SCRIPT/SQL | `preuves/rebuild-result.json` |
| Idempotence (2e passage) | **OK : 45/45, 0 erreur, ~0,7 s** | TESTÉ SCRIPT/SQL | idem |
| Colonne `provider_error`, policy SA, `is_saas_admin()`, 26 RPC `admin_*`, RLS | OK | TESTÉ SCRIPT/SQL | idem |
| Diff de schéma reconstruit vs staging | OK (écarts expliqués) | TESTÉ SCRIPT/SQL | `preuves/schema-diff.json`, `RECONSTRUCTION_POSTGRES.md` |
| Activation Manager par lien de bout en bout | **NON TESTÉE** | QUESTION OUVERTE | Aucun fournisseur e-mail sur staging (`secrets list` : aucun secret RESEND/SMTP) ; aucun e-mail réel envoyé |
| Compte `test.manager.complet@gmail.com` | OK (aucun envoi) | TESTÉ SCRIPT/SQL | 0 événement d'envoi pour cette invitation ; `email_status=en_attente`, `last_error=NULL` |
| Confirmation des 52 managers de test | OK | TESTÉ SCRIPT/SQL | 50 profils `manager` actifs, créés 19–21/11/2026, adresses `.local` ou nommées « Test » ; 1 adresse Gmail à confirmer |
| Compteur abonnements | OK (définition) | TESTÉ SCRIPT/SQL + ANALYSÉ PAR LE CODE | `status='active'` = payant ; 52 `trial` comptés séparément ; libellé clarifié en §103 |
| Plan de déploiement production | OK (document) | ANALYSÉ PAR LE CODE | `PLAN_DEPLOIEMENT_PROD.md` — **rien exécuté** |
| Non-régression navigateur (création → 3 RPC → révocation → renouvellement) | OK | TESTÉ NAVIGATEUR | `preuves/regression-104-results.json` : onboard OK, 200/200/200, renouvellement 200 |
| Isolation A/B (2 sessions Manager réelles) | OK | TESTÉ NAVIGATEUR | A et B : 1 établissement visible (le sien), 0 sur la cible |
| Desktop + mobile 375×812 | OK | TESTÉ NAVIGATEUR | `preuves/mobile-104-results.json` : 4 pages, `scrollWidth=375`, aucun débordement |
| `npm test` / `tsc` / `lint` / `build` | OK | TESTÉ SCRIPT/SQL | 191/191 · 0 erreur TS · 0 erreur ESLint (19 avertissements préexistants) · build OK |
| `verify-staging-migrations.sh` | OK | TESTÉ SCRIPT/SQL | 49/49 contrôles, lecture seule |
| Build production, grep sortie | OK | TESTÉ SCRIPT/SQL | **0 occurrence** de staging ; 2 occurrences de l'URL production (injection attendue) |
| Nettoyage données de test | OK | TESTÉ SCRIPT/SQL | 0 établissement, 0 invitation, 0 user résiduel |

---

## 2. Reconstruction sur Postgres réel

**45/45 migrations appliquées, 0 erreur**, rejouées une seconde fois **45/45, 0 erreur** (idempotence prouvée). Durées : ~1,6 s puis ~0,7 s. Vérifiés : `invitation_events.provider_error`, policy `saas_admin_select_profiles` (`SELECT`, `USING (is_saas_admin())`), `is_saas_admin()` SECURITY DEFINER, 26 RPC `admin_*`, RLS active sur les tables sensibles.

Détails et harness : `RECONSTRUCTION_POSTGRES.md` et `preuves/rebuild-result.json`.

### Diff de schéma (reconstruit vs staging)
52 tables / 792 colonnes / 118 policies / 57 fonctions reconstruites contre 36 / 511 / 83 / 45 sur staging. Écarts expliqués :
- staging a un historique **ad hoc horodaté**, jamais aligné sur `0001..0043` : 17 tables et de nombreuses fonctions manquantes (`support_tickets`, `vehicle_catalog`, `quotes`, `create_pos_sale`, etc.) ;
- les champs identité et la version durcie de `admin_onboard_tenant_v2` ont été appliqués sur staging par les **réconciliations §101**, hors `supabase/migrations/` : ils manquent donc sur la base reconstruite — écart connu à traiter dans le plan production ;
- `uuid_generate_v4()`/`digest()` côté reconstruit sont des shims du harness PGlite, pas des objets de migration.

### Défauts de migration corrigés (un commit chacun)
`62305ed` UNIQUE avec expressions · `82686b2`, `a3565d8`, `d0e54c5`, `b94e3a4`, `7804b03`, `ecaaed1` erreurs de la migration 0038 (policies qualifiées, espaces, colonnes, index) · `7eb420f`, `5f899fe`, `911e87b` variables PL/pgSQL non déclarées · `96496d9`, `04aca88` seeds dépendants · `debef43` nom de RPC purge · `c9842f9` baseline `admin_set_subscription` · `c7bdda9`, `ef7e1ca`, `7ec8964`, `e35be0e`, `27161d8`, `d1ad477`, `0cb2a70`, `f05364f` idempotence.

---

## 3. Activation par lien de bout en bout — impossible, question ouverte précise

`supabase secrets list --remote=yocufscgninxiihwiepa` ne contient **aucun** secret `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_*` ou WhatsApp. Le téléchargement de Mailpit/Inbucket n'a pas été entrepris car cela exigerait une décision d'architecture et l'exposition d'un port ; la mission interdit d'inventer un secret ou une décision du propriétaire.

**QUESTION OUVERTE** : le propriétaire doit choisir (a) fournir un secret Resend en mode test + domaine vérifié, ou (b) autoriser Mailpit/Inbucket local avec port contrôlé, ou (c) confirmer le report de ce test. Le parcours par jeton direct reste validé en §101 ; la préparation et le renouvellement d'invitation sont validés en navigateur (§102/§103/§104).

Aucun e-mail n'a été envoyé à une vraie personne : l'invitation `test.manager.complet@gmail.com` a 0 événement d'envoi et reste `en_attente`.

---

## 4. Plan de déploiement production

Chemin : `docs/sessions/session-1/gv5-104/PLAN_DEPLOIEMENT_PROD.md`.
Contenu : 44 étapes ordonnées avec risques (verrous, réécriture, durée), prérequis (sauvegarde/PITR, fenêtre, copie), noms de variables uniquement, smoke tests post-déploiement, retour arrière migration par migration et indication des étapes non réversibles. **Aucune commande d'écriture n'a été exécutée sur `nxmsqqoflskfajqrqddw`.**

Décisions attendues : fenêtre + sauvegarde, application fichier par fichier (jamais `db push`), import des RPC hors migrations, tarifs, fournisseur e-mail, compte Gmail de test.

---

## 5. Défauts restants

- Activation par lien réel (§3).
- Historique des migrations de production à reconcilier avant tout déploiement.
- `establishments.country/legal_info/fiscal_info/admin_info/dossier_state/complementary_contacts` et `admin_onboard_tenant_v2` durcie : présents sur staging via réconciliations §101, absents des migrations standard — à intégrer au plan production.
- Tarifs : `price_monthly`/`price_yearly` restent **NULL** pour STANDARD/SILVER/GOLD ; Trial créé sans Stripe et vérifié fonctionnel. Valeurs à fournir via `GV581_*_MENSUEL/ANNUEL` — aucune valeur inventée.
- Compte `test.manager.complet@gmail.com` : aucun envoi, à confirmer par le propriétaire.

---

## 6. Questions ouvertes

1. Fournisseur e-mail de test (Resend mode test ou Mailpit/Inbucket).
2. Montants MAD mensuels/annuels des 3 formules.
3. Fenêtre de maintenance et copie de production pour valider le plan.
4. Confirmation du compte Gmail de test.

---

## 7. Branche et HEAD

Branche `gv5-104-real-postgres-and-activation`, poussée sur `origin`.
HEAD final : à récupérer via `git rev-parse HEAD` (rapport mis à jour au dernier commit).

## 8. Verdict

- **Merge dans `main` après revue humaine : oui.** Toutes les corrections sont documentées, chaque défaut a été reproduit avant correction, 45 migrations passent sur un vrai Postgres avec idempotence, 191 tests et 49 contrôles staging sont verts, le parcours navigateur et l'isolation sont rejoués sans régression.
- **Déploiement production : non.** Il exige les décisions du propriétaire (sauvegarde, fenêtre, RPC hors migrations, tarifs, fournisseur e-mail) et une validation sur copie. Aucune écriture production n'a été effectuée.

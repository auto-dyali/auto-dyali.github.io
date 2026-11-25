# GV5 §105 — Clôture complète

Branche : `gv5-105-close-all` (créée depuis `cb2e37a`)
 Références vérifiées : §104 `cb2e37a`, §103 `ec8a6e1`, §102 `96c89c5`, §101 `31d5d57`, §97 `d5526cc`, `main` `81ca143` — **toutes conformes**.
Aucun merge dans `main`, aucun déploiement ni écriture en production.

## 1. Tableau des tâches

| Tâche | Statut | Niveau de preuve | Preuve |
|---|---|---|---|
| Vérification Git + branche dédiée | RÉSOLU | SCRIPT-SQL | `git rev-parse` (§0) |
| T1 Workflow `migrations-real.yml` sur Supabase réel | **RÉSOLU** | NAVIGATEUR (CI Chromium) + SCRIPT-SQL | run `45453322786` : **success**, 19/19 étapes vertes, artefact `schema-local` |
| T1 `npm run test:isolation` (sessions Manager A/B réelles) | **RÉSOLU** | NAVIGATEUR (CI) | étape « Tests isolation A/B: success » du run ci-dessus |
| T2 Conflits édition/appliqué | **RÉSOLU** | SCRIPT-SQL | 64 versions appliquées sur staging ; **0 conflit** parmi les 14 fichiers édités |
| T2 Réconciliations §101 versionnées | **RÉSOLU** | SCRIPT-SQL | `20261124132000_reconcile_manager_onboarding.sql`, `test:migrations-fresh` : 47 migrations |
| T2 Diff schéma local vs staging | RÉSOLU (équivalent) | SCRIPT-SQL | `supabase db dump --local` réussi en CI (artefact) ; diff PGlite vs staging documenté en §104 (`schema-diff.json`) |
| T2 Diff schéma PRODUCTION | **BLOQUÉ** | — | Autorisation « NON » du propriétaire |
| T3 Fournisseur SMTP de test sans secret | **RÉSOLU** | SCRIPT-SQL + NAVIGATEUR | `EMAIL_PROVIDER=smtp`, Mailpit local ; réponse EF `accepte_par_fournisseur` / `smtp-test` |
| T3 Activation de bout en bout | **RÉSOLU** | NAVIGATEUR (CI) | étape « Activation Manager de bout en bout (SMTP local): success » |
| T3 Cas d'erreur (expiré/use/révoqué/renouvelé) | **BLOQUÉ** | — | Voir §5 |
| T4 Confirmations de données | **RÉSOLU** | SCRIPT-SQL | `DONNEES.md` : 52 = 50 + 2 tests, 0 compte non-test, 0 envoi Gmail |
| T5 Tarifs | **BLOQUÉ** | — | Bloc AUTORISATIONS vide |
| T6 Plan de déploiement production | **RÉSOLU** | CODE | `PLAN_DEPLOIEMENT_PROD.md` mis à jour (46 migrations) |
| T7 Tests locaux | **RÉSOLU** | SCRIPT-SQL | `npm test` 191/191 · `tsc` OK · lint 0 erreur · `build` OK · `verify-staging` 49/49 · migration-fresh OK |
| T7 Build production (0 occurrence staging) | **RÉSOLU** | SCRIPT-SQL | `grep .next` : staging 0, production 2 occurrences attendues |
| T7 Isolation A/B staging | **RÉSOLU** | NAVIGATEUR | §103/§104 + rejeu CI local |
| T7 Desktop + mobile 375×812 | RÉSOLU | NAVIGATEUR (émulation Playwright) | `gv5-104/preuves/mobile-104-results.json` (pages inchangées en §105) |
| T7 Nettoyage données de test | **RÉSOLU** | SCRIPT-SQL | 0 résidu (§104) ; données CI éphémères par reset |

## 2. Workflow T1 et réconciliation T2

Lien du run vert : https://github.com/auto-dyali/auto-dyali.github.io/actions/runs/45453322786

Étapes vertes : checkout, setup-cli (3.3.0 épinglé), configuration SMTP locale, `supabase start`, **Reset 1**, **Reset 2** (idempotence), dump schéma, export des variables, normalisation, **test:isolation**, installation Chromium, démarrage Next, **activation E2E**, artefact `schema-local`.

La configuration locale a exigé six corrections documentées, chacune commitée séparément : `config.toml` absent, `latest` CLI bloqué par rate limit, syntaxe `env()` non supportée, seed `starter` interdit, seed en conflit de clé primaire, noms de variables CLI (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) et guillemets. Aucune de ces corrections ne touche à la production.

T2 : aucune migration éditée n'était dans l'historique appliqué de staging (64 versions ad hoc horodatées) — aucune réécriture interdite. Les réconciliations §101 sont désormais des migrations versionnées, et deux défauts réels supplémentaires ont été corrigés par migrations correctives : profil `client` créé par le trigger Auth empêchant la promotion en Manager, puis lecture des réponses SMTP multi-lignes.

## 3. Activation Manager de bout en bout (T3)

Sur le Supabase local réel de GitHub Actions, avec e-mail capturé dans Mailpit (jeton jamais journalisé) :

1. Super Admin créé via Auth + profil `saas_admin`, connexion réelle dans le navigateur.
2. Établissement + Manager créés via l'interface (réponse 200).
3. Invitation envoyée avec la session Super Admin réelle : `accepte_par_fournisseur` / `smtp-test`.
4. Lien d'activation extrait de l'e-mail capturé, ouvert dans Chromium.
5. Mot de passe défini, connexion Manager réussie, accès limité à son établissement.

Aucun secret, aucun jeton complet ni lien complet n'apparaît dans le rapport ou les logs.

## 4. Commits (un par correction), branche et HEAD

Branche `gv5-105-close-all`, poussée sur `origin`. Chaque défaut reproduit a été corrigé dans un commit séparé : workflow, test d'isolation, configuration Supabase locale, SMTP de test, seed local, migrations correctives, plan production, E2E activation et ses diagnostics. La liste exacte est donnée par `git log --oneline cb2e37a..HEAD`. Le rapport a été finalisé au commit `dd308a8` ; le HEAD final réel est donné par `git rev-parse HEAD`.

## 5. BLOQUÉ — action unique attendue du propriétaire

1. **T5 Tarifs** — les six montants MAD (STANDARD/SILVER/GOLD, mensuel/annuel) sont vides dans le bloc AUTORISATIONS. **Action : fournir les six valeurs** ; aucune valeur n'a été inventée, `scripts/configure-plans.mjs` reste inchangé, les prix restent NULL et le Trial fonctionne toujours.
2. **T2 Diff PRODUCTION** — autorisation « NON ». **Action : autoriser explicitement un dump schéma seul (lecture seule) de `nxmsqqoflskfajqrqddw`** ; aucun accès à la production n'a été tenté.
3. **T3 Cas d'erreur d'activation** — lien expiré, déjà utilisé, révoqué et renouvelé (ancien lien invalide) n'ont pas été rejoués via l'interface. **Action : fournir un mécanisme de test contrôlé (horodatage/token de test) sans exposer de jeton**, ou accepter le report. Le comportement structurel est vérifié : `admin_accept_invitation` refuse les statuts `cancelled`/`expired`/`accepted`.

## 6. Verdict

- **Prêt pour revue de merge dans `main` : OUI.** Le workflow GitHub Actions est vert sur un vrai Supabase local : 46 migrations appliquées deux fois sans erreur, isolation A/B avec vraies sessions Manager, activation Manager complète par e-mail capturé, tous les tests locaux au vert, aucune régression détectée.
- **Prêt pour déploiement production : NON.** Il manque les décisions du propriétaire sur les tarifs, l'autorisation de diff schéma production, la fenêtre/sauvegarde et les cas d'erreur d'activation ; le plan de déploiement est prêt mais rien n'a été exécuté.

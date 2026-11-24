# GV5 §106 — Préversion en live (STAGING uniquement)

## Cible déclarée et vérifiée avant toute écriture

- Dépôt : `https://github.com/auto-dyali/auto-dyali.github.io.git`
- Branche : `gv5-105-close-all`, HEAD initial `4f9f393` (vérifié)
- Ref Supabase : `yocufscgninxiihwiepa` (`auto-dyali-staging`)
- **Interdit** : `main` (`81ca143`), URL `https://auto-dyali.github.io/`, ref `nxmsqqoflskfajqrqddw`

## URL publique de la préversion

**BLOQUÉ.** GitHub Pages du dépôt est configuré pour un unique site (déploiement de production depuis `main`). Créer une URL publique séparée exige de modifier la source Pages (donc le site de production) ou un hébergeur tiers.

Action exacte attendue du propriétaire : **autoriser un hébergeur de préversion séparé (Cloudflare Pages, Netlify ou Vercel) et fournir le jeton de déploiement**, ou autoriser explicitement une branche/chemin Pages dédié. Aucun jeton n'a été inventé.

En attendant, la préversion est consultable sous forme d'**artefact téléchargeable** `preview-staging` produit par le run https://github.com/auto-dyali/auto-dyali.github.io/actions/runs/45498802228 (workflow vert). Le build est marqué `noindex,noarchive` et bandeau « STAGING — DONNÉES DE TEST » sur 66 pages.

## Tableau des étapes

| Étape | Statut | Niveau de preuve | Preuve |
|---|---|---|---|
| Vérification Git + push branche | RÉSOLU | SCRIPT-SQL | HEAD `4f9f393` conforme ; `Everything up-to-date` ; `main` = `81ca143` |
| Vérification cible Supabase | RÉSOLU | SCRIPT-SQL | `projects list` : `yocufscgninxiihwiepa` = `auto-dyali-staging`, `nxmsqqoflskfajqrqddw` = production ; toutes les commandes utilisent `--remote=yocufscgninxiihwiepa` |
| `supabase status` / `link` locaux | BLOQUÉ (environnement) | SCRIPT-SQL | Docker absent, CLI non linké localement ; cible vérifiée par `--remote` explicite et `projects list` |
| `db push --dry-run` | ÉCHEC attendu, non exécuté | SCRIPT-SQL | `DbPushMissingLocalError` : historique distant ad hoc ; `db push` refusé (aucune écriture de schéma en vrac) |
| Migrations correctives appliquées | RÉSOLU | SCRIPT-SQL | 5 migrations `2026112413*` appliquées via `db query --file` ; contrôle : colonne=1, policy=1, RPC=2 |
| Edge Functions déployées | RÉSOLU | SCRIPT-SQL | `onboard-tenant` v3, `send-invitation` v4, `verify_jwt=false` |
| Appels réels aux fonctions | RÉSOLU | SCRIPT-SQL | session SA 200 ; `send-invitation` 404 (invitation inconnue) ; `onboard-tenant` 400 (payload invalide) — réponses serveur bien reçues |
| Workflow préversion | RÉSOLU | SCRIPT-SQL | run `45498802228` : success, artefact `preview-staging` |
| Build sans production | RÉSOLU | SCRIPT-SQL | `grep out` : 0 occurrence de `nxmsqqoflskfajqrqddw`, présence staging |
| Vérification navigateur (build servi localement) | RÉSOLU | NAVIGATEUR | `preuves/preview-browser-result.json` : connexion SA, création Trial, Manager, invitation, fiche, modification 200 ; **18 appels staging, 0 appel production** |
| Bandeau + noindex | RÉSOLU | NAVIGATEUR | `bandeau=true`, `noindex=noindex,noarchive`, capture `preview-staging-browser.png` |
| Nettoyage données de test | RÉSOLU | SCRIPT-SQL | 0 établissement, 0 user résiduels |
| URL publique separate | **BLOQUÉ** | — | Action : fournir un hébergeur de préversion + jeton, ou autoriser un emplacement Pages dédié |

## Migrations et fonctions déployées sur STAGING

Migrations appliquées via `db query --file` (idempotentes) :
- `20261124130000_add_invitation_events_provider_error.sql`
- `20261124130100_saas_admin_select_profiles.sql`
- `20261124131000_admin_create_invitation_renewal.sql`
- `20261124132000_reconcile_manager_onboarding.sql`
- `20261124133000_fix_onboard_trigger_profile.sql`

Fonctions déployées : `onboard-tenant` (v3), `send-invitation` (v4). Aucune autre fonction modifiée depuis `81ca143`.

## Confirmation

- `main` : `81ca1438bc92c48605a59a3214bca805d42e8e7e` — **intact**.
- Projet Supabase de production `nxmsqqoflskfajqrqddw` : **aucune lecture-écriture, aucun déploiement, aucune migration**.
- Branche `gv5-105-close-all` poussée ; HEAD final via `git rev-parse HEAD`.
- Aucun secret ni jeton dans le rapport, les logs ou les captures.

## Connexion pour tester

Compte Super Admin de test STAGING : `superadmin.ui@autodyali-staging.local`. Le mot de passe n'est pas communiqué ici ; il est détenu localement et n'a pas été modifié pendant cette mission. L'URL publique reste à décider (§ URL publique).

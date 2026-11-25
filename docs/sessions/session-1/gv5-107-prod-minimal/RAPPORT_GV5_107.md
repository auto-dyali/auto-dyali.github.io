# GV5 §107-PROD-MINIMAL — Débloquer la création en production

Branche : `gv5-107-prod-minimal`, créée depuis `bfc47c2`. `main` = `81ca143`. **Aucune écriture en production** ; aucun `db push`, aucun reset, aucune donnée des 2 garages modifiée.

## 1. Tableau des étapes

| Étape | Statut | Niveau de preuve | Preuve |
|---|---|---|---|
| Analyse lecture seule (0039, diagnostic, dépendances, diff prod) | RÉSOLU | CODE + SCRIPT-SQL | `RAPPORT_ANALYSE.md` |
| Sauvegarde production vérifiée | RÉSOLU | SCRIPT-SQL | `/tmp/adq/gv5107_backup/backup_schema.json`, `backup_data.jsonl` + sha256 ci-dessous |
| Baseline « forme production » | RÉSOLU (partiel) | SCRIPT-SQL | CI job `rejeu forme production` : 8 tables + 16 fonctions utiles ; `pg_dump` CLI indisponible localement (Docker absent), baseline généré depuis le catalogue en lecture seule |
| Migrations correctives appliquées 2× sur baseline | RÉSOLU | SCRIPT-SQL | job CI vert, `Contrôle diagnostic et objets: success` |
| Idempotence sur STAGING | RÉSOLU | SCRIPT-SQL | 6 fichiers appliqués deux fois, sans erreur |
| Diagnostic en lecture seule + anon refusé | RÉSOLU | SCRIPT-SQL | SA 200 (9 clés true), anon 401 `permission denied` |
| Parcours navigateur création sur STAGING | RÉSOLU | NAVIGATEUR | `preuves/parcours-staging-result.json`, captures : connexion, préflight sans message « non prêt », création 200, fiche, modification 200, 18 appels staging, 0 production |
| Isolation A/B + RPC admin refusé | RÉSOLU | SCRIPT-SQL (sessions Auth réelles) | A et B : 1 établissement visible chacun, RPC admin 404/400, anonyme 0 profil |
| CI `migrations-real` (2 jobs) | RÉSOLU | SCRIPT-SQL | run `45527596824` : `real-supabase success`, `rejeu forme production success` |
| Application en production | BLOQUÉ | — | GO-3 requis |
| Session Super Admin production | BLOQUÉ | — | Le propriétaire ouvre la session ; aucun reset |
| Envoi réel d'invitation | BLOQUÉ | — | Aucun fournisseur e-mail déclaré |

## 2. Sauvegarde vérifiée

- Schéma (catalogue complet) : `/tmp/adq/gv5107_backup/backup_schema.json` — 113 Ko — sha256 `29ebff7d1b1376fdc0b470f510e8db6686a4aca283ff9b6ce69a11d21046ea59`
- Données des tables concernées : `/tmp/adq/gv5107_backup/backup_data.jsonl` — 10 Ko — sha256 `9f6d5a4beb1f1bcc727aa949b658c5451200f6421c481c2902092f63c6bae74f`
- Lignes exportées : profiles 1, plans 3, plan_features 93, subscriptions 2, establishments 2, audit_log 4, permissions 0, onboarding_requests 0.
- Limitations : `supabase db dump` exige Docker (absent ici) ; la sauvegarde est un export logique SQL/JSON en lecture seule, pas un `pg_dump` binaire. Les fichiers restent hors dépôt.

## 3. Migrations correctives (ordre exact, production après GO-3)

1. `20261125100000_prod_minimal_invitations.sql` — `invitations`, `invitation_events`, RPC d'invitation. Verrou : faible (CREATE TABLE).
2. `20261125101000_prod_minimal_identity_v2.sql` — colonnes identité + RPC onboarding v2 de base. Verrou : `ALTER TABLE profiles/establishments`.
3. `20261125102000_prod_minimal_identity_health.sql` — RPC de diagnostic (lecture seule, Super Admin).
4. `20261125102500_prod_minimal_admin_columns.sql` — 6 colonnes administratives avant pré-contrôle (défaut reproduit en CI).
5. `20261125103000_prod_minimal_admin_fields.sql` — champs admin + versions durcies.
6. `20261125104000_prod_minimal_onboard_trigger_fix.sql` — correctif du profil créé par le trigger Auth.

État des versions en production : **aucune** (`supabase_migrations` absent). Stratégie baseline à valider avant GO-3 : créer l'historique et enregistrer une version `baseline` représentant l'état actuel, puis les 6 versions ci-dessus — **rien écrit sans accord**.

Réversibilité : `CREATE OR REPLACE`/`ADD COLUMN IF NOT EXISTS`/`DROP POLICY IF EXISTS` réversibles ; la création de tables l'est par `DROP TABLE` (destructif, non recommandé). Étapes non réversibles : aucune donnée supprimée ; l'enregistrement d'un baseline est une écriture d'historique à décider explicitement.

Fonctions à déployer après GO-3 uniquement : `onboard-tenant` v3, `send-invitation`, `activate-manager`.

## 4. Checklist pour le propriétaire (étape 4, après GO-3)

1. Ouvrir soi-même la session Super Admin (aucun reset, aucun second SA).
2. Ouvrir `https://auto-dyali.github.io/super-admin/onboarding/`.
3. Confirmer la disparition du message « Environnement non prêt / RPC absente ».
4. Créer un établissement `ZZ-TEST-GV5107 …` avec abonnement Trial et Manager `…+test@…`.
5. Vérifier la fiche, les permissions, la préparation de l'invitation (envoi réel BLOQUÉ sans fournisseur).
6. Nettoyer uniquement les enregistrements préfixés `ZZ-TEST-GV5107` et fournir la liste exacte des suppressions.
7. Captures et réponses réseau sans token ni mot de passe.

## 5. Verdict

La création d'établissement est **non opérationnelle en production à ce stade** : le diagnostic est corrigé et répété avec succès sur STAGING et sur une base « forme production » en CI, mais **aucune écriture de production n'a été faite**. Elle deviendra opérationnelle après GO-3, application des 6 migrations, déploiement des 3 Edge Functions et vérification par le propriétaire.

**ARRÊT : j'attends GO-2, puis la liste d'application et GO-3.**

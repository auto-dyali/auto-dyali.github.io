# GV5 §107 — Préparation de la Production (Supabase Free)

## 1. Fichiers intégrés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261125108000_prod_minimal_pgcrypto_helpers.sql` | 8ᵉ migration corrective : helpers `gen_invitation_token()` / `hash_invitation_token()` avec `SET search_path = public, extensions` et appels qualifiés `extensions.*` |
| `supabase/migrations/20261125109000_prod_minimal_permissions_tenant_write.sql` | 9ᵉ migration corrective : restaure l'écriture `permissions` par un rôle tenant (ancien front de `main`), sans modifier `101000` |
| `supabase/rollbacks/gv5107/20261125108000.sql` | Retour arrière du correctif (DROP des 2 fonctions) |
| `scripts/gv5_prod_trial.sql` | Essai historique à 8 migrations (sans `109000`) : conservé pour trace, **supersédé** par `gv5_prod_trial_final.sql` |
| `scripts/gv5_prod_trial_final.sql` | Répétition générale des **9 migrations**, instructions identiques au script d'application, terminée par **`ROLLBACK`** |
| `scripts/gv5_prod_trial_editeur.sql` | Copie prête au copier-coller dans le SQL Editor (9 migrations, `ROLLBACK`, aucun UUID saisi) |
| `scripts/gv5_prod_apply.sql` | Même corps que la répétition générale mais **`COMMIT`** — à n'exécuter qu'après GO explicite |
| `scripts/gv5_staging_onboarding_test.sql` | Test d'intégration transactionnel du parcours complet sur staging (aucune écriture persistante) |
| `scripts/test-gv5-107-production-readiness.mjs` | Contrôle statique : ordre, dépendances, correctif, garde-fous des scripts, 9 rollbacks, absence d'opérations destructives, égalité répétition/application |
| `docs/RM-GV5_REGISTRE_MAITRE.md` | Registre maître GV5 |
| `.github/workflows/rehearsal.yml` | **Retiré** : répétition abandonnée, aucun déclenchement parasite sur `push` |

Aucune migration historique n'a été modifiée. Aucun secret n'est présent dans ces fichiers.

Empreintes SHA-256 des scripts livrés (preuve d'intégrité, à recalculer avant exécution) :

| Script | Lignes | SHA-256 |
|---|---|---|
| `scripts/gv5_prod_trial_editeur.sql` | 1976 | `688ff04365a7a47eff913a27d9be7394899d07e5b5155c2e342ba16352d6a127` |
| `scripts/gv5_prod_trial_final.sql` | 1976 | `9441efe09d3f7ccadda9415988fedf41f29f4eb3cca23b17897dcf908210c3a1` |
| `scripts/gv5_prod_apply.sql` | 1976 | `b7cc4ec76efad12e668ff3efd472fbee8219c8efba8ea3dba3d59430d9034800` |
| `scripts/gv5_staging_onboarding_test.sql` | 368 | `369f15bc8ebab53a0839120a21d7934a677d449d84eff71300f823006431b039` |

## 2. Cause du blocage et solution

`pgcrypto` est installé dans le schéma `extensions` (session `search_path = "$user", public`). Les helpers créés par `100000` sans `search_path` propre résolvent `gen_random_bytes()` / `digest()` à l'exécution avec le `search_path` de l'appelant → `function gen_random_bytes(integer) does not exist`. La corrective qualifie les appels et fixe le `search_path` au niveau fonction ; elle est exécutée dans la même transaction que les 7 premières migrations, avec `SET LOCAL search_path = public, extensions`.

Reproduction et validation faites sur base de test isolée : erreur reproduite, 8/8 migrations appliquées, helpers hex 64, diagnostic **9/9 true**, RLS 5 policies sur 2 tables, RPC `admin_onboard_tenant_v2` → `status: completed` avec établissement + abonnement + invitation + permission créés, comptages avant/après identiques, 7/7 rollbacks OK.

## 3. Compatibilité Supabase Free

Standard PostgreSQL + `pgcrypto` déjà présent ; aucune fonctionnalité Pro, aucun PITR ; sauvegarde logique chiffrée vérifiée et restaurée sur base vierge ; transactions et `SET LOCAL` disponibles dans le SQL Editor.

## 4. Sauvegarde et retour arrière

Sauvegarde fraîche à utiliser : `~/.local/share/auto-dyali/gv5-supabase-prod-backup-20261125-191107/` (sha256 dans le registre). Retour arrière : correctives puis les scripts en ordre inverse (`supabase/rollbacks/gv5107/`). Destructif à partir de `100000`/`101000`/`102500` dès qu'une donnée réelle a été créée dans les nouvelles tables/colonnes.

## 5. Corrections ajoutées après la préparation initiale

- **SCRIPT-SQL / CODE** — `supabase/config.toml` : ajout de `[functions.onboard-tenant]` et `[functions.activate-manager]` avec `verify_jwt = false`, comme pour `send-invitation`. Les deux EF vérifient elles-mêmes le JWT du Super Admin ou le jeton d'activation ; la vérification générique de la passerelle empêcherait le message d'erreur métier.
- **CODE** — `supabase/functions/onboard-tenant/index.ts` : reprise d'un compte Auth orphelin uniquement si `user_metadata.onboarding_request_id` ET l'e-mail correspondent à la requête en cours ; mise à jour du mot de passe et des métadonnées ; compensation (`deleteUser`) seulement si la demande n'est pas déjà `completed`. Un compte appartenant à une autre identité reste refusé (409).
- **SCRIPT-SQL / STAGING** — `scripts/gv5_staging_onboarding_test.sql` : transaction annulée couvrant établissement, abonnement (gold, 14 jours d'essai, 12 mois), profil Manager, permissions, invitation, audit, demande clôturée, idempotence, refus de doublon, acceptation usage unique, levée de la rotation, isolation et refus d'écriture inter-garage en rôle `authenticated`. Résultat : `ROLLBACK_VOLONTAIRE` avec 0 résidu sur toutes les tables contrôlées.
- **SCRIPT-SQL / STAGING** — Répétition générale des 9 migrations : `ROLLBACK_VOLONTAIRE`. Seule adaptation locale : tolérance d'au moins 1 SA et choix du premier SA (`order by created_at`) car staging en contient 2 ; production en contient exactement 1 (précontrôle A).
- **CODE / SCRIPT-SQL** — Le contrôle de la policy d'écriture tenant s'exécute désormais avec `set local role authenticated` : le rôle `postgres` est superutilisateur et contourne RLS, ce qui rendait le contrôle faux.

## 6. Étape suivante (après GO)

1. Re-sauvegarder juste avant application et vérifier le sha256 ; conserver la phrase de passe hors du dépôt et du chat.
2. Essai : exécuter `scripts/gv5_prod_trial_editeur.sql` **en une seule requête** dans le SQL Editor. Aucun UUID à remplacer. Vérifier `ROLLBACK_VOLONTAIRE`, puis uniquement si succès :
3. Application : exécuter `scripts/gv5_prod_apply.sql` de la même manière ; vérifier `APPLIQUE`.
4. Déployer les EF : `onboard-tenant` (v3 + reprise), `send-invitation` (v4), `activate-manager` (v1) ; vérifier les versions déployées.
5. Test fonctionnel contrôlé du parcours complet, puis arrêt immédiat avant toute additional writing.

Commandes du paquet (à n'exécuter qu'après GO explicite, jamais avant) :

```bash
# 1. Configuration locale validée : supabase config validate (déjà exécuté, valide)
# 2. Sauvegarde fraîche + vérification du SHA256 avant toute écriture
# 3. Application SQL : coller scripts/gv5_prod_apply.sql dans le SQL Editor,
#    UNE SEULE requête. Attendre 'APPLIQUE' ; en cas d'erreur, ROLLBACK automatique.
# 4. Edge Functions (déploiement production, après le SQL) :
export PATH=$HOME/.local/node_modules/@supabase/cli-darwin-x64/bin:$PATH
supabase functions deploy onboard-tenant send-invitation activate-manager --remote=nxmsqqoflskfajqrqddw --use-api
# 5. Vérification en lecture seule : versions des EF, 9/9 santé, policies, RPC,
#    puis UN seul parcours fonctionnel contrôlé et arrêt immédiat.
# 6. Retour arrière : scripts de supabase/rollbacks/gv5107/ en ordre inverse,
#    UNIQUEMENT avant le premier abonné réel / lien émis / invitation acceptée.
```

Aucune commande de ce runbook n'a été exécutée sur la production.

## 8. Correctif de déploiement (après GO)

- **SCRIPT-SQL / PRODUCTION** — Première tentative d'application refusée par le garde-fou `ETABS_INSUFFISANTS`, **avant COMMIT** : la production ne contient qu'un seul profil (Super Admin) et le contrôle RLS supposait deux profils tenant avec rotation levée. Vérification en lecture seule : aucune table `invitations`, 2 établissements, 1 profil, 0 demande — production inchangée.
- **CODE / SCRIPT-SQL** — Correctif limité au bloc de vérification RLS (aucune des 9 migrations modifiée) : le contrôle crée un profil tenant **temporaire** dans la transaction, vérifie l'écriture dans son garage et le refus inter-garage en rôle `authenticated`, puis annule le tout par `rollback to gv5_policy_test`. Empreintes recalculées ci-dessus. Un second refus avant COMMIT (`profiles_id_fkey`) a conduit à créer également un compte Auth temporaire, lui aussi annulé par le savepoint.

**Production intacte à ce stade : aucune migration, aucune EF, aucune donnée modifiée.**

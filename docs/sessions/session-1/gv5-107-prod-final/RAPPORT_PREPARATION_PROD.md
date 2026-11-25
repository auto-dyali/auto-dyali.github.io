# GV5 §107 — Préparation de la Production (Supabase Free)

## 1. Fichiers intégrés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261125108000_prod_minimal_pgcrypto_helpers.sql` | 8ᵉ migration corrective : helpers `gen_invitation_token()` / `hash_invitation_token()` avec `SET search_path = public, extensions` et appels qualifiés `extensions.*` |
| `supabase/migrations/20261125109000_prod_minimal_permissions_tenant_write.sql` | 9ᵉ migration corrective : restaure l'écriture `permissions` par un rôle tenant (ancien front de `main`), sans modifier `101000` |
| `supabase/rollbacks/gv5107/20261125108000.sql` | Retour arrière du correctif (DROP des 2 fonctions) |
| `scripts/gv5_prod_trial.sql` | Essai transactionnel : `BEGIN`, `lock_timeout=2s`, `search_path=public, extensions`, 8 migrations, contrôle santé 9/9, **`ROLLBACK`** — aucun `COMMIT` |
| `scripts/gv5_prod_apply.sql` | Même script mais **`COMMIT`** — à n'exécuter qu'après GO explicite |
| `scripts/test-gv5-107-production-readiness.mjs` | Contrôle statique : ordre, dépendances, correctif, garde-fous des scripts, 8 rollbacks, absence d'opérations destructives |
| `docs/RM-GV5_REGISTRE_MAITRE.md` | Registre maître GV5 |
| `.github/workflows/rehearsal.yml` | **Retiré** : répétition abandonnée, aucun déclenchement parasite sur `push` |

Aucune migration historique n'a été modifiée. Aucun secret n'est présent dans ces fichiers.

## 2. Cause du blocage et solution

`pgcrypto` est installé dans le schéma `extensions` (session `search_path = "$user", public`). Les helpers créés par `100000` sans `search_path` propre résolvent `gen_random_bytes()` / `digest()` à l'exécution avec le `search_path` de l'appelant → `function gen_random_bytes(integer) does not exist`. La corrective qualifie les appels et fixe le `search_path` au niveau fonction ; elle est exécutée dans la même transaction que les 7 premières migrations, avec `SET LOCAL search_path = public, extensions`.

Reproduction et validation faites sur base de test isolée : erreur reproduite, 8/8 migrations appliquées, helpers hex 64, diagnostic **9/9 true**, RLS 5 policies sur 2 tables, RPC `admin_onboard_tenant_v2` → `status: completed` avec établissement + abonnement + invitation + permission créés, comptages avant/après identiques, 7/7 rollbacks OK.

## 3. Compatibilité Supabase Free

Standard PostgreSQL + `pgcrypto` déjà présent ; aucune fonctionnalité Pro, aucun PITR ; sauvegarde logique chiffrée vérifiée et restaurée sur base vierge ; transactions et `SET LOCAL` disponibles dans le SQL Editor.

## 4. Sauvegarde et retour arrière

Sauvegarde fraîche du 25/11 : `~/.local/share/auto-dyali/gv5-supabase-prod-backup-20261125-135853/` (sha256 dans le registre). Retour arrière : corrective puis les 7 scripts en ordre inverse. Destructif à partir de `100000`/`101000`/`102500` dès qu'une donnée réelle a été créée dans les nouvelles tables/colonnes.

## 5. Étape suivante (après GO)

1. Re-sauvegarder juste avant application et vérifier le sha256.
2. Essai : exécuter `scripts/gv5_prod_trial.sql` **en une seule requête** dans le SQL Editor, après remplacement de `<SA_UUID>` par l'id issu de `select id from public.profiles where role='saas_admin'`. Vérifier 9 `true`, puis `ROLLBACK`.
3. Application : exécuter `scripts/gv5_prod_apply.sql` de la même manière.
4. Déployer les EF : `onboard-tenant` v3, `send-invitation` v4, `activate-manager` v1.

**Production intacte à ce stade : aucune migration, aucune EF, aucune donnée modifiée.**

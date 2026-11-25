# GV5 §107-PROD-FINAL — Dossier avant GO-2

Branche `gv5-107-prod-final`. Aucune écriture en production, aucun merge, aucun artefact public. État Git vérifié : `main` = `81ca143`, HEAD = voir `git rev-parse HEAD` (ce dossier a été ajouté après le workflow et les scripts de retour arrière).

## 1. Copie réelle du schéma production en CI — BLOQUÉ

Workflow créé : `.github/workflows/prod-schema-replay.yml`, **`on: workflow_dispatch` uniquement**, jamais `pull_request`. Il :
- dump le schéma `public` seul (`supabase db dump --remote=nxmsqqoflskfajqrqddw --schema public -f /tmp/prod_schema.sql`) ;
- restaure dans le même job dans un Supabase local démarré sans migrations du dépôt ;
- applique les 7 migrations **deux fois** ;
- contrôle le diagnostic puis rejoue le parcours navigateur complet (précontrôle, onboarding, Manager, permissions, lien d'activation, connexion Manager, isolation, refus `admin_*`, ancien parcours).

Aucun artefact du dump, aucun log de son contenu, aucun secret affiché.

**Blocage** : les workflows `workflow_dispatch` ne sont exposés par l'API GitHub que s'ils existent sur la branche par défaut `main`. Ce workflow n'est pas encore sur `main` (GO-3 non accordé) : tout dispatch renvoie 404. En outre, la CI a besoin de deux secrets :
- `SUPABASE_ACCESS_TOKEN` (authentification CLI) ;
- `PROD_DB_PASSWORD` (dump `pg_dump`).

**Action attendue** : autoriser GO-3 pour porter le workflow sur `main`, puis déclarer les deux secrets (noms ci-dessus) dans le dépôt. Je ne les lis jamais en clair. Le test sur copie réelle reste donc **NON TESTÉ** ; en attendant, la répétition a été faite sur le baseline « forme production » et sur le vrai Supabase local (jobs `migrations-real`).

## 2. Objets existants de production modifiés par les 7 migrations

Analyse par lecture seule du catalogue de production (`backup_schema_full.sql`, hors dépôt) et grep des 7 fichiers.

| Objet production | Ancienne définition (extrait) | Nouvelle définition | Impact ancien front / `onboard-tenant` v1 |
|---|---|---|---|
| `public.my_features()` | `select pf.feature_key, pf.enabled from establishments e join plan_features pf on pf.plan_code=e.plan where e.id=current_establishment_id()` | version 0039 : intersection forfait ∩ `permissions` | Changement voulu : droits réels. L'ancien front ne lisait pas directement cette RPC pendant la création ; aucun blocage. |
| `permissions.tenant_isolation` (policy `*`), `appointments`, `clients`, … 26 policies `tenant_isolation` | `(establishment_id = current_establishment_id())` | 101000 ne remplace que `permissions.tenant_isolation` et ajoute `permissions_saas_admin_write` ; les autres restent | Aucune régression attendue pour la lecture tenant. |
| Policies `password_rotation_required` sur tables publiques | `(NOT must_change_password())` | 101000 les recrée avec la même sémantique | Colone `must_change_password` ajoutée ; l'ancien front continue. |
| `plans`, `plan_features`, `profiles`, `establishments`, `subscriptions`, `permissions`, `audit_log`, `onboarding_requests` | colonnes telles quelles | `ADD COLUMN IF NOT EXISTS` uniquement | Additif : aucune colonne supprimée ni retypée. |
| `admin_find_user_id_by_email`, `admin_find_onboarding_request` | inchangées | non remplacées | `onboard-tenant` v1 continue de fonctionner. |

Grep destructif : seules apparaissent des instructions `DROP POLICY IF EXISTS` suivies de `CREATE POLICY`, et des `DELETE FROM public.permissions` **à l'intérieur du corps de `admin_onboard_tenant_v2`** (idempotence de la création, exécuté seulement lors d'un onboarding). Aucun `DROP TABLE`, `RENAME`, `ALTER … TYPE`, `TRUNCATE` ou `DELETE` au niveau migration. Aucun objet applicatif supprimé.

## 3. Tableau des 7 migrations

| Migration | Objets créés/modifiés | Parcours qui en a besoin | Hors périmètre ? |
|---|---|---|---|
| `20261125100000` | `invitations`, `invitation_events`, 7 RPC invitation, 4 policies | invitation, journal, renouvellement | Non |
| `20261125101000` | colonnes identité, 9 RPC identité/features, policies permissions | précontrôle, onboarding, connexion | Non |
| `20261125102000` | `admin_identity_v2_health()` | message « environnement prêt » | Non |
| `20261125102500` | 6 colonnes administratives | pré-contrôle de `103000`, formulaire | Non |
| `20261125103000` | champs admin + versions durcies + health + hash token | création complète | Non |
| `20261125104000` | `admin_onboard_tenant_v2` corrigée (profil trigger) | création Manager | Non |
| `20261125106000` | `admin_issue_activation_link()` | lien sans e-mail | Non |

Preuve : chaque objet est appelé par le front, l'EF `onboard-tenant`, la RPC v2 ou le précontrôle (vérifié par grep et par le parcours staging).

## 4. Sauvegarde vérifiée — RÉSOLU (partiel)

Emplacement durable hors `/tmp` et hors dépôt : `~/.local/share/auto-dyali/gv5-107-prod-final/`
- `backup_schema_full.sql` — sha256 `52885122a89da0524b5a04cc0ff947e6b193af0dbb305bf067c95d01d48df1f46bec`
- `backup_data.jsonl.enc` (chiffré AES-256, phrase dans fichier 600 séparé) — sha256 `d4d95ecb633c9914a1e16342ef2ea5c1a40115a88706837280df21bb013ace45`
- `SHA256SUMS` — sha256 des deux fichiers.

Test de restauration sur base de test vierge (PGlite) : 105 lignes restaurées ; comptages `establishments=2`, `profiles=1`, `subscriptions=2`, `plans=3`, `plan_features=93`, `audit_log=4` — identiques aux comptages生产 avant sauvegarde. Aucune donnée de production dans le dépôt ni dans un artefact.

Plan Supabase de production et sauvegardes automatiques réelles : **NON VÉRIFIÉ** (l'API CLI disponible n'expose pas le plan ni l'état PITR). Action attendue : indiquer le plan et confirmer les sauvegardes automatiques Supabase, ou fournir un accès lecture à la page Billing.

## 5. Retour arrière — RÉSOLU

7 scripts dans `supabase/rollbacks/gv5107/`, un par migration, en ordre inverse. Testés sur une copie du schéma production dans PGlite : **7 apply OK, 7 rollback OK**, sans erreur. Le rollback de `100000` est **destructif** (suppression des tables d'invitation) ; les autres sont additifs/inversibles.

## 6. Edge Functions

| Fonction | Version en production | Version à déployer | Ordre | Secrets requis |
|---|---|---|---|---|
| `onboard-tenant` | v1 (`verify_jwt=true`) | v3 (`verify_jwt=false`, garde interne SA) | 1 | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (déjà présents) |
| `send-invitation` | absente | v4 | 2 | idem + `RESEND_API_KEY`, `EMAIL_FROM` (manquants) |
| `activate-manager` | absente | v1 | 3 | idem, aucun secret e-mail nécessaire |

Sans fournisseur e-mail, `activate-manager` **vérifie le jeton**, crée le mot de passe via Auth Admin, consomme l'invitation et vérifie la connexion : il fonctionne avec un lien copié. Il n'envoie rien. `send-invitation` renvoie `non_configure` sans secret.

## 7. Front

Fichiers `src/` modifiés depuis `main` (11) : `activer/page.tsx` (jeton en fragment), `layout.tsx` (`Referrer-Policy no-referrer`), `abonne-workspace.tsx` (bouton copier), `connexion/page.tsx`, `super-admin-guard.tsx`, `integrations/page.tsx`, `onboarding/page.tsx`, `super-admin/page.tsx`, `super-admin-invitations-list.tsx`, `supabase-browser.ts`, `supabase-errors.ts`.

Plan : (a) appliquer les migrations en production ; (b) déployer les EF ; (c) vérifier que la création fonctionne **avec le front actuel de `main`** (le précontrôle passe et le parcours va au bout) ; (d) ouvrir une PR du front après GO-3 pour le bouton de lien et la sécurité du fragment. Le front de `main` reste fonctionnel pendant l'étape (c).

## 8. Sécurité du lien d'activation

- Jeton : 32 octets aléatoires via `gen_random_bytes(32)` = 256 bits ✅.
- Stockage : empreinte SHA-256 seulement ✅ (`hash_invitation_token`).
- Usage unique : `admin_accept_invitation` refuse une invitation déjà `accepted` ✅.
- Expiration : 7 jours par défaut, vérifiée côté serveur ✅ (à raccourcir si vous le souhaitez).
- Limitation d'essais : **BLOQUÉ** — aucun compteur de tentatives dans `invitations` ; action : autoriser une colonne `activation_attempts` + RPC incrémentale.
- Jeton dans le fragment `#token=` (plus la query) ✅ ; page `/activer/` lit le fragment en priorité, compatibilité query conservée.
- `Referrer-Policy: no-referrer` via metadata global ✅.
- Ancien lien invalidé au renouvellement (`admin_prepare_resend`/`admin_issue_activation_link` remplacent `token_hash`) et à la révocation (statut `cancelled`) ✅.
- Aucun jeton journalisé dans le front (aucun `console.log` du lien) ✅.

## 9. Plans

En production : `standard = 0.00`, `silver/gold = NULL`. Le sélecteur d'onboarding affiche « Non configuré » pour un prix NULL mais laisse sélectionner le plan ; le parcours **Trial** reste fonctionnel et est le chemin de test. Le Studio « Souscription » affiche « Prix non configuré — blocage » et refuse la souscription payante tant que les prix ne sont pas décidés. Aucun prix modifié.

## 10. Sommes de contrôle (avant application, à recomparer après)

- `establishments`, `subscriptions`, `profiles` (2 garages + SA) : sha256 `8cf57f71c55260bf…` (valeur complète dans `checksum_garages.txt`, hors dépôt).
- À recalculer avec la même méthode après GO-2 ; toute différence = arrêt et retour arrière.

## Verdict

**NON TERMINÉ.** Le backend et la stratégie sont prêts et répétés en LOCAL/STAGING. Le test sur copie réelle de production est bloqué par la disponibilité du workflow sur `main` et deux secrets CI. Les points bloquants sont listés ci-dessus. **J'attends GO-2** (et, pour le workflow, GO-3).

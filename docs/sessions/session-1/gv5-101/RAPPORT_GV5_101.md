# SESSION 1 — GV5 §101 — Création abonné / Manager sur STAGING : corrigée et validée réellement

Date : 24/11/2026
Cible d'écriture unique : **STAGING `yocufscgninxiihwiepa`** (`auto-dyali-staging`)
Production `nxmsqqoflskfajqrqddw` : **lecture seule, aucune écriture, aucun déploiement, aucun secret modifié.**

---

## 1. Verdict

La création d'un abonné/garage + compte Manager + abonnement + invitation + activation + connexion **fonctionne réellement sur STAGING**, validée bout en bout le 24/11/2026 sur une création jetable (données nettoyées ensuite).

Quatre défauts réels ont été trouvés et corrigés. Le « blocage de création » décrit au §98 n'était **pas** un manque de RPC sur staging : staging possédait déjà l'essentiel du schéma. Le blocage venait du **câblage d'environnement** (application pointée sur la production, où ces RPC n'existent pas).

---

## 2. Cause racine (contredit le §98)

| Constat §98 | Réalité vérifiée le 24/11/2026 |
|---|---|
| « RPC manquantes sur staging » | **Faux.** Les 18 RPC du parcours existent sur staging (vérifié dans `pg_proc`, pas déduit d'un appel frontend). |
| « Colonnes manquantes » | **Faux.** Les 11 colonnes (`professional_id`, `legal_name`, `activity_type`, `region`, `notes`, `country`, `legal_info`, `fiscal_info`, `admin_info`, `dossier_state`, `complementary_contacts`) existent. |
| « Il faut pousser les migrations » | **Faux et dangereux.** `supabase db push --dry-run --remote=yocufscgninxiihwiepa` échoue avec `DbPushMissingLocalError` : l'historique distant est horodaté (`20261118…`) alors que les fichiers locaux sont `0001…0043`. Un push rejouerait tout le schéma. |
| Cause réelle | `src/lib/supabase-browser.ts` avait un **fallback codé en dur vers la production**, et `.env.local` / `.github/workflows/deploy-pages.yml` pointaient également vers la production. L'application parlait donc à un projet sans RPC d'onboarding. |

Également confirmé en lecture seule : la production ne contient **aucune** des RPC d'onboarding.

---

## 3. Défauts réels découverts et corrigés (STAGING)

1. **Câblage production** — repli silencieux vers la production dans le client navigateur. Corrigé : plus aucun repli ; sans variables d'environnement, `supabase = null` (écran « non configuré ») plutôt qu'un appel invisible au mauvais projet. `.env.local` (gitignoré) repointe sur staging avec la clé publishable staging obtenue via CLI.

2. **`admin_onboard_tenant_v2` amputé** — la version `m0039_onboard_v2` appliquée le 20/11/2026 18:44 a écrasé le correctif §76 : l'`INSERT` ne persistait plus les 6 champs administratifs (`country`, `legal_info`, `fiscal_info`, `admin_info`, `dossier_state`, `complementary_contacts`). Corrigé en reprenant **la définition réellement appliquée** (et non la version §76 des fichiers, qui avait une validation en moins) + les 6 colonnes. Aucune régression fonctionnelle.

3. **`admin_update_manager` — e-mail désynchronisé** — modification de `auth.users.email` uniquement ; `auth.identities.identity_data.email` restait ancien. 1 compte divergeait (le SA synthétique). Corrigé : synchronisation de `auth.identities` + rétablissement de la regex avec point échappé (`\.`) + réparation des identités divergentes existantes. Aucune donnée supprimée.

4. **Activation Manager impossible** — `function digest(text, unknown) does not exist`. `hash_invitation_token()` appellait `digest()` alors que pgcrypto est installé dans le schéma `extensions` et que la fonction n'avait pas ce schéma dans son `search_path`. Corrigé par `set search_path = public, extensions`. C'est le défaut bloquant n°4, découvert uniquement par le test réel (aucun audit statique ne l'aurait vu).

---

## 4. Preuves d'exécution (STAGING)

### 4.1 Réconciliation SQL
Fichier : `supabase/reconciliations/20261124_reconcile_manager_onboarding.sql`
- Validé d'abord en transaction annulée (`begin; … rollback;`) : syntaxe OK.
- Appliqué ensuite réellement via `supabase db query --remote=yocufscgninxiihwiepa --file=…`.
- Idempotent, hors `supabase/migrations/` : ne peut jamais être emporté par un `db push`.

Contrôles après application : `onboard_sauve_6_champs = true`, `manager_sync_identities = true`, `regex_point_echappe = true`, `identites_divergentes = 0`.

### 4.2 Parcours réel (création → activation → connexion → isolation)
Compte Auth de test créé via l'API Admin (clé secrète lue depuis un fichier local à permissions 600, jamais affichée). Onboarding appelé avec claims Super Admin simulés (`request.jwt.claim.sub`) et les modules réels de `plan_features`.

| Étape | Résultat |
|---|---|
| `admin_onboard_tenant_v2` | `status: completed`, `idempotent: false`, établissement + abonnement (`trial`) + 11 permissions + invitation `prepared` |
| 6 champs administratifs | Tous persistés (Maroc, SARL…, IF…, dossier, contacts) |
| `activate-manager` (action `activate`) | **200** `{"ok":true,"status":"activated", …, "must_change_password":false}` (avant correctif : 400 `digest…`) |
| `resolve_login_email(login_id)` | 200 → e-mail résolu |
| `signInWithPassword` | **200, session obtenue** |
| Isolation RLS | 1 établissement visible (le sien) ; 0 ligne pour un établissement tiers |
| Profil Manager | `role=manager`, `establishment_id` correct, `login_id` correct |
| Invitation | `status=accepted`, `accepted_at` renseigné |

Cas d'échec :
- réutilisation du jeton → 400 `used` ; `preview` sur jeton consommé → 400 `used` ; jeton inconnu → 400 `invalid` ;
- idempotence : second appel avec le même `request_id` → `idempotent: true`, aucun doublon ;
- `admin_check_identity_available` → les 4 identifiants déjà pris renvoient `false` ;
- `admin_update_establishment` (18 args), `admin_update_manager` (changement d'e-mail), `admin_set_permissions` (3 modules) → OK ;
- après changement d'e-mail : `resolve_login_email` renvoie le nouvel e-mail, connexion avec le nouvel e-mail **200**, avec l'ancien **400**. `auth.users.email = auth.identities.identity_data.email` vérifié.

### 4.3 Nettoyage
Établissement, permissions, abonnement, invitation + événements, requête, audit, profil, identité et user Auth de test supprimés. Contrôle final : 0 ligne restante sur les 3 tables.

### 4.4 Vérification reproductible
`bash scripts/verify-staging-migrations.sh` → **46/46 contrôles OK**, en `--read-only` (interroge `pg_proc`, `information_schema`, `auth.identities`).

---

## 5. Fichiers modifiés (branche corrective)

**Serveur / données (STAGING)**
- `supabase/reconciliations/20261124_reconcile_manager_onboarding.sql` — réconciliation idempotente.

**Application**
- `src/lib/supabase-browser.ts` — suppression du repli production.
- `src/app/super-admin/integrations/page.tsx` — détection de config alignée sur `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

**Scripts durcis**
- `scripts/apply-staging-migrations.sh` — refus explicite de la production, ref exacte, contrôle du nom de projet, détection du mismatch d'historique, **aucun `db push` en écriture**, validation en `rollback` puis application avec confirmation explicite.
- `scripts/verify-staging-migrations.sh` + `scripts/verify-staging-migrations.sql` — vérification SQL réelle en lecture seule.
- `scripts/test-staging-reconciliation.mjs` — 7 tests de régression locaux (ajoutés à `npm test`).
- `scripts/test-onboarding-e2e-staging.mjs` — parcours E2E reproductible (hors `npm test`, exige variables d'environnement, refuse toute cible autre que staging).
- `.gitignore` — `supabase/.temp/` ignoré ; `package.json` / lock — CLI Supabase en `devDependencies`, scripts `test:staging`.

---

## 6. Contrôles de qualité

- `npx tsc --noEmit` : **OK**.
- `npm run lint` : **0 erreur**, 19 avertissements préexistants (aucun introduit).
- `npm test` : **176 tests, 0 échec** (dont les 7 nouveaux).
- `npm run build` : **OK** (build statique Next.js).

---

## 7. Reste à faire (hors périmètre, non fait)

- **Aucun déploiement en production**, aucun merge dans `main`, aucune modification de `.github/workflows/deploy-pages.yml` : le workflow de production reste inchangé et devra être traité séparément, avec l'accord du propriétaire.
- Session Super Admin UI réelle indisponible : le test SQL a simulé les claims ; le script E2E fourni permet de rejouer avec une vraie session quand les identifiants seront disponibles.
- `plans.price_monthly` / `price_yearly` sont `NULL` sur staging : tarifs non inventés, à renseigner par le métier.
- Le jeton d'activation brut n'est jamais renvoyé par le serveur (envoi e-mail/WhatsApp) : l'activation a été testée avec le jeton généré par la RPC, pas via la réception e-mail.
- Le rapport §98 et certaines anomalies du registre §98 sont factuellement invalidés par ce rapport.

# GV5 §103 — Correction des défauts §102, sécurisation et migrations versionnées

Date : 24/11/2026
Branche : `gv5-103-fix-invitations-and-hardening` (créée depuis `96c89c5`)
Cible d'écriture unique : **STAGING `yocufscgninxiihwiepa`**. Aucune écriture en production, aucun merge dans `main`, aucun secret communiqué.

---

## 0. Git (contrôle initial)

| Référence | Attendu | Constaté |
|---|---|---|
| Branche §102 / HEAD | `96c89c5` | `96c89c5` ✅ |
| Commits §102 | `fc20a1b`, `4d84113` | présents ✅ |
| `main` / `origin/main` | `81ca143` | `81ca143` ✅ |
| Branche §101 | `31d5d57` | `31d5d57` ✅ |
| Branche §97 | `d5526cc` | `d5526cc` ✅ |

Aucun écart : aucune correction antérieure écrasée. Aucun commit sur §101 ou §102.

---

## 1. Tableau des tests

| Étape | Statut | Niveau de preuve | Preuve |
|---|---|---|---|
| Vérification Git | OK | TESTÉ SCRIPT/SQL | `git rev-parse` (§0) |
| Migrations versionnées §102 présentes et idempotentes | OK | TESTÉ SCRIPT/SQL | `npm run test:migrations-fresh` : 45 migrations, 2 objets présents dans l'état reconstruit |
| Reconstruction sur base vierge réelle | **NON TESTÉ** | — | Docker et binaire Postgres absents de l'environnement : `supabase db start` impossible. Vérification statique fournie à la place |
| Policy `profiles` : définition exacte | OK | TESTÉ SCRIPT/SQL | `pg_policy` : `polcmd=r`, `polroles={authenticated}`, `USING (is_saas_admin())`, `WITH CHECK=NULL` |
| Policy limitée au Super Admin côté base | OK | TESTÉ SCRIPT/SQL | `is_saas_admin()` = `SECURITY DEFINER`, `STABLE`, `coalesce(role='saas_admin' AND is_active, false)` sur `auth.uid()` |
| Isolation rejouée (2 vraies sessions Manager + anonyme) | OK | TESTÉ NAVIGATEUR | `preuves/security-results.json` : A ne voit que son profil, B = 0 ligne, PATCH B = 0 ligne, RPC = 400 `Accès refusé.`, anonyme = 0 ligne |
| Défaut renouvellement reproduit (avant) | OK | TESTÉ NAVIGATEUR | `preuves/gv5103-avant-renouvellement.png` : bouton désactivé, statut `cancelled` |
| Renouvellement après révocation (après) | OK | TESTÉ NAVIGATEUR | `preuves/renewal-result.json` : EF **200**, `renewed_from` = ancienne invitation, nouvelle invitation `sent`, ancienne toujours `cancelled` |
| Ancien jeton invalide | OK (structurel) | TESTÉ SCRIPT/SQL | `token_hash` ancien inchangé, nouveau différent ; `admin_accept_invitation` refuse tout jeton d'une ligne `cancelled` |
| Erreur réseau vs autorisation | OK | TESTÉ NAVIGATEUR | `preuves/error-classification.json` + 2 captures : réseau → « Service momentanément indisponible », Manager → « Accès refusé » |
| Classificateur (8 cas) | OK | TESTÉ SCRIPT/SQL | `npm test` : 191 tests, 0 échec |
| Non-régression création → modification → permissions → renouvellement | OK | TESTÉ NAVIGATEUR | `preuves/regression-103-results.json` : onboard **200**, `admin_update_establishment` **200**, `admin_update_manager` **200**, `admin_set_permissions` **200**, renouvellement **200** |
| Desktop 1280×800 | OK | TESTÉ NAVIGATEUR | captures §3 et `regression-103-fiche.png` |
| Mobile 375×812 (émulation Playwright, pas un vrai appareil) | OK | TESTÉ NAVIGATEUR | `preuves/mobile-103-results.json` : 4 pages, `scrollWidth=375`, aucun débordement |
| `npm test` / `tsc` / `lint` / `build` | OK | TESTÉ SCRIPT/SQL | 191/191 · 0 erreur TS · 0 erreur ESLint (19 avertissements préexistants) · build OK |
| `verify-staging-migrations.sh` | OK | TESTÉ SCRIPT/SQL | **49/49** contrôles, lecture seule |
| Build production, grep du dossier de sortie | OK | TESTÉ SCRIPT/SQL | `yocufscgninxiihwiepa` : **0 occurrence** ; URL production : 2 occurrences (injection d'environnement attendue) |
| Nettoyage données de test | OK | TESTÉ SCRIPT/SQL | 0 établissement, 0 invitation, 0 user Auth résiduels ; invitation préexistante remise à `prepared` |

---

## 2. Migrations versionnées

Trois fichiers ajoutés dans `supabase/migrations/`, horodatés et idempotents :

| Fichier | Contenu | Idempotence |
|---|---|---|
| `20261124130000_add_invitation_events_provider_error.sql` | `ALTER TABLE … ADD COLUMN IF NOT EXISTS provider_error` | `IF NOT EXISTS` |
| `20261124130100_saas_admin_select_profiles.sql` | policy SELECT `saas_admin_select_profiles` | `DROP POLICY IF EXISTS` |
| `20261124131000_admin_create_invitation_renewal.sql` | RPC `admin_create_invitation_renewal` + grants | `CREATE OR REPLACE` |

Vérification : `scripts/verify-migrations-fresh-db.mjs` rejoue les 45 fichiers dans l'ordre sur un modèle de schéma et confirme la présence finale de la colonne et de la policy, ainsi que l'absence de `WITH CHECK` (écriture). **Limite assumée** : il ne s'agit pas d'une exécution Postgres réelle (Docker absent) ; la preuve d'exécution sur staging reste `verify-staging-migrations.sh` (49/49).

### Migrations à appliquer en PRODUCTION (décision du propriétaire, aucune écriture faite)
1. `20261124130000_add_invitation_events_provider_error.sql`
2. `20261124130100_saas_admin_select_profiles.sql`
3. `20261124131000_admin_create_invitation_renewal.sql`
4. Prérequis §101 : les réconciliations `20261124_reconcile_manager_onboarding.sql`, `20261124_add_invitation_events_provider_error.sql` et `20261124_saas_admin_profiles_select.sql` décrivent l'état cible ; la production ne disposant pas des RPC d'onboarding, un plan de migration complet devra être validé séparément.

---

## 3. Revue de sécurité de la policy `profiles`

Définition exacte relevée sur staging :
- `polname = saas_admin_select_profiles`
- `polcmd = r` (SELECT uniquement)
- `polroles = {authenticated}`
- `USING (is_saas_admin())`
- `WITH CHECK = NULL`

`public.is_saas_admin()` est `SECURITY DEFINER`, `STABLE`, `search_path=public`, et renvoie
`coalesce((select p.role = 'saas_admin' and p.is_active from public.profiles p where p.id = auth.uid()), false)`.
La vérification est donc bien **côté base**, sur l'identité de la session, pas sur un état client.

Tests rejoués avec de vraies sessions (routes réseau capturées) :

| Session | Lecture profils | Lecture profil cible | Modification profil cible | RPC `admin_update_manager` cible |
|---|---|---|---|---|
| Manager A | 1 ligne (la sienne) | 0 ligne | 0 ligne modifiée | 400 `Accès refusé.` |
| Manager B | 1 ligne (la sienne) | 0 ligne | 0 ligne modifiée | 400 `Accès refusé.` |
| Anonyme (clé publishable seule) | 0 ligne | — | — | — |

**Conclusion : policy pas trop large, aucune correction nécessaire.** Aucun profil d'un autre établissement n'est lisible ou modifiable.

---

## 4. Défauts corrigés (un commit par correction)

| Commit | Correction |
|---|---|
| `93842e6` | Migration versionnée de `invitation_events.provider_error`. |
| `0ffce69` | Migration versionnée de la policy SELECT Super Admin + script de reconstruction statique. |
| `b6556de` | Renouvellement après révocation : nouveau RPC, EF `send-invitation` et UI. Décision : **ne jamais ressuciter l'ancienne invitation** ; une nouvelle ligne est créée avec un nouveau jeton (hash seul stocké), l'ancienne reste `cancelled` donc son lien est invalide. |
| `8b9eec8` | Distinction réseau / session / 401-403 / 5xx / erreurs métier via `src/lib/supabase-errors.ts`, utilisé par le guard, la connexion et la relance. Fail-closed conservé. |
| `18848c8` | Clarification du libellé « Abonnements payants actifs » (les essais sont comptés séparément) et du récapitulatif « Juridique / Fiscal / Admin / Contacts ». |
| `b62d0b7` | Intégration des 8 tests de non-régression à `npm test`. |

### Défauts restants (documentés, non corrigés)
- **Fournisseur e-mail absent** : aucun secret Resend/WhatsApp sur staging ; tous les envois aboutissent à `non_configure`. Aucun e-mail réel n'a été envoyé, aucune adresse de vraie personne utilisée pour un envoi.
- **Ville non modifiable par saisie libre** dans la fiche (composant `ChampGeographieMaroc`, probablement sélection obligatoire) : correction risquée sans reproduction supplémentaire, documentée.
- **Reconstruction Postgres vierge réelle non exécutable ici** (Docker absent), remplacée par une vérification statique explicite.

---

## 5. Points mineurs tranchés

- **« Abonnements actifs 0 »** : la requête compte `status='active'` ; les 52 essais ont `status='trial'` et sont affichés dans le sous-libellé. Ce n'est pas un bug de requête mais une ambiguïté de libellé, corrigée en « Abonnements payants actifs » sans toucher au calcul.
- **« Managers actifs »** : 50 profils `manager` actifs sur staging, tous créés entre le 19 et le 21/11/2026 avec des adresses `.local` ou explicitement nommées « Test ». Un compte (`test.manager.complet@gmail.com`, « Test Complet ») utilise un domaine réel mais est clairement identifié comme test : **à confirmer par le propriétaire** si ce compte doit rester sur staging.
- **Tarifs** : inchangés, `price_monthly`/`price_yearly` restent NULL pour STANDARD/SILVER/GOLD. Trial reste fonctionnel sans Stripe (création de régression : abonnement `trial`).

---

## 6. Questions ouvertes

1. **Tarifs** : quels montants MAD mensuels/annuels fournir via `GV581_*_MENSUEL/ANNUEL` ? Aucune valeur inventée.
2. **Fournisseur e-mail de test** : installer Mailpit/Inbucket ou configurer Resend en mode test demande une décision et un secret ; non inventés. Tant que rien n'est configuré, l'activation par lien e-mail de bout en bout reste non testable (le parcours par jeton direct a été validé en §101).
3. **Migrations PRODUCTION** : liste en §2, à valider par le propriétaire ; aucune écriture effectuée.
4. **Compte `test.manager.complet@gmail.com`** : confirmer qu'il s'agit bien d'un compte de test.

---

## 7. Tests restant à effectuer

- Activation via un lien e-mail/WhatsApp capturé (nécessite un fournisseur de test).
- Reconstruction réelle sur une base Postgres vierge (nécessite Docker/Postgres local).
- Vrai téléphone physique (ici émulation 375×812).
- Session expirée côté serveur (401 RPC) : couverte par les tests unitaires du classificateur, pas par un scénario navigateur.
- Décision tarifaire et application sur staging si souhaité.

---

## 8. Branche et HEAD

Branche `gv5-103-fix-invitations-and-hardening`, poussée sur `origin`.
HEAD final et commits à récupérer via `git log --oneline -8` (branche non fusionnée).

## 9. Verdict

**Oui, prêt pour revue de merge dans `main` — pas pour un merge automatique.**

Tous les critères techniques de la mission sont remplis : migrations versionnées, policy confirmée limitée au Super Admin et isolation rejouée sans faille, renouvellement après révocation fonctionnel en navigateur, erreurs réseau et autorisation distinctes, aucun tarif inventé, aucun secret exposé, aucune régression (191 tests verts, 49 contrôles staging, build production sans URL staging). Les seuls points en suspens sont des **décisions externes** (tarifs, fournisseur e-mail, migrations production, compte Gmail de test) et une limite d'environnement (pas de Postgres local pour une reconstruction réelle) — aucun ne bloque la revue de code.

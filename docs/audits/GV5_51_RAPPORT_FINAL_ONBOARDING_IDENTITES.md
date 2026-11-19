# GV5 §51 — Rapport final : onboarding Super Admin, identités, activation et double transmission

**Date** : 17 novembre 2026
**Périmètre** : correction locale des défauts P0/P1 du rapport §50
**Base de référence** : `docs/audits/GV5_50_AUDIT_FINAL_IDENTITE_DOUBLE_TRANSMISSION.md`
**Branche** : `main` — HEAD `64359da` — travail local **non commité**, **non poussé**
**Opérations distantes** : **AUCUNE** (pas de push, pas de déploiement, pas de migration, pas de compte créé, pas de message envoyé)

---

## 1. Verdict global

| Dimension | Verdict |
|---|---|
| Contrat unique typé client ↔ serveur | **CONFORME** (local, testé) |
| Identités professionnelle et Manager (code + migrations) | **CONFORME local** / **NON VÉRIFIÉ en base** |
| Activation sans `signUp`, jeton non consommé à l'ouverture | **CONFORME** (local, testé) |
| Double transmission e-mail / WhatsApp indépendante | **CONFORME en simulation** / **NON VÉRIFIÉ en réel** |
| Permissions réelles et intersection forfait ∩ droits | **PARTIEL** : `can_view` appliqué serveur ; CRUD stocké mais non généralisé aux RLS métier |
| Sécurité des migrations 0036/0037/0038/0039 | **CONFORME local** / **NON APPLIQUÉ** |
| Tests (18 catégories) | **CONFORME local** : 138 tests, 0 échec |
| Build / TypeScript / lint | **CONFORME** : `tsc` 0 erreur, lint 0 erreur, build export OK |

**Statut de la mission : PARTIEL — code prêt, validation réelle bloquée par les autorisations et les secrets externes.**
Aucune exigence n'est déclarée « opérationnelle en production » sans preuve réelle.

---

## 2. Contrat JSON unique

Source canonique : `supabase/functions/_shared/contract.ts`
Ré-export client strict : `src/lib/onboarding-contract.ts` (`export * from ".../contract.ts"`)

Le contrat v2 est **imbriqué** (`establishment`, `manager`, `subscription`, `modules`, `permissions`, `delivery`) et couvre **tous** les champs exigés. Correspondance explicite :

| Exigence mission | Champ du contrat v2 |
|---|---|
| `professional_id` | `establishment.professionalId` |
| `manager_login_id` | `manager.loginId` |
| `manager_name` | `manager.fullName` |
| `manager_email` | `manager.email` |
| `manager_phone` | `manager.phone` |
| `manager_password` temporaire | `manager.temporaryPassword` + `temporaryPasswordConfirm` |
| `plan` | `subscription.plan` |
| `paid_duration` | `subscription.paidDuration` / `paidDurationMonths` |
| `trial_duration` | `subscription.trialDuration` / `trialDurationDays` |
| `modules` | `modules[]` |
| `permissions` | `permissions[]` (`module`, `canView`, `canCreate`, `canEdit`, `canDelete`) |
| `request_id` | `requestId` (UUID obligatoire) |

Garanties :

- `contractVersion = 2` obligatoire ;
- clés inconnues **refusées** (`_unknown.*`), jamais ignorées ;
- chaînes trimées, longueurs bornées, e-mails/URL/slug/identifiants validés ;
- cohérence modules ↔ permissions : chaque module ouvert doit avoir une permission avec au moins une action, et toute permission doit viser un module sélectionné ;
- au moins un module et au moins un canal de transmission ;
- dates de fin calculées de façon déterministe ;
- aucune donnée secrète dans les messages d'erreur.

Tests : `scripts/test-onboarding-contract.mjs` (20 tests).

---

## 3. Identités, unicité et association

### 3.1 Identité professionnelle

- Colonne `establishments.professional_id` (0039), index unique partiel sur `upper(professional_id)`.
- Génération `ADY-PRO-XXXXXX` côté client, mais **unicité revalidée en base**.
- RPC `admin_check_identity_available(...)` : contrôle `professional_id`, `login_id`, e-mail Auth, slug.
- L'EF revérifie avant toute création et renvoie `409` avec les champs en conflit.

### 3.2 Identité de connexion Manager

- Colonne `profiles.login_id` + index unique partiel sur `lower(login_id)`.
- `resolve_login_email(p_login)` traduit un identifiant en e-mail Auth **avant** connexion, sans exposer l'e-mail ni les données tenant, pour les comptes actifs uniquement.
- La page `/connexion/` accepte un e-mail **ou** un identifiant ; si 0039 n'est pas appliquée, elle l'annonce explicitement et demande l'e-mail (aucune fausse promesse).
- Le Manager existe réellement dans `auth.users` : le login n'est **jamais** présenté comme un authentifiant autonome.

### 3.3 Association Auth ↔ établissement ↔ abonnement

`admin_onboard_tenant_v2` (0039) réalise en une transaction :

1. établissement (identité professionnelle, forfait, essai) ;
2. abonnement (`trial`/`active`, période payante, fin d'essai) ;
3. profil Manager rattaché à l'établissement (`role = manager`, `login_id`, drapeau de rotation) ;
4. permissions réelles (`public.permissions`) ;
5. invitation (empreinte SHA-256 uniquement) + événement ;
6. journal d'audit ;
7. clôture idempotente (`onboarding_requests`).

Verrou consultatif `pg_advisory_xact_lock(hashtextextended(request_id))` + contrainte primaire : une même requête ne crée pas deux abonnés.

### 3.4 Dossier abonné

`src/app/super-admin/entreprises/page.tsx` affiche désormais :

- `professional_id` de l'établissement ;
- le Manager associé (`full_name`, `login_id`) ;
- recherche et export CSV incluant ces identités.

La requête utilise `select("*")` et un repli sans embed si les colonnes/policies ne sont pas encore appliquées : la page reste lisible avant 0039, sans prétendre que l'identité existe.

---

## 4. Mot de passe temporaire et première connexion

Architecture retenue (option B du §50, la seule qui permet réellement un mot de passe imposé) :

1. **Création serveur** : `auth.admin.createUser` avec `password`, `email_confirm: true` (service_role, jamais côté navigateur).
2. **Aucun stockage en clair** : ni table, ni journal, ni fichier, ni réponse HTTP.
3. **Drapeau serveur** : `profiles.must_change_password = true`, `temporary_password_issued_at`.
4. **Blocage réel** : politiques RLS **restrictives** `password_rotation_required` sur toutes les tables portant `establishment_id`.
5. **Preuve de changement** : `auth.users.updated_at > temporary_password_issued_at` exigée par `admin_complete_password_change()` et par `admin_accept_invitation`.
6. **Parcours** : `/connexion/` redirige vers `/changer-mot-de-passe/` tant que le drapeau est vrai ; la coque applicative (`shell-app.tsx`) applique la même garde.
7. **Activation par lien** : le Manager choisit lui-même son mot de passe ; l'EF appelle `auth.admin.updateUserById` puis `admin_accept_invitation`, qui lève le drapeau **seulement** après preuve.

Tests : `scripts/test-activation.mjs` (8), `scripts/test-edge-functions-51.mjs` (13).

---

## 5. Activation `/activer/`

- Route réelle : `src/app/activer/page.tsx` (le chemin `/actiter` a disparu du code).
- Le test qui verrouillait la faute a été corrigé : `scripts/test-invitations.mjs` attend désormais `/activer/?token=…`.
- **Aucun `signUp`** : l'EF `activate-manager` refuse implicitement toute création de compte.
- **Jeton non consommé à l'ouverture** : l'action `preview` appelle `admin_invitation_preview` et ne modifie rien.
- **Usage unique** : `status = accepted` refusé ; `admin_accept_invitation` verrouille la ligne (`for update`).
- **Durée vérifiée** : `expires_at < now()` → invitation expirée, statut mis à jour.
- **Vérification finale** : `signInWithPassword` après activation, puis `signOut` ; aucun succès annoncé sans connexion réussie.
- **Jeton haché** : SHA-256 en base, jeton brut uniquement dans l'URL transmise.

---

## 6. Double transmission e-mail / WhatsApp

Adaptateurs réels : `supabase/functions/_shared/providers.ts`

| Canal | Fournisseur | Condition de succès | Statut enregistré |
|---|---|---|---|
| E-mail | Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | HTTP 2xx | `accepte_par_fournisseur` |
| WhatsApp | Meta WhatsApp Business (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`) | HTTP 2xx | `accepte_par_fournisseur` |
| Non configuré | — | aucun appel | `non_configure` |
| Échec | — | HTTP non 2xx / réseau | `echec` + message |
| Non demandé | — | — | `non_demande` |

Garanties :

- chaque canal est appelé et enregistré **séparément** (`invitation_events`, `email_status`, `whatsapp_status`) ;
- l'échec d'un canal n'annule pas l'autre ;
- **aucun statut « délivré » ou « lu » n'est inventé** : il faudrait un webhook signé, non implémenté ;
- la relance (`send-invitation`) émet un nouveau jeton haché, reste idempotente par `requestId`, et ne marque pas « envoyé » avant la réponse fournisseur ;
- le succès e-mail/WhatsApp est testé **en simulation** avec un `fetch` injecté : aucun message réel n'a été envoyé.

Tests : `scripts/test-providers.mjs` (16).

---

## 7. Modules et permissions

Deux notions distinctes :

- **modules du forfait** : `plan_features` pour le forfait souscrit ;
- **permissions attribuées** : `public.permissions` (`module`, `can_view`, `can_create`, `can_edit`, `can_delete`).

Application serveur :

- `my_features()` = `plan_features.enabled AND (aucune permission définie OR permission.can_view)` ;
- `has_feature(module)` applique la **même** intersection ;
- `my_permissions()` expose les droits du rôle courant ;
- RLS `permissions` : lecture tenant (`current_establishment_id()`), écriture Super Admin uniquement ;
- menu : `useFeatures()` charge `my_features()` + `my_permissions()` ; `allows()` pilote l'affichage, `can(module, action)` les actions.

**Limite déclarée (PARTIEL)** : l'ouverture d'un module (`can_view`) est réellement appliquée côté serveur. Les actions `can_create/can_edit/can_delete` sont **persistées** et exposées, mais ne sont pas encore généralisées à toutes les politiques RLS métier table par table. Aucune case n'est décorative (chaque module coché produit une ligne `permissions`), mais le CRUD fin reste à brancher sur les RLS des tables concernées.

Tests : `scripts/test-permissions.mjs` (6), `scripts/test-migrations-51.mjs` (18).

---

## 8. Migrations préparées

| Fichier | État | Contenu vérifié |
|---|---|---|
| `0036_invitations_manager_prepared_NOT_APPLIED.sql` | Réécrite | `token_hash`, statuts par canal, preview sans consommation, acceptation à usage unique avec preuve, `admin_record_delivery`, `admin_prepare_resend`, grants sans PUBLIC |
| `0037_fix_security_p0_prepared_NOT_APPLIED.sql` | Corrigée | 16 révocations PUBLIC conservées ; **aucun** `FORCE ROW LEVEL SECURITY` ; décision documentée |
| `0038_security_rls_indexes_prepared_NOT_APPLIED.sql` | Auditée | aucun `DISABLE ROW LEVEL SECURITY`, index et policies conservés |
| `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | Créée | identités, index uniques, rotation RLS, `get_my_security_state`, `resolve_login_email`, permissions RLS, `my_features`/`has_feature` ∩ permissions, `admin_check_identity_available`, `admin_onboard_tenant_v2`, `admin_complete_password_change` |

- Ordre d'application : **0036 → 0037 → 0038 → 0039**.
- Blocs `$$` équilibrés : 0036 = 16, 0037 = 4, 0038 = 2, 0039 = 22.
- La ligne parasite `SQL\n")` de 0036 a disparu.
- **Aucune migration n'a été appliquée**, ni localement (pas de client Postgres), ni à distance.

---

## 9. WhatsApp Business et Chatbot IA

- `src/app/super-admin/whatsapp/page.tsx` : état honnête, droits réels par forfait, centre de suivi des communications, liste des prérequis, aucun envoi simulé présenté comme réel.
- `src/app/super-admin/chatbot/page.tsx` : indique explicitement qu'aucun moteur n'est connecté, affiche uniquement les droits réels par forfait et le plan d'activation.
- Navigation Super Admin : 13 rubriques, dont **Invitations Manager**, **WhatsApp Business** et **Chatbot IA** ; chaque entrée pointe vers une page existante.

---

## 10. Tests — mesure réelle et catégories

Commande : `npm test`
Résultat mesuré : **138 tests / 138 pass / 0 fail** (0 skipped).

| Fichier | Tests déclarés | Assertions |
|---|---:|---:|
| `test-crm-csv.mjs` | 10 | 24 |
| `test-onboarding.mjs` | 28 | 55 |
| `test-csv-export.mjs` | 5 | 13 |
| `test-crm.mjs` | 4 | 13 |
| `test-pre-purchase.mjs` | 8 | 17 |
| `test-invitations.mjs` | 26 (runner maison) | 31 |
| `test-employes.mjs` | 15 (runner maison) | contrôles internes |
| **`test-onboarding-contract.mjs`** | **20** | **41** |
| **`test-activation.mjs`** | **8** | **20** |
| **`test-permissions.mjs`** | **6** | **17** |
| **`test-providers.mjs`** | **16** | **39** |
| **`test-migrations-51.mjs`** | **18** | **50** |
| **`test-edge-functions-51.mjs`** | **13** | **47** |

Les deux runners maison comptent pour 1 « test » Node chacun : le total Node (138) diffère donc du nombre de cas métier déclarés.

### 10.1 Couverture des 18 catégories exigées

| # | Catégorie | Statut | Preuve |
|---|---|---|---|
| 1 | Contrat JSON | **COUVERT** | 20 tests contrat + ré-export identique |
| 2 | Création abonné | **PARTIEL** | EF + RPC statiques testées ; aucun appel réel |
| 3 | Unicité | **COUVERT (local)** | contrat, RPC 0039, EF 409, tests statiques |
| 4 | Compte Auth | **COUVERT (local)** | `createUser`, compensation, pas de clé en dur |
| 5 | Association établissement/profil | **COUVERT (statique)** | RPC 0039, ordre des insertions |
| 6 | Permissions | **COUVERT (local)** | 6 tests + RLS + intersection |
| 7 | Activation | **COUVERT** | preview sans consommation, usage unique, expiration |
| 8 | Première connexion | **COUVERT (local)** | `/changer-mot-de-passe/`, garde shell |
| 9 | Changement de mot de passe | **COUVERT (local)** | preuve `updated_at`, RPC dédiée |
| 10 | E-mail | **SIMULÉ** | Resend, fetch injecté |
| 11 | WhatsApp | **SIMULÉ** | Meta, fetch injecté |
| 12 | Échec indépendant | **COUVERT** | 2 tests d'indépendance croisée |
| 13 | Relance | **COUVERT (local)** | idempotence `requestId`, canal |
| 14 | Isolation | **PARTIEL** | policies vérifiées statiquement, non exécutées |
| 15 | RLS | **PARTIEL** | 0037/0039 vérifiées, non appliquées |
| 16 | Expiration | **COUVERT** | contrat, activation, invitation |
| 17 | Régression `/actiter` | **COUVERT** | test dédié + grep code |
| 18 | Réconciliation des chiffres | **COUVERT** | tableau ci-dessus, mesuré |

### 10.2 Nature des tests

- **Unitaires purs** : contrat, activation, permissions.
- **Simulés** : fournisseurs e-mail/WhatsApp (`fetch` injecté).
- **Statiques** : migrations, Edge Functions, page dossier abonné.
- **Intégration réelle Supabase** : **AUCUNE**.
- **Fournisseurs réels** : **AUCUN**.

---

## 11. Validation technique

| Contrôle | Commande | Résultat |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 erreur** |
| Lint | `npm run lint` | **0 erreur** (7 avertissements préexistants) |
| Tests | `npm test` | **138 / 138** |
| Build | `npm run build` | **Export OK** (`out/activer`, `out/changer-mot-de-passe`, `out/super-admin/onboarding`, `out/super-admin/whatsapp`). Code de sortie parfois `1` **après** la génération, à cause de l'avertissement `SecurityFatalError` de Next.js 16.4.3 ; une exécution a retourné `0`. |

Le build compile et génère l'export ; selon l'exécution, Next.js peut ensuite sortir en code `1` avec `SecurityFatalError` (avis de sécurité sur la version 16.4.3). Un essai a retourné `0`. L'export a été vérifié sur disque.

---

## 12. Blocages externes (inchangés)

| Blocage | Raison | Ce qu'il faudrait |
|---|---|---|
| Application des migrations 0036→0039 | Gel P0, sauvegarde/PITR non vérifiée, autorisation absente | Autorisation explicite + sauvegarde restaurée |
| Création réelle du compte Manager | Migration 0036/0039 non appliquée, EF non déployée | Appliquer les migrations, déployer `onboard-tenant` |
| Connexion et isolation réelles | Aucun compte de test réel | Compte réel + politiques appliquées |
| Envoi e-mail réel | `RESEND_API_KEY`, `EMAIL_FROM` absents | Secrets fournisseur |
| Envoi WhatsApp réel | Secrets Meta absents, modèle non approuvé | Secrets + template approuvé |
| Webhooks « délivré / lu » | Non implémentés | Endpoint signé + vérification Meta |
| E2E Playwright | Crash navigateur `SIGTRAP` | Environnement CI compatible |
| Application SQL locale | `psql`, `supabase`, `deno` absents | Outillage CLI |

---

## 13. Fichiers principaux modifiés / créés

**Contrat & logique**
- `supabase/functions/_shared/contract.ts` (créé)
- `supabase/functions/_shared/providers.ts` (créé)
- `src/lib/onboarding-contract.ts` (créé, ré-export)
- `src/lib/activation.ts` (créé)
- `src/lib/permissions.ts` (créé)
- `src/lib/invitation.ts` (nettoyé, plus de faux fournisseur)
- `src/lib/features.ts` (permissions + `can`)

**Edge Functions**
- `supabase/functions/onboard-tenant/index.ts` (réécrite)
- `supabase/functions/activate-manager/index.ts` (créée)
- `supabase/functions/send-invitation/index.ts` (créée)

**Migrations**
- `0036_..._NOT_APPLIED.sql` (réécrite)
- `0037_..._NOT_APPLIED.sql` (corrigée)
- `0038_..._NOT_APPLIED.sql` (auditée)
- `0039_..._NOT_APPLIED.sql` (créée)

**Interface**
- `src/app/super-admin/onboarding/page.tsx` (contrat v2)
- `src/app/activer/page.tsx` (preview + EF)
- `src/app/connexion/page.tsx` (e-mail **ou** identifiant)
- `src/app/changer-mot-de-passe/page.tsx` (créé)
- `src/components/shell-app.tsx` (garde de rotation)
- `src/components/super-admin-invitations-list.tsx` (statuts + relance)
- `src/components/super-admin-shell.tsx` (13 rubriques)
- `src/app/super-admin/whatsapp/page.tsx`
- `src/app/super-admin/entreprises/page.tsx` (dossier abonné)

**Tests**
- `scripts/test-onboarding-contract.mjs`
- `scripts/test-activation.mjs`
- `scripts/test-permissions.mjs`
- `scripts/test-providers.mjs`
- `scripts/test-migrations-51.mjs`
- `scripts/test-edge-functions-51.mjs`
- `scripts/test-invitations.mjs` (corrigé)

---

## 14. Ce qui n'est pas déclaré conforme

1. **Aucune preuve d'exécution Supabase** : migrations non appliquées, aucun compte réel, aucun login réel.
2. **Aucune preuve de délivrabilité** : les statuts fournisseurs n'ont été validés qu'en simulation.
3. **CRUD fin des permissions** non généralisé aux RLS métier (seul `can_view` est appliqué au niveau module).
4. **Webhooks de livraison** non implémentés : aucun statut « délivré / lu » n'est affiché.
5. **Aucune opération distante** effectuée : le code est prêt, pas déployé.

---

## 15. Recommandation

1. Sauvegarder / vérifier PITR, puis autoriser l'application contrôlée **0036 → 0037 → 0038 → 0039**.
2. Déployer `onboard-tenant`, `activate-manager`, `send-invitation` avec `verify_jwt = true` et les secrets fournisseur.
3. Créer **un** abonné de test, vérifier : création Auth, `professional_id`, `login_id`, `permissions`, invitation, connexion, rotation du mot de passe, isolation.
4. Configurer Resend puis Meta WhatsApp, exécuter un envoi réel vers des destinataires internes, vérifier les statuts enregistrés.
5. Étendre l'application des permissions CRUD aux politiques RLS des tables métier, module par module.
6. Mettre à jour ce rapport avec les preuves réelles avant toute déclaration de conformité en production.

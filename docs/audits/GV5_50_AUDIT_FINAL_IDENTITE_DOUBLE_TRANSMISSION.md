# GV5 §50 — Audit final ciblé : identité professionnelle, compte Manager, double transmission

**Date** : 17 novembre 2026
**Type** : audit en lecture seule — aucune modification de code, aucune opération distante
**HEAD Git** : `64359da` (branche `main`, synchronisée avec `origin/main`, travail local non commité)
**Projet Supabase** : `nxmsqqoflskfajqrqddw`
**Périmètre** : `src/app/super-admin/onboarding/page.tsx`, `src/lib/onboarding.ts`, `src/lib/invitation.ts`, `src/app/activer/page.tsx`, `src/components/super-admin-invitations-list.tsx`, `src/components/super-admin-shell.tsx`, `supabase/functions/onboard-tenant/index.ts`, migrations 0027→0038, état réel de la base distante (requêtes SELECT uniquement).

> **Conclusion générale** : le formulaire est une **coquille UI avancée**, pas un système fonctionnel.
> L'identité professionnelle n'est **pas persistée**, l'identifiant de connexion **n'existe pas** côté Auth,
> le mot de passe saisi **n'est jamais utilisé**, le contrat de données entre le formulaire et l'Edge Function
> est **incompatible** (échec garanti en 400), les modules cochés **ne sont jamais enregistrés**, et **aucun
> envoi e-mail/WhatsApp applicatif n'existe**. Les statuts affichés ne proviennent d'aucun fournisseur.

---

## 1. Tableau de synthèse des 12 points

| # | Question | Verdict | Preuve principale |
|---|----------|---------|-------------------|
| 1 | Identifiant professionnel choisi par le SA + unicité en base | **NON** (UI seulement) | Pas de colonne `professional_id` ni de contrainte sur `establishments` |
| 2 | Identifiant de connexion créé et associé au compte Auth | **NON** | Aucune colonne, aucun mapping login→email, EF l'ignore |
| 3 | Mot de passe initial sécurisé (pas de stockage clair, pas de logs) | **PARTIEL** | Jamais stocké/loggé, mais jamais utilisé non plus ; aucun changement forcé |
| 4 | Compte Manager réellement créé côté serveur | **NON via ce formulaire** | EF ACTIVE mais contrat de body incompatible → 400 systématique |
| 5 | Association établissement + abonnement + permissions | **PARTIEL** | Établissement/abonnement oui (RPC) ; permissions/modules **non** |
| 6 | Envoi e-mail et WhatsApp réellement opérationnels | **NON** | Aucun appel fournisseur ; adaptateurs factices |
| 7 | Indépendance des deux canaux | **NON** | Un seul chemin (invite Supabase) ; cases ignorées |
| 8 | Statuts = réponses réelles des fournisseurs | **NON** | Tables `invitations`/`invitation_events` absentes ; UI ne lit aucun event |
| 9 | Le Manager peut activer son compte et se connecter | **NON** | Lien généré `/actiter` (typo) ; jeton consommé trop tôt ; RPC absente |
| 10 | Isolation stricte par garage | **STRUCTURE OK, NON PROUVÉ** | RLS partout + policies tenant, mais `FORCE RLS=false`, 14 fonctions EXECUTE PUBLIC |
| 11 | WhatsApp Business / Chatbot IA réellement opérationnels | **NON** (et Chatbot non lié) | Pages déclarent explicitement « non opérationnel » ; Chatbot absent du menu |
| 12 | Réconciliation du nombre de tests | **CHIFFRES FAUX** | 57 déclarés par `npm test`, 96 assertions réelles, 28 tests onboarding |

---

## 2. Preuves détaillées

### Q1 — Identifiant professionnel : choisi mais non persisté

**UI : oui.**
- `src/app/super-admin/onboarding/page.tsx:105` — état `professionalId`.
- `:266` — `modifier("companyName", …)` déclenche `genererIdentifiantProfessionnel()` si le champ est vide.
- `:486-491` — champ « Identifiant professionnel » + bouton « Générer ».
- `:361` — envoi `p_professional_id: form.professionalId.trim()`.
- `src/lib/onboarding.ts:16,129-131` — type + validation « obligatoire ».

**Base : non.** Requête `information_schema.columns` sur le projet distant : `establishments` possède **16 colonnes** (`id, name, slug, address, city, phone, email, currency, timezone, plan, is_active, created_at, updated_at, trial_ends_at, suspended_at, logo_url`) — **aucune `professional_id`**.

Contraintes réelles de `establishments` :
```
establishments_pkey      PRIMARY KEY (id)
establishments_slug_key  UNIQUE (slug)
```
→ **aucune unicité possible** sur l'identifiant professionnel.

**Serveur : non.** L'Edge Function (`supabase/functions/onboard-tenant/index.ts:94-95`) ne lit que
`requestId, companyName, slug, city, phone, email, plan, trialDays, managerName, managerEmail, managerPhone`.
`p_professional_id` **n'est jamais lu** → silencieusement ignoré.

**Vérification des doublons : inexistante.** Aucun appel de contrôle en temps réel, aucune contrainte SQL, aucun contrôle serveur. Le seul contrôle d'unicité réel est celui du `slug` (RPC `admin_onboard_tenant`).

---

### Q2 — Identifiant de connexion : champ décoratif

- Champ UI : `onboarding/page.tsx:541-548` (`managerLoginId`), envoi `p_manager_login_id` (`:358`).
- Validation : `src/lib/onboarding.ts:192-199` (format `^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$`).
- **Mais** l'Edge Function ne lit pas `p_manager_login_id` (`index.ts:94-95`).
- Aucune colonne `login_id` dans `profiles` (colonnes réelles : `id, full_name, phone, establishment_id, role, avatar_url, is_active, pin_hash, hourly_rate, created_at`).
- Supabase Auth s'authentifie **par e-mail** : `src/app/connexion/page.tsx:46` appelle `signInWithPassword({ email: email.trim(), … })`. Le libellé « email ou identifiant » est trompeur ; un identifiant court ne peut pas fonctionner.
- **Aucun mapping login → email** n'existe (ni table, ni RPC, ni EF).

---

### Q3 — Mot de passe initial : bonnes intentions, chaîne rompue

**Ce qui est conforme :**
- Jamais envoyé en base : aucune colonne mot de passe (`profiles` vérifié), aucune écriture dans `audit_log` (payload RPC 0028 limité à `company/slug/plan/trial_days/manager_user_id/subscription_id/request_id`).
- Jamais journalisé : `grep console.` sur `onboarding/page.tsx` et `index.ts` → **0 occurrence**.
- Uniquement en état React, champ `type="password"`.

**Ce qui ne l'est pas :**
1. **Le mot de passe est inutilisé.** `index.ts` ne lit ni `p_manager_password` ni `p_manager_password_confirm` ; la création Auth passe par `admin.auth.admin.inviteUserByEmail(mgrEmail)` (`index.ts:150`). Le mot de passe choisi par le Super Admin est donc **jeté**.
2. **Aucun changement obligatoire à la première connexion** : `grep passwordChange|password_change|must_change|changePassword` sur `src/` et `supabase/` → **0 résultat**.
3. **Aucune invalidation/expiration** du mot de passe temporaire.
4. La confirmation (`p_manager_password_confirm`) est transmise au serveur alors qu'elle devrait rester côté client.
5. **La validation n'est pas branchée** : le `useMemo` `erreurs` (`onboarding/page.tsx:187-201`) n'inclut **ni** `managerLoginId`, **ni** `managerPassword`, **ni** `managerPasswordConfirm`. Conséquences :
   - `etapeValide(2)` (`:220-226`) ne teste que nom/e-mail/téléphone → on peut passer l'étape 2 avec des champs vides ou incohérents (seul l'attribut HTML `required` bloque le vide) ;
   - **la non-concordance des mots de passe n'est jamais détectée** avant l'envoi ;
   - la règle « 8 caractères minimum » n'est **pas** appliquée dans l'interface.
6. Pas d'`autoComplete="new-password"`.
7. Les tests unitaires valident bien `validateOnboardingInput`, mais cette fonction n'est pas appelée avec ces champs par la page → **les tests ne prouvent pas le comportement réel de l'écran**.

---

### Q4 — Création réelle du compte Manager : bloquée par un contrat incompatible

**État distant réel :**
```
Edge Function onboard-tenant : ACTIVE, version 1, verify_jwt = true
sha256 = 44b70cf4db633103484e003d2cc68db51568856624a18c40d5d13d575d326bb8
```
La source déployée est identique à `supabase/functions/onboard-tenant/index.ts` (comparée via `get_edge_function`).

La fonction fait bien une création Auth serveur avec `service_role` (`index.ts:150-153`), avec compensation `deleteUser` en cas d'échec RPC (`:179-182`).

**Mais le formulaire ne peut pas l'appeler correctement.** Correspondance réelle :

| Envoyé par le client (`page.tsx:341-363`) | Attendu par l'EF (`index.ts:94-95`) | Résultat |
|---|---|---|
| `p_plan` | `plan` | absent → `"standard"` par défaut |
| `p_essai_duree` (`"15"`) | `trialDays` | absent → 14 |
| `p_manager_name` | `managerName` | absent → `""` |
| `p_manager_email` | `managerEmail` | absent → `""` |
| `p_manager_phone` | `managerPhone` | absent → `null` |
| `p_manager_login_id` | — | ignoré |
| `p_manager_password` | — | ignoré |
| `p_professional_id` | — | ignoré |
| `p_abonnement_duree`, dates, `p_modules` | — | ignorés |
| `sendEmail`, `sendWhatsApp` | — | ignorés |

Validation serveur (`index.ts:113-114`) :
```
if (!mgrName || mgrName.length < 2) errors.push("Le nom du Manager est obligatoire.");
if (!mgrEmail || !EMAIL_REGEX.test(mgrEmail)) errors.push("Email du Manager invalide.");
```
→ **Tout clic sur « Créer l'abonné » retourne HTTP 400**, quelle que soit la saisie. Aucun compte Manager ne peut être créé depuis ce formulaire en l'état.

**Complément** : `admin.auth.admin.inviteUserByEmail` dépend du SMTP Supabase. Aucune preuve de configuration SMTP n'a été produite ; ce point reste **non vérifié**.

---

### Q5 — Association établissement / abonnement / permissions

**Fonctionne (côté RPC, si appelée correctement) :**
- `supabase/migrations/0028_…sql` : `admin_onboard_tenant` insère `establishments`, `subscriptions`, `profiles` (rôle `manager`, `establishment_id`), `audit_log`, `onboarding_requests`.
- RPC réellement présente en distant (signature vérifiée) :
  `admin_onboard_tenant(p_company_name text, p_slug text, p_city text, p_phone text, p_email text, p_plan text, p_manager_user_id uuid, p_manager_name text, p_manager_phone text, p_trial_days integer, p_request_id text)`.

**Ne fonctionne pas :**
1. **Modules/permissions** : le paramètre `p_modules` du formulaire n'est jamais transmis à la RPC ; `admin_onboard_tenant` n'écrit **jamais** dans `public.permissions`. La table `permissions` contient **0 ligne**. Les cases cochées à l'étape 4 sont **purement décoratives**.
2. **Droits réels** : `my_features()` (vérifié en base) dérive les fonctionnalités **du forfait** :
   ```sql
   join public.plan_features pf on pf.plan_code = e.plan
   ```
   → la sélection individuelle de modules n'a aucun effet.
3. **Durée d'abonnement ignorée** : la RPC fixe `current_period_end = now() + interval '1 year'` (ou la fin d'essai). Les durées 1/3/6 mois, 2 ans et personnalisée ne sont **jamais** appliquées.
4. **Dates saisies ignorées** : `dateDebut`/`dateFin` sont envoyées mais l'EF ne les lit pas ; la RPC calcule à partir de `now()`.
5. **Incohérence de bornes** : l'UI autorise un essai personnalisé jusqu'à **365 jours** ; l'EF et la RPC refusent au-delà de **90**.
6. `p_manager_password_confirm` et `legalName`, `activityType`, `address`, `region`, `notes`, `discount` ne sont jamais persistés (non lus par l'EF).

---

### Q6 — Envoi e-mail / WhatsApp : préparation locale uniquement

- `src/lib/invitation.ts:186-201` (`EmailInvitationProvider`) : si `configured === true`, retourne `{ status: "sent_requested" }` **sans aucun appel réseau**. Sinon `sent_failed` avec un message d'absence de clé.
- `:216-231` (`WhatsAppInvitationProvider`) : **exactement le même schéma factice**.
- Aucun `fetch`, aucun SDK fournisseur, aucun secret, aucune Edge Function d'envoi dans `supabase/functions/` (seul `onboard-tenant` existe).
- `src/app/super-admin/whatsapp/page.tsx:38-45` déclare explicitement : « Aucun token, webhook ou compte WhatsApp Business Platform (Meta) n'est connecté […] aucun message n'a été envoyé. »
- Le seul canal réel potentiel est l'e-mail d'invitation **Supabase Auth** (`inviteUserByEmail`), non testé et non prouvé (SMTP inconnu).
- **Aucune double transmission n'est codée** dans le parcours d'onboarding : `sendEmail`/`sendWhatsApp` (`page.tsx:137-138, 682-695`) ne sont lus par personne côté serveur.

---

### Q7 — Indépendance des canaux : non implémentée

Il n'existe **qu'un seul chemin d'envoi** (`inviteUserByEmail`). Aucune structure de type « tentative canal A / tentative canal B / agrégation » n'existe. Les adaptateurs factices seraient indépendants *s'ils étaient appelés*, mais ils ne le sont pas. La case WhatsApp cochée n'a **aucun effet**.

---

### Q8 — Statuts : aucune correspondance avec un fournisseur

- En distant : `invitations` et `invitation_events` **n'existent pas** (vérifié via `information_schema.tables`). La migration `0036` n'est **pas appliquée**.
- `src/components/super-admin-invitations-list.tsx:55-61` déclare un état `events` **jamais alimenté** : aucune requête sur `invitation_events`. Le tableau n'affiche que `invitations.status`.
- Aucun webhook entrant, aucun callback de statut, aucun `provider_ref` réel.
- Le seul statut réel disponible est la réponse HTTP de l'EF (`ok`/`error`), affichée en notification, **pas** comme statut de livraison.

**Conséquence** : « envoyé », « délivré », « lu » ne peuvent pas être distingués. L'UI ne prétend d'ailleurs pas le contraire, mais elle ne fournit pas non plus le suivi par canal demandé.

---

### Q9 — Activation et connexion du Manager : cassées

1. **Lien d'activation erroné** :
   - `src/lib/invitation.ts:73` → `` `${cleanBase}/actiter?token=…` ``
   - La route réelle est `src/app/activer/` → **404** sur chaque lien envoyé.
   - Le test unitaire **verrouille le bug** : `scripts/test-invitations.mjs:168,173` attend `/actiter`.
2. **Jeton consommé au chargement** : `src/app/activer/page.tsx:66-72` appelle `admin_accept_invitation` dès l'ouverture, ce qui passe l'invitation à `acceptee` (`0036:…` update) **avant** que le Manager ait défini son mot de passe. Un simple rafraîchissement invalide le lien.
3. **Conflit de création de compte** : `activer/page.tsx:117-127` fait `supabase.auth.signUp({ email, password })`. Or l'Edge Function a déjà créé l'utilisateur via `inviteUserByEmail` → `signUp` échoue (« User already registered »).
4. **RPC absentes en distant** : `admin_invite_manager`, `admin_accept_invitation`, `gen_invitation_token` **ne figurent pas** dans `pg_proc`. `admin_accept_invitation` est en outre accordée à `anon` dans 0036 et reçoit un `p_password_hash` qu'elle **ignore totalement**.
5. **Aucun compte de test** n'existe → scénario non exécutable.

---

### Q10 — Isolation multi-tenant : structurellement présente, non prouvée

**Éléments favorables :**
- **Toutes** les tables du schéma `public` ont `relrowsecurity = true` (requête : 0 table sans RLS).
- Policies vérifiées :
  - `establishments` : `own_establishment (id = current_establishment_id())`, `tenant_isolation (SELECT)`, `saas_admin_full_access`.
  - `sales` : `tenant_isolation (establishment_id = current_establishment_id())`.
  - `permissions` : `tenant_isolation (establishment_id = current_establishment_id())`.
  - `profiles` : `profiles_self_or_same_establishment`.
- `current_establishment_id()` lit `profiles.establishment_id` pour `auth.uid()` (`SECURITY DEFINER`, `search_path=public`).

**Réserves :**
- `relforcerowsecurity = false` sur `establishments`, `profiles`, `subscriptions`, `permissions` (les policies ne s'appliquent pas au propriétaire `postgres`).
- `is_manager()` n'est **pas** `SECURITY DEFINER` et n'a **pas** de `search_path` (anomalie A3 de 0037, toujours ouverte).
- **14 fonctions `SECURITY DEFINER` restent exécutables par `PUBLIC`** (vérifié) : `admin_change_plan`, `admin_create_establishment`, `admin_delete_client_account`, `admin_expire_subscription`, `admin_reactivate_subscription`, `admin_renew_subscription`, `admin_save_plan`, `admin_set_establishment_status`, `admin_set_feature`, `autoplus_current_role`, `current_establishment_id`, `decrement_product_stock`, `is_saas_admin`, `my_features`, `open_ticket_count`.
  `is_saas_admin()` et `current_establishment_id()` exposées à `PUBLIC` sont particulièrement sensibles.
- **Aucune preuve d'isolation réelle** : aucun compte Manager n'existe, donc aucun test « Manager A ne voit pas les données de B » n'a été exécuté.

---

### Q11 — WhatsApp Business / Chatbot IA

- `src/components/super-admin-shell.tsx:76` : entrée « Intégrations & API » → `/super-admin/whatsapp/`. Libellé ≠ « WhatsApp Business », mais la page est atteignable.
- `src/app/super-admin/whatsapp/page.tsx:10-13,38-45` : déclare l'intégration **non opérationnelle**. Elle affiche des droits par forfait réels et une feuille de route.
- `src/app/super-admin/chatbot/page.tsx` existe mais **n'est référencée nulle part** : `grep -rn "super-admin/chatbot" src --include=*.tsx` → **0 résultat**. Le module est **inaccessible** depuis la barre latérale.
- Cette page déclare elle aussi le chatbot **non opérationnel** (aucun fournisseur IA connecté).
- `super-admin/invitations/page.tsx` est dans le même cas : présente mais absente de `NAV_ITEMS`.

---

### Q12 — Réconciliation des tests

**Mesures réelles (exécutées le 17/11/2026) :**

```
npm test  →  ℹ tests 57   ℹ pass 57   ℹ fail 0
```

Détail par fichier :

| Fichier | Déclaré par `node --test` | Assertions réelles |
|---|---|---|
| `test-crm-csv.mjs` | 10 | 10 |
| `test-onboarding.mjs` | **28** | **28** |
| `test-csv-export.mjs` | 5 | 5 |
| `test-crm.mjs` | 4 | 4 |
| `test-pre-purchase.mjs` | 8 | 8 |
| `test-invitations.mjs` | 1 (runner maison) | **26** |
| `test-employes.mjs` | 1 (runner maison) | **15** |
| **Total** | **57** | **96** |

**Pourquoi 57 et non 96** : `test-invitations.mjs` et `test-employes.mjs` n'utilisent pas `node:test` mais un compteur maison (`let passed/failed`, `console.log`, `process.exit`). `node --test` ne voit qu'un « test » par fichier. Les deux runners sortent bien en code 1 en cas d'échec, donc `npm test` reste bloquant.

**Réconciliation des chiffres du rapport §49 :**

| Affirmation §49 | Réalité | Verdict |
|---|---|---|
| « 47/47 » | 57 déclarés / 96 assertions | **faux** |
| « 15 nouveaux tests » | **10** nouveaux dans `test-onboarding.mjs` (lignes 151→201) | **faux** |
| « 10 tests ajoutés » (récapitulatif) | 10 | **exact** |
| « 46/46 » (rapport précédent) | 57 | obsolète |

`test-onboarding.mjs` comptait 18 tests avant l'ajout ; il en compte 28 (18 + 10). Le chiffre « 47 » ne correspond à aucune mesure.

**Tests manquants (aucun test ne couvre) :** contrat client↔EF, génération du lien d'activation, persistance de `professional_id`, unicité, création Auth, association profil/établissement, non-régression du typo `/actiter`, changement obligatoire de mot de passe, indépendance des canaux, statuts fournisseurs.

---

## 3. Défauts identifiés, classés

### P0 — bloquants fonctionnels
| # | Défaut | Fichier | Preuve |
|---|---|---|---|
| P0-1 | Contrat de body formulaire ↔ Edge Function incompatible → 400 systématique | `onboarding/page.tsx:341-363` vs `functions/onboard-tenant/index.ts:94-95` | clés `p_*` vs `plan/trialDays/managerName/...` |
| P0-2 | `professional_id` non persisté, aucune unicité | base distante | 16 colonnes, 2 index (`pkey`, `slug`) |
| P0-3 | Mot de passe du SA jamais utilisé ; aucun changement forcé | `index.ts:150` | `inviteUserByEmail` sans mot de passe |
| P0-4 | Lien d'activation `/actiter` (route réelle `/activer`) | `invitation.ts:73` | test verrouille le typo `test-invitations.mjs:168` |
| P0-5 | Modules sélectionnés jamais enregistrés | `0028` / `permissions` | `p_modules` non lu ; table vide |
| P0-6 | Aucun envoi WhatsApp ; e-mail applicatif factice | `invitation.ts:186-231` | retours sans réseau |
| P0-7 | Moteur d'invitation (0036) non appliqué | base distante | `invitations`/`invitation_events` absentes ; 3 RPC absentes |

### P1 — sécurité / cohérence
| # | Défaut | Fichier |
|---|---|---|
| P1-1 | Validation des nouveaux champs non branchée (mots de passe non comparés) | `onboarding/page.tsx:187-201` |
| P1-2 | Jeton consommé à l'ouverture de `/activer`, avant choix du mot de passe | `activer/page.tsx:66-72` |
| P1-3 | `signUp` sur un compte déjà invité → échec garanti | `activer/page.tsx:117-127` |
| P1-4 | `admin_accept_invitation` accordée à `anon`, `p_password_hash` ignoré | `0036` |
| P1-5 | 14 fonctions `SECURITY DEFINER` exécutables par `PUBLIC` | base distante |
| P1-6 | `is_manager()` sans `SECURITY DEFINER` ni `search_path` | base distante |
| P1-7 | `FORCE ROW LEVEL SECURITY` désactivé | base distante |

### P2 — qualité / traçabilité
| # | Défaut |
|---|---|
| P2-1 | `0036` se termine par la ligne parasite `SQL\n")` → erreur de syntaxe à l'application |
| P2-2 | `admin_invite_manager` ne crée ni profil, ni employé, ni permissions (contrairement à son commentaire) |
| P2-3 | « Renvoyer » appelle `admin_invite_manager` avec `company_name=""` et `slug=""` → établissement fantôme ou échec |
| P2-4 | `/super-admin/invitations/` et `/super-admin/chatbot/` absents de la navigation |
| P2-5 | État `events` mort dans `super-admin-invitations-list.tsx` |
| P2-6 | Bornes d'essai incohérentes : UI 365 j, serveur 90 j |
| P2-7 | `p_manager_password_confirm` transmis au serveur (inutile) |
| P2-8 | Double attribut `disabled={enCours}` sur le bouton de soumission (`page.tsx:779`) |
| P2-9 | `lib/invitation.ts` est marquée `"use server"` mais exporte des classes/fonctions synchrones importées par un composant client |
| P2-10 | `on_auth_user_created` (migration 0006) **absent** en distant : aucun profil auto-créé pour les autres flux |

---

## 4. Dépendances des migrations 0027 → 0038 et état réel distant

**Historique de migrations distant** : `list_migrations` → `[]` (aucune migration enregistrée par l'outil). Les objets ont donc été créés hors du système de migrations. Ce constat est lui-même un risque de traçabilité.

| Migration | Objet | État distant constaté | Dépend de |
|---|---|---|---|
| 0027 | Managers / employés | `employees` **existe** → appliquée | 0001 (`establishments`, `profiles`) |
| 0028 | Onboarding + RPC | `onboarding_requests` + `admin_onboard_tenant`, `admin_find_onboarding_request`, `admin_find_user_id_by_email`, `admin_attach_manager`, `admin_tenant_integrity` **existent** → appliquée | 0001, 0007 (`is_saas_admin`), 0009 (`subscriptions`), `auth.users`, `audit_log` |
| 0029 | Extension CRM | `crm_leads`, `crm_events` **existent** → appliquée | 0018 |
| 0030 | Durcissement SA | partiellement vérifiable (fonctions `admin_*` présentes) | 0007, 0009 |
| 0031 | RLS profils admin | non vérifiable isolément | 0001, 0007 |
| 0033 | `pre_purchase_requests` | table **absente** → NON appliquée | — |
| 0034 | Durcissement RPC P0 | non prouvé | 0030 |
| 0035 | RPC pré-achat | **absente** → NON appliquée | 0033 |
| 0036 | Invitations manager | `invitations`/`invitation_events` **absentes**, `admin_invite_manager`/`admin_accept_invitation`/`gen_invitation_token` **absentes** → NON appliquée | **0028 (`onboarding_requests`)**, `plans`, `subscriptions`, `plan_features`, `is_saas_admin`, `is_manager`, `current_establishment_id`, extensions `pgcrypto` + `uuid-ossp` (présentes) |
| 0037 | Sécurité P0 | **NON appliquée** : `FORCE RLS=false`, 14 fonctions encore `PUBLIC` | 0007, 0030, `is_manager`, `current_establishment_id`, `autoplus_current_role`, `establishments`, `profiles`, `audit_log` |
| 0038 | RLS + 29 index | **NON appliquée** : aucun index `*_fk_idx` | 0037 (politiques), `audit_log`, `establishments`, `profiles`, ~20 tables à FK |

**Points d'attention avant toute opération distante :**
1. **0036 dépend de 0028** (`onboarding_requests`) et de `public.gen_random_bytes` (`pgcrypto`, présent) et `uuid_generate_v4` (`uuid-ossp`, présent).
2. **0036 est syntaxiquement invalide** (ligne finale `SQL\n")`) : elle échouera à l'application.
3. **0036 crée des objets que l'EF n'appelle pas** : l'EF actuelle appelle `admin_onboard_tenant`, pas `admin_invite_manager`. Appliquer 0036 seule ne rendrait pas le parcours fonctionnel.
4. **0037 révoque 16 fonctions** ; 14 sont réellement `PUBLIC` aujourd'hui, 2 (`admin_delete_client_account`, `get_my_profile`) ont des grants explicites. Les 16 `revoke` sont donc valides (les fonctions existent).
5. **0038 suppose les politiques de 0037** ; l'appliquer avant 0037 laisserait des policies redondantes.
6. Ordre sûr : **0036 (après correction syntaxique) → 0037 → 0038**, après sauvegarde/PITR vérifiée, et après avoir aligné le code applicatif sur les objets créés.

---

## 5. Ce qui n'a pas pu être vérifié (et pourquoi)

| Élément | Raison |
|---|---|
| Création réelle d'un compte Manager | Aucun appel réel autorisé ; contrat de body invalide |
| Délivrabilité e-mail (SMTP Supabase) | Configuration SMTP non exposée par les outils disponibles |
| Envoi WhatsApp | Aucun fournisseur configuré, aucun secret, aucun code d'appel |
| Connexion Manager + isolation effective | Aucun compte de test, aucun parcours exécutable |
| Tests E2E Playwright | Crash navigateur `SIGTRAP` déjà constaté |
| Statuts « délivré / lu » | Aucun webhook fournisseur, tables absentes |
| Application des migrations | Gel P0 : sauvegarde/PITR + autorisation explicite requises |

---

## 6. Recommandations (aucune exécutée)

1. **Aligner le contrat** formulaire ↔ EF avant tout déploiement : soit le client envoie `plan/trialDays/managerName/managerEmail/managerPhone`, soit l'EF accepte les clés `p_*`. Aujourd'hui le parcours échoue à 100 %.
2. **Décider de l'architecture du mot de passe** : Supabase Auth ne permet pas de « forcer » un mot de passe temporaire sans mécanisme applicatif. Deux options réalistes :
   - (A) invitation Supabase + mot de passe choisi par le Manager (supprimer les champs mot de passe du formulaire SA) ;
   - (B) `admin.createUser` avec mot de passe + colonne `password_change_required` + garde de redirection à la première connexion, et suppression du mot de passe après usage.
3. **Créer la colonne `professional_id`** + `UNIQUE` (ou index unique partiel) + contrôle de doublon en temps réel et serveur.
4. **Persister les modules** dans `permissions` (établissement + rôle + module), et faire lire ces droits par le shell au lieu de `my_features()` seul.
5. **Corriger `/actiter` → `/activer`** et le test associé.
6. **Séparer validation et consommation du jeton** dans `/activer`.
7. **Écrire un vrai service d'envoi** (Edge Function e-mail + WhatsApp) avec statuts par canal et journal `invitation_events`.
8. **Corriger `0036`** (ligne finale, profil/employé/permissions, renvoi idempotent) avant toute application.
9. **Écrire les tests manquants** (contrat, typo, persistance, non-régression) et **corriger la communication** sur les chiffres (57/96, pas 47).
10. **Ne pas déclarer la mission terminée** : 8 des 12 exigences sont non fonctionnelles.

---

## 7. Verdict final

| Dimension | Verdict |
|---|---|
| Formulaire (UI) | Avancé, mais validation partiellement non branchée |
| Persistance de l'identité | **Absente** |
| Authentification Manager | **Non fonctionnelle** |
| Création serveur | Codée, **inatteignable** par le formulaire |
| Permissions / modules | **Non persistés** |
| Double transmission | **Non implémentée** |
| Suivi des statuts | **Non implémenté** |
| Isolation tenant | Structurellement présente, **non prouvée**, durcissement en attente |
| Tests | 57 déclarés / 96 assertions, **couverture du parcours réelle = 0** |

**Statut global : NON CONFORME — ne pas déployer en l'état.**

---

## Annexe A — Corrections apportées par le GV5 §51 (17 novembre 2026)

> Cette annexe ne réécrit pas l'audit : elle documente ce qui a été corrigé **localement**.
> Aucune migration, aucun déploiement, aucune création de compte, aucun envoi réel.
> Le rapport complet des corrections est `docs/audits/GV5_51_RAPPORT_FINAL_ONBOARDING_IDENTITES.md`.

### A.1 Correspondance point audité → correction

| # §50 | Défaut constaté | Correction locale §51 | Statut |
|---|---|---|---|
| 1 | `professional_id` absent, aucune unicité | Colonne + index unique partiel `upper(professional_id)` (0039), génération et contrôle en temps réel | Code prêt / base non appliquée |
| 2 | Aucun `login_id`, aucun mapping login→e-mail | Colonne `profiles.login_id` + index unique + RPC `resolve_login_email()` ; page connexion accepte e-mail **ou** identifiant | Code prêt / non vérifié en réel |
| 3 | Mot de passe initial jamais utilisé, pas de rotation | `admin.createUser` (service_role) + `must_change_password` + RLS restrictive + preuve `auth.users.updated_at` + page `/changer-mot-de-passe/` | Code prêt / non vérifié en réel |
| 4 | Contrat formulaire ↔ EF incompatible (400 garanti) | Contrat v2 unique typé, validé client **et** serveur, clés inconnues refusées | Corrigé (tests unitaires) |
| 5 | Modules/permissions non persistés | `p_permissions` écrit dans `public.permissions` ; `my_features()`/`has_feature()` = forfait ∩ permissions | Code prêt / base non appliquée |
| 6 | Adaptateurs factices, aucun envoi | Adaptateurs Resend / Meta WhatsApp réels, isolés, statuts fournisseurs | Simulé uniquement (aucun secret) |
| 7 | Un seul chemin `inviteUserByEmail` | Canaux indépendants (`email`, `whatsapp`), échec isolé par canal | Corrigé (tests simulés) |
| 8 | Statuts non persistés | `invitations.email_status` / `whatsapp_status` + `invitation_events` + relance | Code prêt / base non appliquée |
| 9 | `/actiter`, jeton consommé trop tôt, `signUp` | `/activer/`, preview sans consommation, `updateUserById`, usage unique, test anti-régression | Corrigé (tests unitaires) |
| 10 | 14 fonctions `SECURITY DEFINER` EXECUTE PUBLIC | 0037 : révocations PUBLIC + grants ciblés ; `FORCE RLS` retiré (casserait les RPC) | Migration prête / non appliquée |
| 11 | WhatsApp/Chatbot décoratifs | Pages honnêtes + centre de suivi réel + rubriques de navigation | Corrigé (UI réelle) |
| 12 | Chiffres de tests faux | `npm test` = **138 tests / 138 pass / 0 fail** ; 81 tests dédiés §51 | Corrigé et mesuré |

### A.2 Défauts supplémentaires corrigés

- **0036 syntaxiquement invalide** (`SQL\n")` en fin de fichier) : fichier réécrit, blocs `$$` équilibrés (16 délimiteurs), test statique ajouté.
- **Jeton stocké en clair** : seul `token_hash` SHA-256 est conservé ; le jeton brut ne part que vers le fournisseur.
- **`FORCE ROW LEVEL SECURITY` de 0037** : supprimé. Il aurait soumis les RPC `SECURITY DEFINER` aux politiques des tables lues, avec risque de récursion et de rupture de `is_saas_admin()`.
- **Relance prématurée** : `admin_prepare_resend` ne marque plus l'invitation « sent » avant la réponse fournisseur ; seuls les canaux repassent `en_attente`, et un statut expiré/échoué est réarmé en `prepared`.
- **Relation canal/statut globale** : la promotion vers `sent` exige désormais un statut terminal sur **au moins un** canal (au lieu d'une condition ET qui laissait la ligne en `prepared`).
- **Unicité e-mail** : `admin_onboard_tenant_v2` vérifie que le compte Auth fourni correspond exactement à l'e-mail Manager, et refuse tout autre compte.
- **Dossier abonné** : la page Entreprises affiche `professional_id` et l'identité Manager (`login_id`), avec repli lisible si 0039 n'est pas appliquée.

### A.3 Ce que l'annexe ne prouve pas

- L'application réelle des migrations 0036 → 0037 → 0038 → 0039.
- La création réelle d'un compte Manager et l'isolation RLS effective.
- L'envoi réel d'un e-mail ou d'un message WhatsApp.
- Le changement réel de mot de passe et la connexion par identifiant.

Ces points restent **NON VÉRIFIÉS** faute d'autorisation et de secrets fournisseurs (voir §51).

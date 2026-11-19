# GV5 §53 — Rapport de rattrapage global, sécurisation et finalisation technique

**Date** : 17 novembre 2026  
**Mission** : rattrapage, sécurisation et finalisation technique (suite GV5 §50/§51/§52)  
**Checkout principal** : `/Users/hind/Documents/Default Project/auto-plus` — branche `main` @ `64359da9abd97203219517175fe6ab6a7652ab20`  
**Worktree sécurité (conservé)** : `/Users/hind/Documents/Default Project/auto-plus-next-security` — branche `security/next-16.4.6` @ `64359da`  
**Sauvegarde locale des états (avant modifications §53)** : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv553-backup-20261117-113518` (`main` et `worktree` : diffs suivis + archives des non-suivis)

**Règles respectées** : aucun `git reset --hard`, aucun `git clean`, aucun écrasement global, aucune suppression de migration/donnée, aucun commit/push, aucune opération distante Supabase (pas de migration, pas de déploiement d’Edge Function, pas de modification de données, pas de compte réel, pas d’envoi réel).

---

## 1. État initial réel (Phase 0)

| Élément | Checkout principal | Worktree sécurité |
|---|---|---|
| Branche / commit | `main` @ `64359da` | `security/next-16.4.6` @ `64359da` (0 commit en avance) |
| Entrées de travail (avant §53) | **40** | **39** |
| `next` / `eslint-config-next` (installés) | 16.4.3 / 16.4.3 | 16.4.6 / 16.4.6 |
| `xlsx` (installé) | 0.18.5 (npm, vulnérable) | 0.18.5 (état hérité) |
| `react` / `react-dom` | 19.3.0 / 19.3.0 | 19.3.0 / 19.3.0 |
| Node / npm | v26.13.0 / 11.20.0 | v26.13.0 / 11.20.0 |
| `package-lock.json` modifié | non (suivi, 16.4.3) | oui (16.4.6) |

**Comparaison des 40 entrées du principal vs worktree**
- **Uniquement dans le principal (2)** : `opencode.json.bak`, `opencode.json.save` (fichiers locaux préexistants, hors périmètre).
- **Uniquement dans le worktree (1 entrée de statut)** : `package-lock.json` modifié (upgrade sécurité) ; le worktree contenait aussi §52 (`GV5_52_AUDIT_CLOTURE_NEXT_SECURITY.md`, entrée §52 dans le suivi).
- **Communs (37 entrées)** : ensemble des corrections GV5 §51 (fichiers suivis modifiés + non-suivis : contrats, Edge Functions, migrations 0036-0039 préparées, pages `/activer`, `/changer-mot-de-passe`, onboarding/identités/permissions, scripts de tests §51, docs §50/§51).

**Présence des livrables** : corrections GV5 §51 présentes dans les deux environnements ; livrables GV5 §52 présents dans le worktree, absents du principal avant intégration documentaire (le présent rapport §53 couvre la clôture).

---

## 2. Travaux effectués (par phase)

### Phase 0 — Protection et état initial — **réalisée**
- Identification des deux environnements, branches/commits, statuts, diffs, versions.
- Sauvegarde locale des états de travail (diffs + non-suivis) avant modification.
- Inventaire et comparaison des 40 entrées du principal avec le worktree.

### Phase 1 — Intégration locale sécurisée de Next.js 16.4.6 — **CONFORME ET VÉRIFIÉ (local)**
- Diff `package.json` principal ↔ worktree : uniquement `next` et `eslint-config-next` 16.4.3 → 16.4.6 (aucune autre modification fonctionnelle/dépendance).
- Mise à jour `package.json` (deux entrées) puis installation ciblée (`next@16.4.6`, `eslint-config-next@16.4.6`) : `package-lock.json` aligné, paquets `@next/*` associés mis à jour.
- Corrections GV5 §51 du principal conservées ; worktree de sécurité conservé.
- Validations post-intégration : **tests 143/143 (exit 0), tsc (0), lint (0 erreur, 7 avertissements préexistants), build (0)**, export statique OK (`/activer`, `/changer-mot-de-passe`, `/super-admin/onboarding`).

### Phase 2 — Vulnérabilité HIGH `xlsx` — **CONFORME ET VÉRIFIÉ (dépendance + protections locales)**
- **Usages identifiés** : `src/components/excel-module.tsx` (export produits/clients/véhicules, import catalogue, import véhicules, modèles), `src/components/excel-module-backup.tsx` (export/import produits/clients), `src/components/reports-advanced-module.tsx` (export rapport multi-feuilles). `excel-module.tsx` est utilisé par `src/app/tableau-de-bord/import-export/page.tsx`.
- **Flux exposés (avant)** : parsing de fichiers non fiables côté navigateur (`XLSX.read`) sans limite de taille/volume ; exports générés depuis données applicatives de confiance.
- **Avis traités** : GHSA-4r6h-8v6p-xvw6 (Prototype Pollution, high) et GHSA-5pgg-2g8v-p4x9 (ReDoS, high) sur `xlsx` npm 0.18.5 (aucun correctif sur le registre npm).
- **Décision technique** : remplacement par la distribution maintenue SheetJS **0.20.3** (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, 0.20.3 ≥ correctifs 0.19.3/0.20.2), compatible API (`read`, `writeFile`, `utils.*`) — migration sans suppression de fonctionnalité.
- **Durcissement implémenté** : `src/lib/excel-safe.ts` (validation format `.xlsx/.xls/.csv`, refus fichier vide, **taille max 10 Mo**, **5 000 lignes max** avec troncature signalée dans le rapport d’import, lecture centralisée, export centralisé) ; composants import/export migrés vers `excel-safe`.
- **Tests de régression** : `scripts/test-excel-safe.mjs` (5 tests : extensions, refus vide/format/taille, limites, fichiers valides). Suite Node : **143/143**.
- **Audit** : `xlsx` high éliminé ; **0 vulnérabilité** npm restante après Phase 3.
- **Limite** : validation côté client/navigateur ; aucune exécution de contenu importé. Les flux d’import restent des entrées non fiables (validation/limites en place) — ne pas prétendre qu’un parseur tiers est exempt de tout risque futur ; surveillance des avis requise.

### Phase 3 — Vulnérabilités moderate du tooling — **CONFORME ET VÉRIFIÉ (local)**
- **Chaîne identifiée** : `typescript-eslint` 8.72.1 / `@typescript-eslint/*` 8.72.1 / `minimatch` 10.2.6 (transitif via `@typescript-eslint/typescript-estree`) — GHSA-g3hv-75wg-m249 (moderate).
- **Mise à jour minimale compatible** : `npm audit fix` (sans `--force`) + synchronisation `node_modules` ; montées semver acceptées par `eslint-config-next@16.4.6` (`typescript-eslint ^8.56.0`).
- **Résultat** : `typescript-eslint`/`@typescript-eslint/*` **8.73.0**, `minimatch` **11.0.9** (hors plage vulnérable).
- **Audit avant/après (outilage)** : 7 moderate → **0**. Audit global : **0**.
- **Validations** : ESLint/TypeScript/scripts/build OK (voir section 7). Aucun `npm audit fix --force`.

### Phase 4 — Finalisation fonctionnelle GV5 §51 — **PARTIEL / IMPLÉMENTÉ MAIS NON VÉRIFIÉ (réel)**

Audit réalisé sur le code, les Edge Functions, le contrat et les migrations préparées (sans exécution distante) :

| Point | Constats (preuves locales) | Statut |
|---|---|---|
| **A. Identités** | Contrat v2 (`_shared/contract.ts`, ré-export client) ; `professional_id`/`login_id` uniques (index 0039) ; RPC `admin_check_identity_available`, `resolve_login_email` (0039) ; connexion e-mail **ou** identifiant (`src/app/connexion/page.tsx`) ; liaison établissement/profil/Auth modélisée dans `admin_onboard_tenant_v2` | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** (base non migrée) |
| **B. Création Manager** | `onboard-tenant` : validation serveur, `auth.admin.createUser` (service_role), compensation `deleteUser` si RPC échoue, appel `admin_onboard_tenant_v2` (rôle manager, permissions, abonnement, invitation hachée) ; mot de passe temporaire non persisté côté métier | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** |
| **C. Activation** | `activate-manager` : `preview` via `admin_invitation_preview` (sans consommation), activation via `auth.admin.updateUserById` + `admin_accept_invitation` (preuve changement mot de passe), vérification `signInWithPassword` puis `signOut` ; **aucun `signUp`** ; route `/activer` | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** |
| **D. Double transmission** | Adaptateurs Resend/Meta (`_shared/providers.ts`), canaux indépendants, statuts par canal (`email_status`/`whatsapp_status`), historique `invitation_events`, relance idempotente (`send-invitation`, `admin_prepare_resend`), refus URL d’activation absente ; **aucun statut « délivré/lu » sans webhook** | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** (aucun secret/fournisseur réel) |
| **E. Permissions** | `modules` (forfait) distincts de `permissions` (actions) ; `my_features`/`has_feature` = intersection forfait ∩ permissions (0039) ; `can_view` appliqué au niveau module ; CRUD fin (`can_create/edit/delete`) **persisté/exposé mais non généralisé aux RLS métier** | **PARTIEL** |
| **F. Contrat Frontend/EF** | Source unique `supabase/functions/_shared/contract.ts`, validation stricte, clés inconnues refusées, idempotence (`requestId`, verrou consultatif/contrainte côté RPC) | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** |

**Vérifications rapides (locales)** : aucune occurrence `actiter` ni `auth.signUp` dans le code applicatif/fonctions ; aucun `console.log` de mot de passe temporaire détecté ; coordonnées Super Admin présentes (`me.achbni@gmail.com`, `+33772208885`).

### Phase 5 — Sécurité Supabase et migrations (audit préparatoire) — **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** (non appliquées)

**Migrations auditées** : `0036`, `0037`, `0038`, `0039` (`*_NOT_APPLIED.sql`).

| Contrôle | Constats |
|---|---|
| Dépendances / prérequis | 0036 : pré-contrôles `establishments`, `onboarding_requests`, `is_saas_admin`, `pgcrypto`. 0039 : pré-contrôles `invitations`, `onboarding_requests`, `permissions`, `is_saas_admin` ; commentaire d’ordre **0036 → 0037 → 0038 → 0039**. 0028 doit préexister (onboarding_requests). |
| `SECURITY DEFINER` / `search_path` | Fonctions sensibles en `SECURITY DEFINER` avec `set search_path` explicite (0036/0037/0039) ; `is_manager()` durci en 0037 (definer + search_path). |
| Privilèges EXECUTE | 0037 : révocation de 16 fonctions de `PUBLIC`, grants ciblés `authenticated` (helpers/admin). 0036/0039 : révocations + grants explicites (`resolve_login_email`/`admin_invitation_preview` exposés selon besoin d’activation, autres admin à rôles contrôlés). |
| RLS | RLS activée sur tables concernées ; **aucun `FORCE ROW LEVEL SECURITY`** appliqué (0037 documente la raison : éviter de casser les RPC definer/helpers). 0039 ajoute une politique **restrictive** `password_rotation_required` sur tables tenant (`establishment_id`) pour bloquer l’accès tant que `must_change_password` est vrai. |
| Secrets / jetons | 0036 : jeton brut non stocké (`token_hash` SHA-256), preview sans consommation, usage unique/expiration. |
| Index / contraintes | Unicités partielles `establishments(upper(professional_id))`, `profiles(lower(login_id))` (0039) ; `token_hash` unique (0036). |
| Risques / effets | Ordre et état réel distant incertains (`list_migrations` vide constaté précédemment, objets possiblement hors suivi) ; `FORCE RLS` volontairement exclu ; compatibilité avec RPC existantes à valider sur une base sauvegardée. |

**Plan d’application préparé (sans exécution — autorisation distincte requise)**  
1. **Pré-requis** : sauvegarde/PITR vérifiée et restaurable ; fenêtre de maintenance ; confirmation de l’état des migrations déjà présentes en base ; revue des privilèges `owner/service_role`.  
2. **Ordre proposé** : 0036 → 0037 → 0038 → 0039 (valider les dépendances réelles avant chaque étape).  
3. **Contrôles entre étapes** : compilation SQL, présence objets/policies/grants, tests de fumée RPC (`is_saas_admin`, invitation preview), absence de régression RLS.  
4. **Rollback** : restauration PITR/sauvegarde (préféré) ; sinon scripts de retour ciblés à préparer par objet (policies, fonctions, colonnes/index ajoutés) — à ne définir qu’après inspection de l’existant distant.  
5. **Aucune application distante effectuée.**

### Phase 6 — WhatsApp Business et Chatbot IA — **IMPLÉMENTÉ MAIS NON VÉRIFIÉ**
- **WhatsApp** (`src/app/super-admin/whatsapp/page.tsx`) : états honnêtes (aucun envoi confirmé sans réponse fournisseur, « non constatable ici » pour secrets Meta serveur), suivi des statuts réels d’invitations (`email_status`/`whatsapp_status`) si table disponible, prérequis listés, pas de simulation d’envoi.
- **Chatbot** (`src/app/super-admin/chatbot/page.tsx`) : déclaré non opérationnel (aucun fournisseur IA connecté), droits réels par forfait (`plan_features` ai/automation), plan d’activation.
- **Reste** : configuration/connexion réelle fournisseur, webhooks livraison, supervision centrale opérationnelle, isolation/quotas/coûts IA — **BLOQUÉ PAR DÉPENDANCE EXTERNE** / non configuré.

### Phase 7 — Tests automatisés et validation — **PARTIEL (fort en local, E2E/supabase réel non clos)**
- **Node tests** : **143 tests, 143 pass, 0 fail** (exit 0) — inclut contrats, activation, permissions, providers simulés, migrations/EF statiques, Excel sécurisé, CRM/onboarding/pré-achat/invitations/employés.
- **Build** : `npm run build` exit **0**, `✓ Compiled successfully`, export statique généré.
- **Lint** : exit **0**, 0 erreur, **7 avertissements** préexistants.
- **TypeScript** : exit **0**.
- **Playwright** : crash SIGTRAP **non reproduit** dans cet environnement (serveur statique `out/`, Chromium 1255). **34/34 tests pass** (smoke public, pré-achat public simulé, Super Admin simulé, onboarding/responsive). Correction du test « service pré-achat indisponible » pour mocker aussi `POST /rest/v1/rpc/submit_pre_purchase_request` (le catch-all 200 masquait le cas d’échec). Tests nécessitant comptes/fournisseurs/réel Supabase : **NON VÉRIFIÉS**.
- **Isolation multi-tenant/RLS réelle** : non exécutable sans base migrée et comptes réels.

### Phase 8 — Audit global AUTO DYALI — **PARTIEL**
- Périmètre revu de façon ciblée (sanity sécurité/contrat, modules import-export, WhatsApp/Chatbot, onboarding/auth, pages clés). Un audit exhaustif de tous les modules métier (finance, atelier, stock, CRM, support, etc.) avec preuves d’exécution réelle par module n’a pas été complété en une seule passe. Aucune modification de design arbitraire.

### Phase 9 — Exécution continue et rattrapage — **PARTIEL**
- Anomalies P0/P1 locales traitées dans ce périmètre : intégration sécurité Next.js, vulnérabilité `xlsx` high, vulnérabilités tooling moderate, durcissement import Excel, stabilisation e2e pré-achat. Anomalies P0/P1 dépendantes de Supabase distant/fournisseurs/comptes réels : non clôturables localement.

---

## 3. Fichiers modifiés / ajoutés (principaux, §53)

**Sécurité & dépendances**
- `package.json`, `package-lock.json` (Next 16.4.6, eslint-config-next 16.4.6, xlsx CDN 0.20.3, chaîne typescript-eslint/minimatch mise à jour via audit fix)

**Excel (sécurité + non-régression)**
- `src/lib/excel-safe.ts` (nouveau)
- `src/components/excel-module.tsx`, `src/components/excel-module-backup.tsx`, `src/components/reports-advanced-module.tsx`
- `scripts/test-excel-safe.mjs` (nouveau, intégré à `npm test`)

**Tests E2E**
- `tests/e2e/pre-achat.spec.ts` (mock RPC ajouté pour le scénario « service indisponible »)

**Documentation**
- `docs/audits/GV5_53_RAPPORT_RATTRAPAGE_GLOBAL.md` (ce rapport)
- `GV5_SUIVI_AUTO_DYALI.md` (entrée §53)

**Hérité / présent (GV5 §51, non recréé)** : contrat/EF/migrations 0036-0039/pages d’activation et onboarding/permissions, scripts de tests §51, rapports §50/§51 (voir état initial).

---

## 4. Vulnérabilités

| Élément | Avant §53 (principal) | Après §53 | Statut |
|---|---|---|---|
| `next` GHSA-mfr8-8qww-v76h (moderate) | présent (16.4.3) | **corrigé** (16.4.6) | **corrigé** |
| `xlsx` GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 (high) | présent (0.18.5) | **dépendance remplacée** (0.20.3 CDN) + limites/validation import | **corrigé (dépendance) / mitigé (flux import)** |
| `minimatch` GHSA-g3hv-75wg-m249 + chaîne `typescript-eslint` (moderate, dev) | présents | **corrigés** (minimatch 11.0.9, ts-eslint 8.73.0) | **corrigé** |
| **Total `npm audit`** | 9 (8 mod., 1 high) au départ du cycle sécurité | **0** | **corrigé** |

---

## 5. Tests, lint, build (codes de sortie)

| Commande | Résultat | Exit |
|---|---|---:|
| `npm test` | **143 tests, 143 pass, 0 fail** | **0** |
| `npx tsc --noEmit` | 0 erreur | **0** |
| `npm run lint` | 0 erreur, 7 avertissements préexistants | **0** |
| `npm run build` | Compilé, export statique généré | **0** |
| Playwright `npx playwright test` (statique `out/`, Chromium) | **34 pass, 0 fail** (SIGTRAP non reproduit) | **0** |

---

## 6. État des composants

| Composant | Statut | Note |
|---|---|---|
| Migrations 0036-0039 | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | Préparées, auditées localement, **non appliquées** (autorisation + sauvegarde/PITR requises) |
| Edge Functions (`onboard-tenant`, `activate-manager`, `send-invitation`) | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | Code/contrat alignés localement, **non déployées** |
| Intégration e-mail (Resend) | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | Adaptateur/statuts simulables ; **BLOQUÉ PAR DÉPENDANCE EXTERNE** (secrets/config) |
| Intégration WhatsApp (Meta) | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | Adaptateur/statuts/UI honnête ; **BLOQUÉ PAR DÉPENDANCE EXTERNE** (compte/secrets/template/webhook) |
| Chatbot IA | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** (squelette/droits) / **non opérationnel** | Aucun fournisseur connecté |
| Validation réelle Supabase | **BLOQUÉ PAR DÉPENDANCE EXTERNE** | Migrations non appliquées, pas de comptes/tests réels, pas d’envois réels |

---

## 7. Blocages externes (séparés)

1. Autorisation explicite + sauvegarde/PITR vérifiée pour appliquer 0036→0039.
2. Déploiement contrôlé des Edge Functions et configuration des secrets serveur.
3. Secrets/paramétrage Resend et Meta WhatsApp (+ template approuvé, webhooks livraison).
4. Création de comptes/établissements de test réels et validation E2E fonctionnelle sur Supabase.
5. Décision opérationnelle continue pour `xlsx` (surveillance amont) et, à terme, audit métier exhaustif de tous les modules.

---

## 8. Travaux restants (classés)

| Priorité | Travaux |
|---|---|
| **P0** | Appliquer les migrations en environnement contrôlé (après sauvegarde), valider RLS/isolation/rotation mot de passe/identités/rôles en réel ; corriger toute anomalie de sécurité révélée par l’exécution réelle. |
| **P1** | Déployer/paramétrer EF + Resend/Meta ; exécuter parcours réel complet (création Manager, invitation, activation `/activer`, login email+identifiant, changement mot de passe, permissions forfait∩droits, relance). Étendre le contrôle CRUD fin aux RLS métier (au-delà de `can_view`). |
| **P2** | Webhooks de livraison WhatsApp/e-mail, supervision réelle, activation Chatbot IA (clés serveur, isolation, quotas, coûts, journaux sans contenu sensible), durcissement continu des imports/fichiers. |
| **P3** | Réduction des 7 avertissements lint préexistants, audit UX/métier exhaustif module par module, performance et dette technique non bloquante. |

---

## 9. Recommandation de prochaine étape

1. **Valider l’intégration** des changements locaux §53 (notamment Next 16.4.6, `xlsx` 0.20.3 + `excel-safe`, mise à jour tooling) sur la base de ce rapport.  
2. **Obtenir l’autorisation distincte** pour : sauvegarde/PITR, application 0036→0039, déploiement EF, configuration secrets.  
3. **Exécuter un test réel bout-en-bout** en environnement de préproduction (Super Admin → création abonné → identités → invitation → activation → première connexion → rotation) puis valider l’isolation multi-tenant.  
4. **Clôturer** les statuts « IMPLÉMENTÉ MAIS NON VÉRIFIÉ » uniquement sur preuve d’exécution réelle.

---

## 10. Synthèse des statuts (demande)

- **CONFORME ET VÉRIFIÉ** : intégration Next.js 16.4.6 (local), remplacement/correction `xlsx` high + protections import (local), correction chaîne tooling moderate (local), suite Node 143/143, tsc/lint/build exit 0, e2e 34/34 en simulation statique, absence SIGTRAP reproduit dans l’environnement testé.
- **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** : contrat/identités/activation/double transmission/EF §51 (code), migrations 0036-0039 (préparées/auditées), modules WhatsApp/Chatbot (états honnêtes).
- **PARTIEL** : permissions (CRUD fin non généralisé aux RLS métier), validation fonctionnelle Supabase réelle, couverture métier globale.
- **ABSENT** : webhooks livraison réels, fournisseur IA opérationnel, preuves de production.
- **BLOQUÉ PAR DÉPENDANCE EXTERNE** : application migrations distantes, déploiement EF, secrets Resend/Meta, comptes/envois/tests réels, validation isolation réelle.

**AUTO DYALI reste un projet en cours jusqu’à validation finale explicite du propriétaire.**

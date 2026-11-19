# GV5 §75 — Rapport final : Super Admin TOP PREMIUM 3D & fiche abonné unifiée

**Date** : 18–19 novembre 2026. **Branche** `main` @ `64359da`. **Aucun commit, aucun push.**
**Cible des tests** : STAGING `yocufscgninxiihwiepa` (confirmée par `get_project_url`).
**Production `nxmsqqoflskfajqrqddw` : intacte** — aucune migration, aucun déploiement, aucune donnée modifiée.

> Légende des états : **[R]** réalisé localement · **[T-L]** testé localement · **[T-S]** testé sur staging · **[V-P]** vérifié sur production · **[NV]** non vérifié · **[B]** bloqué par configuration externe.

---

## 1. Architecture du nouveau Super Admin

### 1.1 Composants

| Composant | Rôle | État |
|---|---|---|
| `src/components/abonne-workspace.tsx` | **Nouvelle fiche unifiée** : 5 espaces, édition journalisée, KPI 3D, relance/révocation | [R][T-L][T-S] |
| `src/components/Champ3D`, `Zone3D`, `Section3D` (exportés du même fichier) | Primitives réutilisables de formulaire | [R][T-L] |
| `src/app/globals.css` — blocs `.sa3d-*` (57 règles) | Couche visuelle **additive et scopée** : pétrole, noir profond, vert foncé, or champagne ; profondeur par couches, reflets, ombres, halo ; aucun WebGL | [R][T-S] |
| `src/components/super-admin-actions-menu.tsx` | ComboBox « Actions » conservée (32 px = 8,5 mm) | Préservé [T-S] |
| `src/app/super-admin/entreprises/page.tsx` | Liste + ouverture de la fiche unifiée | [R][T-S] |
| `src/app/super-admin/onboarding/page.tsx` | Création 6 étapes — **restyle premium** (mêmes tokens `.sa3d-*`) | [R][T-S] |
| `src/components/abonne-detail-modal.tsx` | **Supprimé** après validation du remplacement (aucune référence restante) | [R][T-L] |

### 1.2 Flux de données

```
Liste /super-admin/entreprises/
  → ComboBox « Actions » → Consulter / Modifier
  → AbonneWorkspace
      → RPC admin_get_abonne_details (1 appel, données cohérentes)
      → Édition via RPC SECURITY DEFINER journalisées :
          admin_update_establishment / admin_update_manager /
          admin_set_subscription / admin_set_permissions /
          admin_set_establishment_status / admin_renew_subscription
      → Invitations : EF send-invitation v2 + admin_prepare_resend /
          admin_record_delivery / admin_revoke_invitation
```

**Aucune écriture directe `UPDATE` depuis le client** : contrairement à §74, toutes les modifications passent par une RPC avec contrôle `is_saas_admin()`, validation et `audit_log`. [T-S]

---

## 2. Captures du design final

Dossier `docs/audits/screenshots-75/` — **11 captures réelles**, navigateur Chromium headless, staging. [T-S]

| Fichier | Contenu |
|---|---|
| `01-fiche-etablissement-desktop.png` | Fiche 1440 px, KPI 3D, sections Identité / Coordonnées |
| `02-fiche-manager-desktop.png` | Espace Manager |
| `03-fiche-abonnement-desktop.png` | Espace Abonnement |
| `04-fiche-modules-desktop.png` | Modules & droits |
| `05-fiche-invitations-desktop.png` | Invitations & historique |
| `06-abonnement-enregistre.png` | Confirmation d'enregistrement |
| `07-invitation-statut-reel.png` | Statut `non_configure` (aucun envoi simulé) |
| `08-fiche-mobile-390.png`, `08-fiche-mobile-360.png` | Smartphone |
| `09-invitations-mobile-390.png`, `09-invitations-mobile-360.png` | Invitations mobile |

**Important** : un premier jeu de captures avait été produit avec un serveur de dev périmé (CSS `.sa3d-*` absent). Le cache `.next/dev` a été purgé et **toutes les captures ci-dessus ont été reprises** après recompilation. Le rendu final est bien le design premium attendu.

**Tablette 768 px** : [NV] — non capturée dans cette mission.

---

## 3. Description des cinq espaces

| Espace | Contenu réel | Modifiable | Persistance |
|---|---|---|---|
| **1. Établissement** | Identité (nom commercial*, raison sociale, ID pro, slug*, activité, statut), Coordonnées (téléphone, e-mail, adresse, ville, région, pays), Administratif (juridique, fiscal, état dossier, coordonnées complémentaires, infos administratives, notes internes) | Oui, après « Modifier l'établissement » | `admin_update_establishment` (18 paramètres, journalisé) |
| **2. Manager** | Nom, login, e-mail, téléphone, statut, activation, création, dernière activité, date de définition du mot de passe, lien vers relance | Oui | `admin_update_manager` —— **aucun mot de passe lu ni réécrit**, compte non recréé |
| **3. Abonnement** | Formule, date de début, durée payante (1/3/6/12/24 mois + personnalisée), essai (0/7/15/30/45/60 j + personnalisé), statut, fin d'essai, échéance, suspendre/réactiver, renouveler | Oui | `admin_set_subscription` (essai **indépendant**), `admin_set_establishment_status`, `admin_renew_subscription` |
| **4. Modules & droits** | Modules de la formule (lecture), permissions Manager CRUD | Oui | `admin_set_permissions` — **refuse tout module non prévu par la formule** (vérifié contre `plan_features`) |
| **5. Invitations & historique** | Choix WhatsApp / e-mail / les deux, invitations avec statuts indépendants, dates, erreurs, Envoyer/Renvoyer, Révoquer, 30 dernières entrées `audit_log` | Oui | EF `send-invitation` v2 + RPC dédiées |

**Validation** (espace 1) : nom et slug obligatoires, slug en minuscules/tirets, format e-mail, format téléphone, messages inline + toast. **Annulation restaure exactement les valeurs initiales** (snapshot). Indicateur d'enregistrement et toasts de succès/erreur.

---

## 4. Inventaire des anciens formulaires supprimés / remplacés

| Ancien élément | Décision | Ordre respecté |
|---|---|---|
| `src/components/abonne-detail-modal.tsx` (5 onglets, UPDATE direct, aucune validation) | **Supprimé** | Conception du remplacement → vérification → E2E 7/7 → non-régression → aucune référence restante → suppression |
| Deux systèmes disjoints (création 6 étapes / modification 5 onglets) | **Partiellement unifiés** : une seule fiche pour consulter+modifier, mêmes tokens visuels pour la création | Voir §11 « écart restant » |
| Ancienne EF `send-invitation` déployée (stub v1, clé `invitation_id`, incapable d'envoyer) | **Remplacée** par la v2 autonome déployée sur staging | Source locale → tests 13/13 → déploiement staging → test HTTP réel |

**Aucune donnée, table, historique, abonné ou compte Manager supprimé.** [T-S]

---

## 5. Champs et correspondances Supabase

### Colonnes existantes (vérifiées par `information_schema`)

`establishments` : `id, name, slug, address, city, phone, email, currency, timezone, plan, is_active, created_at, updated_at, trial_ends_at, suspended_at, logo_url, professional_id, legal_name, activity_type, region, notes, archived_at`.

### Colonnes ajoutées par la migration 002 (staging, réversible)

`country`, `legal_info`, `fiscal_info`, `admin_info`, `dossier_state`, `complementary_contacts` — **champs dédiés, plus de données structurées dans `notes`**. Pour les fiches historiques, la fiche reconstruit ces valeurs depuis les notes préfixées. [R][T-S]

### Autres tables

| Espace | Table / colonnes |
|---|---|
| Manager | `profiles` (`full_name`, `login_id`, `phone`, `is_active`, `must_change_password`, `password_changed_at`) + `auth.users.email` (e-mail) |
| Abonnement | `subscriptions` (`plan_code`, `status`, `started_at`, `trial_ends_at`, `current_period_end`) + `establishments.plan` |
| Modules | `plan_features` (`plan_code`, `feature_key`, `enabled`) |
| Droits | `permissions` (`establishment_id`, `role`, `module`, `can_view/create/edit/delete`) |
| Invitations | `invitations` (`token_hash`, `email_status`, `whatsapp_status`, `expires_at`, `last_request_id`, `last_error`, …) + `invitation_events` |
| Audit | `audit_log` (`action`, `entity`, `entity_id`, `payload_json`, `created_at`) |

---

## 6. Fonctionnement des invitations

**Parcours** : création → compte Auth Manager → identifiants générés → configuration abonnement/permissions → choix du canal → invitation → lien unique → Manager définit son mot de passe → activation → connexion.

**Sécurité vérifiée dans le code et sur staging** : [R][T-S]
- jeton 256 bits généré côté serveur, **hash SHA-256 uniquement stocké**, jeux de caractères hexadécimaux ;
- expiration 7 jours, usage unique via `admin_accept_invitation` ;
- idempotence par `requestId` (même requête → aucun nouvel envoi) ;
- statuts WhatsApp et e-mail **indépendants** (`email_status`, `whatsapp_status`) ;
- chaque résultat fournisseur enregistré via `admin_record_delivery` + `invitation_events` ;
- révocation sans suppression (`status = 'cancelled'`, lien expiré) ;
- **aucun mot de passe permanent envoyé ni affiché**.

**Comportement réel observé** : l'appel `send-invitation` renvoie HTTP 200 avec `{"status":"non_configure", "providerError":"Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM absents)"}`. L'interface affiche « Fournisseur non configuré ». **Aucun envoi simulé, aucun « envoyé » inventé.** [T-S]

**Bugs réels corrigés pendant la mission** [T-S] :
1. `admin_renew_subscription` appelé par l'interface mais **absent de staging** → RPC créée.
2. `admin_prepare_resend` appelé par l'EF mais **absent de staging** → RPC créée.
3. EF déployée v1 incompatible (`invitation_id`) → v2 autonome déployée.
4. `admin_prepare_resend` utilisait un statut `pending` refusé par la contrainte → `prepared`.
5. `invitation_events.event_type = 'resend_prepared'` refusé par la contrainte → `resent`.
6. **Faille sécurité** : le rôle `anon` avait `EXECUTE` sur les nouvelles RPC (grants Supabase par défaut) → révocation explicite ; test HTTP : **401 permission denied** au lieu de 200.

---

## 7. Résultats des tests

### Techniques (local) [T-L]

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 7 avertissements préexistants |
| `npm test` | **158/158** |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** |
| `npm run build` | **OK** |
| `npm audit --omit=dev` | **0 vulnérabilité** |

### Fonctionnels (staging, vraie interface) [T-S]

`tests/e2e/gv575-workspace.spec.ts` : **7/7** :
1. cinq espaces, 4 KPI 3D, champs préremplis + captures des 5 espaces ;
2. établissement : validation, annulation restaure, enregistrement journalisé ;
3. abonnement : durée payante et essai indépendants, échéance calculée ;
4. manager : prérempli sans recréation, annulation fiable ;
5. droits : enregistrement contrôlé par la formule ;
6. invitations : statut réel `non_configure`, aucune réclamation d'envoi ;
7. responsive 390 px et 360 px (captures).

### Non-régression [T-S]

`gv573-unified.spec.ts` (adapté aux nouveaux onglets) + `gv572-real-ui.spec.ts` + `gv572-activation.spec.ts` : **7/8** au premier passage (1 flake de `.check()`), **2/2** au re-run ciblé de la spec concernée → **acquis §72/§73 préservés**. Le menu « Actions » reste compact (32 px = 8,5 mm ≪ 25 mm).

### Sécurité [T-S]

- Appel anonyme à `admin_get_abonne_details` : **401 permission denied** (après correction).
- Contrôle `is_saas_admin()` présent dans toutes les RPC d'écriture (inspection SQL).
-(Appel authentifié avec un compte Manager non-admin : **[NV]** — identifiants de test indisponibles.)

---

## 8. Résultats des tests responsive [T-S]

| Résolution | Résultat |
|---|---|
| Ordinateur 1440 px | Fiche `max-w-5xl`, KPI 4 colonnes, grille 2 colonnes — captures 01–07 |
| Smartphone 390 px | KPI 2 colonnes, onglets en 2 lignes, champs 1 colonne — captures 08/09 |
| Smartphone 360 px | Identique, aucun débordement observé — captures 08/09 |
| Tablette 768 px | **[NV]** |
| Appareil physique | **[NV]** — émulation Chromium uniquement |

`prefers-reduced-motion` respecté (transitions et transformations désactivées). [R]

---

## 9. Migrations préparées / appliquées

| Fichier | Contenu | État |
|---|---|---|
| `supabase/security/remediation_075/001_workspace_rpcs.sql` | 8 RPC (édition établissement, manager, abonnement, renouvellement, permissions, relance, révocation, lecture groupée) + grants | **Appliquée sur staging** [T-S] |
| `.../001_down.sql` | Rollback (drop des 8 fonctions) | Préparé [R] |
| `.../002_admin_fields.sql` | 6 colonnes dédiées + RPC d'édition étendue | **Appliquée sur staging** [T-S] |
| `.../002_down.sql` | Rollback (drop colonnes) | Préparé [R] |
| `.../003_revoke_anon.sql` | Révocation `anon` (correctif sécurité) | **Appliquée sur staging** [T-S] |
| Correctifs inline `gv575_fix_prepare_resend_status`, `gv575_fix_event_types`, `gv575_revoke_anon_workspace_rpcs` | Appliqués sur staging, reflétés dans les fichiers ci-dessus | [T-S] |

**Aucune migration appliquée en production.** [V-P : aucune opération]

---

## 10. Blocages externes

| Blocage | Origine | Action nécessaire |
|---|---|---|
| Envoi e-mail réel | `RESEND_API_KEY` / `EMAIL_FROM` absents | Fournir les secrets dans l'environnement de l'EF puis re-tester |
| Envoi WhatsApp réel | `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `TEMPLATE_NAME`, `LANG`, `API_VERSION` absents | Idem + template Meta approuvé |
| Destinataire réel autorisé | Aucun fourni ; seuls des domaines synthétiques `.local` | Confirmer un destinataire de test et autoriser l'envoi |
| Déploiement production | Non autorisé par la mission | Autorisation explicite distincte + PITR vérifié |
| EF temporaire `create-test-user` sur staging | Créée lors des tests §66 | Retrait manuel à prévoir (aucun outil MCP de suppression utilisé) |
| Sécurité SQL 0037 | Non appliquée intégralement ; état exact des privilèges PUBLIC à re-vérifier | Audit de privilèges dédié |
| Appel non-admin authentifié | Compte Manager de test avec mot de passe connu indisponible | Fournir un compte de test ou réinitialiser via parcours autorisé |

---

## 11. Écart restant — transparence

La **consultation et la modification** sont désormais unifiées dans une seule fiche. La **création** reste le parcours §72 en 6 étapes : [R]

- Elle partage désormais le **même langage visuel** (tokens `.sa3d-*`, boutons, champs, panneaux) et les mêmes règles métier (contrat v2, unicité, permissions contrôlées par la formule).
- Les primitives React `Champ3D` / `Zone3D` / `Section3D` sont exportées et réutilisables, mais la page d'onboarding ne les consomme pas encore directement (elle utilise les classes CSS partagées).
- Les champs administratifs saisis à la création sont toujours composés dans `notes` par le contrat v2 historique ; la fiche les réhydrate dans les colonnes dédiées lors de la première modification.

**Recommandation** (non appliquée, hors budget de cette mission) : faire consommer les primitives React par l'onboarding et étendre le contrat v2/EF/RPC `admin_onboard_tenant_v2` pour écrire directement les 6 colonnes dédiées. Cela achèvera l'unification technique des trois modes.

---

## 12. État exact de Git et du déploiement

- Branche `main`, HEAD `64359da`, **aucun commit, aucun push**.
- Arbre de travail : 71 entrées modifiées/non suivies (les 70 préexistantes des missions §51–§74 + les livrables §75 ; l'ancienne modale a été retirée).
- `.env.local` **restauré vers la production** après chaque session de tests ; vérifié en fin de mission.
- `opencode.json` pointe toujours vers le staging ; production préservée.
- Staging : migrations appliquées, RPC créées/corrigées, EF `send-invitation` en **version 2**.
- Production : **aucune modification**.
- Données de production : **aucune modification**.

---

## Conclusion

Le Super Admin AUTO DYALI dispose désormais d'une **fiche abonné unique, premium 3D, fonctionnelle et journalisée** : cinq espaces, édition réelle du Manager, de l'abonnement et des droits, remise des accès par WhatsApp/e-mail/les deux avec statuts honnêtes, et suppression de l'ancien formulaire après validation. Les acquis §72/§73 sont préservés, les tests passent (158 unitaires, 13 Edge Function, 7 E2E §75, non-régression OK), et une faille de privilèges `anon` a été découverte puis corrigée sur staging.

**Ce qui n'est pas démontré** : envoi réel e-mail/WhatsApp ([B]), vérification en production ([NV]), tablette et appareil physique ([NV]), unification technique complète du parcours de création (§11).

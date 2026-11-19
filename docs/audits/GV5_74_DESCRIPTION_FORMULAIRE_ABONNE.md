# GV5 §74 — Description et évaluation du formulaire Super Admin « Abonné professionnel »

**Date** : 18 novembre 2026. **Périmètre** : inspection seule, aucun code modifié, aucune opération distante.

## 1. Description générale du formulaire

Le « formulaire » de gestion d'un abonné professionnel n'est **pas une page dédiée** : c'est une **fenêtre modale** (dialog) affichée par-dessus la liste `/super-admin/entreprises/`.

**Fichiers inspectés :**
- `src/app/super-admin/entreprises/page.tsx` (347 lignes) — liste, recherche, filtres, handlers d'actions, ouverture de la modale.
- `src/components/abonne-detail-modal.tsx` (207 lignes) — **la modale unifiée** (5 onglets + modification).
- `src/components/super-admin-actions-menu.tsx` (92 lignes) — ComboBox « Actions » compacte.
- `src/app/super-admin/onboarding/page.tsx` (1 027 lignes) — formulaire de **création** en 6 étapes (autre composant).
- `src/lib/onboarding-contract.ts` / `supabase/functions/_shared/contract.ts` — contrat de création.
- Schéma Supabase (SELECT sur `information_schema.columns`, table `establishments`) — correspondances DB.

**Composants React utilisés :** `ModulePage`, `ModuleHeader`, `AbonneActionsMenu`, `AbonneDetailModal`, `Link`, `useNotification`, `supabase` (client browser).

### Comment ouvrir le formulaire depuis la liste
1. L'administrateur ouvre `/super-admin/entreprises/` (sidebar « Abonnés professionnels »).
2. Chaque ligne possède une **ComboBox « Actions »** (`AbonneActionsMenu`, bouton `⋯ Actions`, hauteur 32 px).
3. Cliquer sur `Actions` ouvre un menu avec : Consulter, Modifier, Renouveler, Suspendre/Réactiver, Archiver/Restaurer.
4. **Consulter** et **Modifier** appellent `ouvrirFiche(row, "infos")` → `setSelection(row)` + `setOnglet("infos")` → la modale `AbonneDetailModal` s'affiche. Les deux actions ouvrent **la même modale**, seul le mode lecture/édition diffère (voir §4).

### Apparence générale
- Fond semi-transparent noir (`bg-black/70`), panneau central `max-w-3xl`, `max-h-[92vh]`, coins arrondis, ombre.
- En-tête : surtitre « FICHE ABONNÉ PROFESSIONNEL », nom de l'établissement en titre doré, sous-titre `professional_id ou slug · inscrit le ...`, bouton `×` de fermeture.
- Barre d'onglets horizontale (`nav`) avec 5 boutons ; onglet actif en vert sauge.
- Zone de contenu scrollable (`max-h-[62vh] overflow-y-auto`).
- Identité AUTO DYALI respectée (graphite, émeraude, champagne).

## 2. Description détaillée des cinq onglets

| Onglet (clé) | Rôle | Contenu réel |
|---|---|---|
| **Informations** (`infos`) | Consultation + **modification** des données établissement | Formulaire de 10 champs + `Notes`, en grille 2 colonnes. Bouton « Modifier les informations » bascule en mode édition ; champs préremplis ; « Annuler » / « Enregistrer ». |
| **Abonnement** (`abonnement`) | Consultation formule + changement | `<select>` Formule (standard/silver/gold), et 3 lectures seules : Statut, Fin essai, Échéance. Bouton lien « Gérer le cycle de vie » vers `/super-admin/abonnements/`. |
| **Manager** (`manager`) | Consultation du Manager rattaché | 3 lectures (Nom, Login, Statut) + lien « Gérer les accès » vers `/super-admin/managers/`. Si aucun Manager : « Aucun Manager associé. » |
| **Invitations** (`invitations`) | Historique des invitations | Liste des invitations (e-mail, statut global, statut e-mail, statut WhatsApp) lues depuis la table `invitations`. Lien « Ouvrir le centre d'invitations ». **Aucun bouton d'envoi/relance ici.** |
| **Historique** (`historique`) | Journal d'audit de l'établissement | Liste des 30 dernières entrées `audit_log` (action · entité · date). État vide : « Aucune opération journalisée. » |

## 3. Tableau complet des champs

### Onglet « Informations » (tous préremplis depuis la ligne `AbonneRow`)

| Champ (libellé) | Type | Préremplissage | Obligatoire | Modifiable | Colonne Supabase |
|---|---|---|---|---|---|
| Nom commercial | texte (input) | `abonne.name` |Non marqué `*` dans la modale | Oui (après clic Modifier) | `establishments.name` |
| Raison sociale | texte | `abonne.legal_name ?? ""` | Non | Oui | `establishments.legal_name` |
| Slug | texte | `abonne.slug` | Non marqué | Oui | `establishments.slug` |
| Activité | texte | `abonne.activity_type ?? ""` | Non | Oui | `establishments.activity_type` |
| Adresse | texte | `abonne.address ?? ""` | Non | Oui | `establishments.address` |
| Ville | texte | `abonne.city ?? ""` | Non | Oui | `establishments.city` |
| Région | texte | `abonne.region ?? ""` | Non | Oui | `establishments.region` |
| Téléphone | texte | `abonne.phone ?? ""` | Non | Oui | `establishments.phone` |
| E-mail | texte (pas `type=email`) | `abonne.email ?? ""` | Non | Oui | `establishments.email` |
| Notes | textarea | `abonne.notes ?? ""` | Non | Oui | `establishments.notes` |

### Onglet « Abonnement »

| Champ | Type | Valeur | Modifiable | Source |
|---|---|---|---|---|
| Formule | liste déroulante | `abonne.plan` (standard/silver/gold) | Oui (select toujours actif) | `establishments.plan` + RPC `admin_change_plan` |
| Statut | texte (lecture) | `sub.status` | Non | `subscriptions.status` |
| Fin essai | date formatée (lecture) | `sub.trial_ends_at` | Non | `subscriptions.trial_ends_at` |
| Échéance | date formatée (lecture) | `sub.current_period_end` | Non | `subscriptions.current_period_end` |

### Onglet « Manager » — lectures seules : `full_name`, `login_id`, `is_active` (table `profiles`, lignes filtrées `role === "manager"`).

### Onglet « Invitations » — lectures seules : `email`, `status`, `email_status`, `whatsapp_status` (table `invitations`).

### Onglet « Historique » — lectures seules : `action`, `entity`, `created_at` (table `audit_log`, limite 30).

**Correspondances DB vérifiées** (SELECT `information_schema.columns` sur `establishments`, staging) : `id, name, slug, address, city, phone, email, currency, timezone, plan, is_active, created_at, updated_at, trial_ends_at, suspended_at, logo_url, professional_id, legal_name, activity_type, region, notes, archived_at`. **Les champs `country`, `complementary_contacts`, `admin_info`, `dossier_state` du formulaire de création n'existent PAS en base** (ils sont compressés dans `notes` lors de la création).

## 4. Différences création / modification

| Aspect | Création (`/super-admin/onboarding/`) | Modification (modale `AbonneDetailModal`) |
|---|---|---|
| Structure | **6 étapes** : Entreprise → Manager → Formule → Modules & droits → Invitations → Récapitulatif | **1 fenêtre à 5 onglets** (pas de parcours guidé) |
| Champs | ~26 champs : établissement (15), Manager (8), abonnement/durée/essai, modules/permissions, canaux | 10 champs texte + notes, + select formule. **Ni Manager, ni modules, ni permissions, ni invitations modifiables ici** |
| Identifiants | Génération bouton « Générer » ID pro `ADY-PRO-XXXXXX` et login Manager | **Affichés en lecture seule**, non régénérés |
| Durée/essai | Sélecteurs durée payante (1/3/6/12/24 mois + personnalisée) et essai (aucun/7/15/30/45/60 + personnalisée) | **Absents** (seule la formule est modifiable) |
| Permissions | Cases à cocher CRUD réelles | **Non modifiables** dans la modale (lien vers `/super-admin/garages/` ? non — lien vers managers/abonnements) |
| Invitation | Canaux e-mail/WhatsApp cochés à la création | **Consultation seule** + lien vers le centre d'invitations |
| Sauvegarde | EF `onboard-tenant` (RPC v2 transactionnelle/idempotente) | `UPDATE establishments` direct + RPC `admin_change_plan` si formule changée |
| Validation | Contrat v2 strict (`validateOnboardingPayload`) + contrôle d'unicité RPC | **Aucune validation explicite** (pas de `required`, pas de contrat, pas de contrôle doublon) |
| Confirmation | Récapitulatif étape 6 | Aucune confirmation avant `Enregistrer` |

## 5. Description des boutons et actions

| Bouton | Emplacement | Fonctionnement réel |
|---|---|---|
| `⋯ Actions` | Chaque ligne | Ouvre le menu (hauteur fermée **32 px = 8,5 mm**, vérifié E2E §73). Menu en position absolu : n'agrandit pas la ligne. |
| Consulter / Modifier | Menu | Ouvre la même modale, onglet « Informations ». |
| Renouveler | Menu | `window.confirm` puis RPC `admin_renew_subscription` (12 mois), toast succès/erreur, rechargement liste. |
| Suspendre / Réactiver | Menu | `window.confirm` puis RPC `admin_set_establishment_status`, toast, rechargement. |
| Archiver / Restaurer | Menu | `window.confirm` puis RPC `admin_archive_establishment` (logique, `archived_at`), **journalisé** dans `audit_log`, toast, rechargement. |
| `×` | En-tête modale | Ferme la modale (`setSelection(null)`). |
| `Modifier les informations` | Onglet Infos | Passe `edit=true` → champs activés. |
| `Annuler` | Onglet Infos (mode édition) | Repasse `edit=false` (les modifications locales sont conservées dans l'état `form` mais non enregistrées). |
| `Enregistrer` | Onglet Infos (mode édition) | `UPDATE establishments` + RPC `admin_change_plan` si changement ; toast ; `onSaved()` recharge la liste. |
| `Gérer le cycle de vie` | Onglet Abonnement | Lien vers `/super-admin/abonnements/` (autre page). |
| `Gérer les accès` | Onglet Manager | Lien vers `/super-admin/managers/` (autre page). |
| `Ouvrir le centre d'invitations` | Onglet Invitations | Lien vers `/super-admin/invitations/` (autre page). |

**Actions NON présentes dans la modale** : envoyé e-mail, envoyé WhatsApp, relance d'invitation, modification Manager, modification modules/permissions, modification dates d'abonnement, changement statut. Ces fonctions existent **ailleurs** (pages dédiées ou menu Actions).

## 6. Enregistrement et validation

- **Enregistrement Infos** : `supabase.from("establishments").update({...}).eq("id", abonne.id)` — UPDATE direct, pas de RPC, pas de transaction explicite. Puis RPC conditionnelle `admin_change_plan`.
- **Chargement invitations/historique** : au montage de la modale, deux SELECT parallèles (`invitations`, `audit_log`) filtrés par `establishment_id`.
- **Validation** : **aucune validation de formulaire** dans la modale (ni `required`, ni types contraints, ni contrôle d'unicité slug, ni format e-mail). Le contrat v2 strict n'est utilisé **que** par le formulaire de création.
- **Messages d'erreur** : toast `Erreur modification` / `Erreur changement formule` avec le message brut Supabase. Succès : toast « Abonné mis à jour ».
- **Journalisation** : le UPDATE direct sur `establishments` n'écrit **pas** dans `audit_log` (contrairement aux RPC d'actions). Seules les actions via RPC (suspendre, archiver, changement de forfait) sont journalisées.

## 7. Présentation ordinateur / smartphone

- **Ordinateur** (captures §58 disponibles de la liste) : sidebar 11 sections, bandeau identité « 02 », barre recherche/filtres, tableau. La modale §73 (non capturée) est `max-w-3xl`, grille 2 colonnes (`sm:grid-cols-2`), `max-h-[92vh]`, contenu scrollable.
- **Smartphone 390 px** : grille passe en 1 colonne (classes `sm:`), onglets `flex-wrap`, ComboBox compacte vérifiée visible et 32 px (test E2E §73). **NON VÉRIFIÉ visuellement** pour la modale elle-même (aucune capture de la modale, navigateur indisponible dans cette mission).
- **Tablette 768 px** : NON VÉRIFIÉ pour la modale (capture §58 de la liste seulement).

## 8. Captures d'écran disponibles

| Capture | Contenu | Utilité pour ce rapport |
|---|---|---|
| `docs/audits/screenshots-58/02-abonnes-desktop-1440.png` | Liste des abonnés (vue §58, avant modale §73) | Contexte visuel de la liste |
| `docs/audits/screenshots-58/02-abonnes-desktop-1280.png` | Liste 1280 px | Contexte |
| `docs/audits/screenshots-58/02-abonnes-tablet-768.png` | Liste tablette | Contexte |
| `docs/audits/screenshots-58/02-abonnes-mobile-390.png` / `360.png` | Liste mobile | Contexte |
| **Aucune capture de la modale §73** | — | **NON VÉRIFIÉ visuellement** |

**Tests existants concernant ce formulaire :** `tests/e2e/gv573-unified.spec.ts` (4 tests : ComboBox compacte 32 px, menu au clic, fiche 5 onglets + champs préremplis, archiver/restaurer + mobile) — **4/4 pass** sur staging en §73. Ce test valide la **structure**, pas la qualité visuelle ni la validation des données.

## 9. Problèmes constatés

1. **Deux formulaires distincts non unifiés** : création = page 6 étapes (contrat v2 strict) ; modification = modale 5 onglets (UPDATE direct). Le §73 annonce « un seul espace » mais **deux systèmes coexistent** — la modale ne réutilise pas la structure du formulaire de création.
2. **Champs manquants en modification** : ni Manager, ni modules, ni permissions, ni durée/essai ne sont éditables dans la modale, alors que le cahier GV5 §73 les demandait « dans le même parcours organisé ».
3. **Aucune validation** en modification : pas de `required`, pas de contrôle d'unicité du slug, pas de format e-mail — risque de données incohérentes.
4. **Aucune journalisation** du UPDATE direct `establishments` (contrairement aux RPC d'actions) — l'historique affiché peut être incomplet pour les modifications d'infos.
5. **Boutons d'invitation absents de la fiche** : l'onglet Invitations est en lecture seule avec un lien vers une autre page ; pas d'envoi/relance e-mail ou WhatsApp depuis la fiche.
6. **Plan modifiable sans confirmation** : le `<select>` Formule est actif immédiatement (contrairement aux champs Infos qui nécessitent « Modifier »), et change le plan via RPC dès « Enregistrer » — comportement incohérent.
7. **`Annuler` ne restaure pas les valeurs** : il repasse en lecture seule sans réinitialiser `form` (les valeurs modifiées restent en mémoire et réapparaîtront si on re-clique « Modifier »).
8. **Champs création non persistés** : `country`, `complementary_contacts`, `admin_info`, `dossier_state` saisis à la création sont compressés dans `notes` et **ne réapparaissent pas** comme champs dédiés en modification (perte de structure).
9. **Aucune capture visuelle de la modale** → présentation réelle sur mobile/tablette **NON VÉRIFIÉ**.

## 10. Améliorations recommandées (non appliquées)

- Unifier création et modification dans **un seul composant** avec mode `create`/`edit`, en réutilisant les 8 sections demandées (Garage, Manager, Abonnement, Essai, Modules, Permissions, Invitations, Récapitulatif) avec sections repliables.
- Appliquer le **contrat v2** (`validateOnboardingPayload`) et le contrôle d'unicité (RPC `admin_check_identity_available`) aussi en modification.
- Remplacer le UPDATE direct par une **RPC journalisée** `admin_update_establishment` (audit automatique, cohérence).
- Ajouter dans la fiche des boutons **Envoyer e-mail / Envoyer WhatsApp / Relancer** branchés sur `send-invitation` (statuts honnêtes).
- Corriger `Annuler` pour réinitialiser `form` depuis `abonne`.
- Align le comportement du `<select>` Formule sur le mode édition (actif seulement après « Modifier » + confirmation).
- Ajouter des **captures E2E de la modale** (desktop/tablette/mobile) pour vérifier la présentation réelle.

## Conclusion — état réel du formulaire

Le formulaire actuel est une **modale compacte et professionnelle** (5 onglets, champs préremplis, ComboBox 8,5 mm, archivage journalisé) dont la **structure et quelques actions sont vérifiées** par 4 tests E2E sur staging. En revanche, la **refonte graphique complète n'est pas démontrée** : la création reste un formulaire séparé en 6 étapes, la modification n'offre ni les modules/permissions ni le Manager éditables, applique un UPDATE direct sans validation ni journalisation, et n'a jamais été capturée visuellement. **Présentation mobile de la modale : NON VÉRIFIÉ.** Aucune modification n'a été effectuée dans cette mission.

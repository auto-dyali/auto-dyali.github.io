# GV5 §56 — Inventaire & architecture cible (Super Admin uniquement)

**Date** : 17 novembre 2026  
**Dépôt** : `/Users/hind/Documents/Default Project/auto-plus` — branche `main`, HEAD `64359da` (travail local §51–§55 présent, non commité)  
**Supabase** : `nxmsqqoflskfajqrqddw` (aucune opération distante effectuée)  
**Sauvegarde §56** : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv556-backup-20261117-130844` (`tracked.diff` + `status.txt` + `untracked.tar`)

> Périmètre strict : portail **Super Admin** uniquement. Hors périmètre (interdit de reconstruire ici) : dashboard Manager, modules métier garages, POS, stock, fournisseurs, achats, employés opérationnels garage, espaces clients.

---

## Phase A — Audit de l’existant (protection)

### État Git / fichiers
- `git status --porcelain` : 56 entrées (31 modifiées, 25 non suivies) incluant apports §51–§55, rapports/audits, EF/migrations préparées, composants/lib/scripts/tests, et fichiers étrangers préservés (`opencode.json.bak`, `opencode.json.save`).
- Aucun `git reset --hard`, aucun `git clean`, aucune suppression globale, aucun écrasement des travaux antérieurs.

### Sauvegardes disponibles
- §53 : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv553-backup-20261117-113518`
- §54 : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv554-backup-20261117-120523`
- §55 : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv555-backup-20261117-123549`
- §56 : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv556-backup-20261117-130844`

### Cartographie — routes Super Admin (`src/app/super-admin/**/page.tsx`)
| Route canonique / page | Fichier | Conteneur/shell | Statut UI (observé) |
|---|---|---|---|
| `/super-admin/` (Vue générale) | `page.tsx` (673 L) | `SuperAdminShell` direct + garde | Dashboard KPIs, alertes, activité, santé, graphique, filtre temporel |
| `/super-admin/entreprises/` (Abonnés) | `entreprises/page.tsx` (282 L) | `ModulePage` | Liste/filtres/export, changement forfait, suspension/réactivation, **fiche modale** (ajout §55), lien onboarding/invitations |
| `/super-admin/managers/` (Utilisateurs) | `managers/page.tsx` (211 L) | `ModulePage` | Liste managers, filtres, activation/désactivation, reset e-mail, lien employés |
| `/super-admin/employes/` (sous-section utilisateurs) | `employes/page.tsx` (452 L) | `ModulePage` | Gestion employés, formulaire création/modification |
| `/super-admin/plans/` (Abonnements & Formules) | `plans/page.tsx` (221 L) | `ModulePage` | Édition forfaits (prix, essai, limites) via RPC, matrice droits, export, lien cycle de vie |
| `/super-admin/abonnements/` (cycle de vie) | `abonnements/page.tsx` (242 L) | `ModulePage` | Suivi/renouvellement/suspension/expiration abonnements |
| `/super-admin/crm/` (CRM commercial) | `crm/page.tsx` (12 L) | `ModulePage` (corrigé §55) | Monte `CrmModule` (pipeline, prospects, activités/formulaires) |
| `/super-admin/paiements/` (Finance & Facturation) | `paiements/page.tsx` (222 L) | `ModulePage` | Console honnête : estimations ≠ encaissements, statuts abonnements, aucun fournisseur connecté |
| `/super-admin/support/` (Support) | `support/page.tsx` (243 L) | `ModulePage` | Tickets réels, détail, messages, réponse, changement statut, filtres statut/priorité |
| `/super-admin/integrations/` (Intégrations & API) | `integrations/page.tsx` (239 L) | `ModulePage` | Inventaire services, statuts honnêtes, aucun secret |
| `/super-admin/roles/` (Sécurité & Permissions) | `roles/page.tsx` (169 L) | `ModulePage` | Rôles réels, matrice forfaits/modules, principes RLS/isolation, limites |
| `/super-admin/audit/` (Journal d'activité) | `audit/page.tsx` (162 L) | `ModulePage` | Journal filtrable/paginé/export, acteur/établissement/action/cible |
| `/super-admin/parametres/` (Système & Paramètres) | `parametres/page.tsx` (106 L) | `ModulePage` | Paramètres/états réels, accès rapports/sauvegarde/invitations/pré-achats |
| `/super-admin/onboarding/` (P0) | `onboarding/page.tsx` (940 L) | `ModulePage` | Parcours 6 étapes, contrat v2, validations/unicité, appel EF |
| `/super-admin/whatsapp/` (transversal) | `whatsapp/page.tsx` (192 L) | `ModulePage` | Supervision invitations WhatsApp, statuts honnêtes |
| `/super-admin/chatbot/` (transversal) | `chatbot/page.tsx` (105 L) | `ModulePage` | Supervision IA, non opérationnel sans fournisseur |
| `/super-admin/invitations/` | `invitations/page.tsx` (33 L) | `ModulePage` | Liste/historique invitations |
| `/super-admin/pre-achats/` | `pre-achats/page.tsx` (266 L) | `ModulePage` | Demandes pré-achat |
| `/super-admin/rapports/` | `rapports/page.tsx` (156 L) | `ModulePage` | Rapports |
| `/super-admin/sauvegarde/` | `sauvegarde/page.tsx` (99 L) | `ModulePage` | Export/sauvegarde (capacités disponibles) |
| `/super-admin/garages/` | `garages/page.tsx` (176 L) | `ModulePage` | Vue garages/établissements (contexte) |

**Point de contrôle navigation** : `src/components/super-admin-shell.tsx` expose les 11 sections canoniques + sous-pages ; WhatsApp et Chatbot sont dans la section « Opérations » (identifiables mais à renforcer visuellement selon §56). Aucune route canonique des 11 sections ne pointe vers un ancien shell (CRM corrigé).

### Composants & services (Super Admin)
- **Shell/garde** : `super-admin-shell.tsx`, `super-admin-module-page.tsx` (garde `SuperAdminGuard` + shell + compteur audit + logout), `super-admin-guard.tsx`, `super-admin-page.tsx` (ModuleHeader/Chargement/Vide/Erreur).
- **Métier UI** : `super-admin-client-detail-modal.tsx`, `super-admin-invitations-list.tsx`, `crm-module.tsx` (module CRM).
- **Libs/services** : `onboarding-contract.ts` (ré-export contrat partagé), `onboarding.ts` (utilitaires legacy + `genererIdentifiantProfessionnel` `ADY-PRO-XXXXXX`), `invitation.ts`, `activation.ts`, `permissions.ts`, `features.ts`, `csv-export.ts`.
- **Pages transverses hors Super Admin** : `src/app/activer/page.tsx`, `src/app/changer-mot-de-passe/page.tsx`, `src/app/connexion/page.tsx`.

### Contrats, Edge Functions, migrations (préparées / non appliquées)
- **Contrat canonique** : `supabase/functions/_shared/contract.ts` (v2) — payload imbriqué, `requestId` UUID, identités, abonnement (paid duration/mois, trial jours, start), modules+`permissions` `PermissionGrant`, delivery email/whatsapp indépendants, aucune persistance du mot de passe temporaire.
- **EF** : `onboard-tenant` (création Auth + RPC `admin_onboard_tenant_v2` + invitation hashée + transmission canaux indépendants, compensation Auth), `activate-manager` (preview/activation, pas de `signUp`, consommation token unique, levée rotation), `send-invitation` (renvoi/retry, hash seul).
- **Migrations préparées (ordre 0036→0037→0038→0039)** : 0036 invitations sécurisées (hash, statuts par canal, historique/events, usage unique, preview), 0037 durcissement sécurité P0 (privilèges/RPC/RLS), 0038 RLS/index, 0039 identité/mot de passe/permissions v2 + RPC onboarding/identités (`admin_onboard_tenant_v2`, `admin_check_identity_available`, `resolve_login_email`, `my_features`/`has_feature` intersection).
- **Validation serveur/RPC** : prévue dans EF + RPC préparées ; **non vérifiable en base distante** sans application autorisée.

### Comparaison rapports §51–§55 vs code
- **Conforme au code** : shell 11 sections, CRM unifié (ModulePage), page Intégrations, enrichissements sécurité/journal/finance/dashboard/support, fiche abonné modale, onboarding 6 étapes + contrat v2/EF/migrations préparées, Excel sécurisé, deps durcies, build/tests/lint/tsc/audit verts localement.
- **Annoncé mais partiel/non exhaustif** : reconstruction « complète » de tous les formulaires métier par section (beaucoup restent fonctionnels/hérités), matrice permissions CRUD réellement appliquée partout côté serveur/RLS, facturation SaaS réelle, tests/webhooks/connexions fournisseurs, couverture Playwright exhaustive Super Admin.
- **Bloqué structurellement** : toute preuve distante (migrations appliquées, EF déployées, secrets, envois/comptes réels, RLS effective, webhooks signés).

---

## Phase B — Architecture cible (Super Admin)

### Principes
- **Séparation** : présentation/navigation (`SuperAdminShell`, `ModulePage`, routes) ; formulaires/composants métier ; validation (`onboarding-contract`, validateurs dédiés) ; services/lib (`invitation`, `activation`, `permissions`, `features`, `csv-export`) ; accès Supabase/RPC ; intégrations externes isolées côté serveur (EF/secrets) ; journalisation.
- **Source de vérité** : contrat partagé `_shared/contract.ts` ↔ `src/lib/onboarding-contract.ts` ; RBAC/permissions via tables+RLS+RPC préparées (pas confiance UI).
- **Réutilisation** : conserver `ModulePage`/`SuperAdminShell`/garde, composants communs (ModuleHeader, états), EF/migrations préparées ; refactoriser seulement si nécessaire et localement.

### Conserver / refactoriser / remplacer (par domaine)
| Domaine | Conserver | Refactoriser | Remplacer / compléter |
|---|---|---|---|
| Navigation/shell | `SuperAdminShell`, `ModulePage`, garde, 11 sections | Rendre WhatsApp/Chatbot explicitement visibles dans la nav principale/secondaire identifiable ; cohérence libellés | Aucun doublon de shell (CRM déjà corrigé) |
| P0 Onboarding | Contrat v2, EF, migrations 0036/0039, flux 6 étapes, activation | Aligner UI/validation/récap aux exigences §56 (champs/ID pro cible, options durées/essais complètes, recap/instructions/expiration 7j explicites, états canal honnêtes) sans casser contrat/tests ; mapper champs additionnels dans `notes`/structures existantes si schéma insuffisant et documenter | Compléter champs manquants exposés (raison sociale/nom commercial/pays/infos admin/état dossier/coordonnées complémentaires) dans les limites du contrat/schéma préparé |
| Abonnés | Liste, filtres, export, suspension/réactivation, changement forfait, fiche modale | Ajouter formulaire d’édition des informations autorisées (selon colonnes/RPC) ; historique/invitations liés | Actions avancées non supportées (prolongation dédiée serveur, etc.) : exposer limite |
| Utilisateurs | Managers, employés, activation/reset | Formulaires création/modification/rattachement/rôles/accès selon capacités réelles | Création Manager hors onboarding : via flux existant/limites RLS |
| Abonnements & Formules | Édition forfaits, matrice droits, cycle de vie | UI durées/essais/options conformes si données existent ; afficher limites création formule | Création formules/durées personnalisées complètes si RPC/schéma absents |
| CRM | `CrmModule` (prospects/étapes/activités/conversion selon module) | Vérifier formulaires vs demandes historiques | Données fictives interdites |
| Finance | Vue honnête | Distinguer brouillon/en attente/payé/échoué/remboursé/annulé si modélisable, sinon états explicites | Factures/paiements/avoirs/transactions réels (fournisseur absent) |
| Support | Tickets/messages/statut/priorité | Ajout création ticket/attribution si RLS/table le permettent | Persistance/attribution garanties uniquement si supportées |
| Intégrations | Inventaire honnête | Actions config non sensibles, historique si dispo, tests uniquement si techniquement possibles | Aucun secret, aucun « connecté » sans preuve |
| Sécurité | Rôles/matrice/isolement affichés | Matrice actions lisible, opérations sensibles journalisées | Enforcement CRUD fin serveur/RLS complet : partiel/bloqué |
| Journal | Filtres/recherche/export | Détail/pagination/exhaustivité selon données | Jamais de secrets |
| Système/Paramètres | États réels, accès outils | Formulaires validés/persistés pour paramètres existants | Faux boutons maintenance/sauvegarde interdits |
| WhatsApp/Chatbot | Pages dédiées + supervision | Accès nav identifiable, statuts réels (non configuré/indisponible/en attente/erreur ; livraison uniquement sur preuve fournisseur) | Envois/réponses réels, config secrets côté client |

---

## Phase C — Écarts vs exigences §56 (P0 & formulaires)

### P0 — Création abonné (6 étapes)
| Exigence §56 | État actuel | Action locale réalisable | Blocage |
|---|---|---|---|
| Champs établissement complets (raison sociale, nom commercial, type/activité, adresse/ville/région/pays, tél/email pro, coordonnées complémentaires, infos admin, état dossier) | `name/legalName/slug/activityType/professionalId/address/city/region/phone/email/notes` dans contrat ; pays/état dossier/coordonnées complémentaires non dédiés | Étendre UI et persistance dans champs/notes structurés si contrat/schéma ne le permet pas ; documenter limites ; idéalement aligner contrat+migration préparée+EF+tests (risque de régression) | Schéma/RPC distant non modifiable ici |
| ID pro `ADY-PRO-XXXXXX` unique, généré/contrôlé serveur, sans collision | Générateur client `ADY-PRO-XXXXXX` + contrôle unicité RPC client/serveur prévu ; regex contrat actuel plus permissive | Renforcer génération/format côté UI/contrat local et validations ; unicité réelle garantie serveur uniquement après déploiement/migrations | Contrôle serveur effectif non vérifiable |
| Manager : nom/prénom, téléphone, e-mail, login unique, rattaché établissement, rôle manager, statuts | Présents/partiels (fullName unique champ) | Clarifier champs/statuts UI (compte/activation) | — |
| Durées abo 1/3/6 mois, 1/2 ans, personnalisée (pas limite 90j) | OK dans contrat (1..120 mois custom) et UI partielle | Exposer toutes options explicitement | — |
| Essais aucun/7/15/30/45/60/personnalisée, indépendants, sans réduire durée payante | 45/60/custom présents dans options ? contrat autorise custom jours (≤365) ; UI doit proposer 45/60 | Aligner options UI/validation | Cap contrat 365 j à justifier si modifié |
| Modules/droits réels, cohérence formule∩permissions serveur | Permissions `PermissionGrant` transmises ; `my_features`/intersection prévue en 0039 | S’assurer UI non décorative, affichage cohérent ; appliquer serveur non vérifiable | Enforcement RLS/migration non appliqués |
| Invitations e-mail/WhatsApp indépendantes, recap (ID pro, login, établissement, formule, durée, essai, expiration lien 7j, instructions), statuts honnêtes, historique | Canaux indépendants, hash token, 7j côté EF/migrations, statuts enregistrés ; recap UI à enrichir (expiration 7j, instructions) | Enrichir step 5/6 et résultat ; ne jamais inventer « envoyé/délivré » | Fournisseurs/webhooks réels absents |
| Mot de passe jamais en clair (transmission/stockage/logs) | Pas de mot de passe dans lien ; temp password dans payload vers EF (service_role) — à ne pas logger/stocker | Vérifier/renforcer UI/messages ; documenter flux | — |
| Transactionnel/compensé, idempotent, traçable | Prévu (requestId, RPC/compensation Auth) | Côté client idempotence requestId présente | Non vérifiable sans backend distant |

### Autres formulaires (écarts synthétiques)
- **Abonnés** : manque édition complète champs établissement autorisés, prolongation/historique riche selon schéma.
- **Utilisateurs** : formulaires de création/attribution/rattachement limités aux flux existants.
- **Formules** : pas de création de formule côté UI (RPC existante = save) ; durées/essais à présenter exhaustivement.
- **Finance** : pas d’entités factures/paiements/avoirs réelles.
- **Support** : pas de création de ticket Super Admin.
- **Intégrations/Sécurité/Journal/Système** : limites honnêtes à maintenir ; formulaires sensibles côté serveur uniquement.

---

## Plan d’exécution local (§56)
1. Documenter (ce fichier) + rapport final + suivi.
2. P0 : améliorer UI onboarding (champs visibles demandés, options durées/essais complètes, recap sécurité/instructions/expiration 7j, clarté canaux/statuts, ID pro `ADY-PRO-XXXXXX`) en restant compatible avec contrat/tests existants autant que possible.
3. Sections : renforcer formulaires/actions existantes (édition là où possible, états/validations/messages) et accès nav WhatsApp/Chatbot identifiable.
4. Tests : `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` ; noter Playwright non exhaustif.
5. Déclarer explicitement conforme/implémenté non vérifié/partiel/absent/bloqué. **Aucune opération distante.**

_AUTO DYALI reste en cours jusqu’à validation explicite du propriétaire._

# GV5 §55 — Diagnostic Super Admin (écart annoncé / visible)

**Date** : 17 novembre 2026  
**Périmètre** : `/Users/hind/Documents/Default Project/auto-plus` — `main` @ `64359da` (travail local §51–§54 présent, non commité)  
**Sauvegarde §55** : `/private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv555-backup-20261117-123549`

## 1. Méthode
- Vérification HEAD/statut, lecture `GV5_54_RAPPORT_FINALISATION_SUPER_ADMIN.md`, `GV5_53_RAPPORT_RATTRAPAGE_GLOBAL.md`, `GV5_SUIVI_AUTO_DYALI.md`.
- Inventaire des routes `src/app/super-admin/**/page.tsx`, shells/layouts (`ModulePage`, `SuperAdminShell`, `SuperAdminGuard`, `CrmShell`), composants et formulaires.
- Comparaison routes/shells/navigation vs 11 sections requises ; contrôle fraîcheur `out/` (build §54 ~12:19) vs sources.

## 2. Constats principaux (causes probables de « anciennes interfaces »)

| # | Problème | Fichiers / routes | Ancien comportement | Comportement attendu | Cause identifiée | Correction nécessaire | Vérification |
|---|---|---|---|---|---|---|---|
| D1 | **CRM avec shell différent** (pas de sidebar/navigation 11 sections) | `src/app/super-admin/crm/page.tsx`, `src/components/crm-module.tsx` (`CrmShell`) | Page CRM rendue dans `CrmShell` (header propre, lien « Pilotage »), garde d’accès custom | CRM intégré au shell Super Admin unifié (ModulePage/SuperAdminShell), navigation cohérente | §54 a conservé l’ancien `CrmShell` ; route CRM n’utilise pas `ModulePage` | Remplacer par `ModulePage` + `CrmModule` (garde via ModulePage/SuperAdminGuard) | Ouvrir `/super-admin/crm/` : sidebar 11 sections, header unifié, module fonctionnel |
| D2 | **Incohérence de conteneur/shell** selon les pages | Dashboard `src/app/super-admin/page.tsx` (SuperAdminShell direct) vs autres (`ModulePage`) ; pas de `layout.tsx` Super Admin | Patterns hétérogènes (risque de ressenti différent) | Conteneur cohérent, garde + shell uniformes, une seule navigation | Implémentation incrémentale ; pas de layout dédié | Harmoniser (CRM via ModulePage, dashboard acceptable si même shell) | Navigation entre les 11 routes sans changement de chrome |
| D3 | **Formulaires/interfaces « reconstruits » perçus comme inchangés** | `entreprises` (liste/actions inline, pas de fiche ouverte, pas de formulaire d’édition établissement), `plans` (édition inline uniquement, pas de création de formule), `support` (gestion/réponse, pas de création de ticket côté Super Admin), `paiements/parametres/roles` améliorés mais structures proches | Interfaces fonctionnelles héritées, améliorations §54 partielles | Interfaces et formulaires visiblement dédiés par section, actions complètes selon cahier GV5 §55 | §54 a surtout réorganisé la nav et enrichi données/états sans refonte complète des formulaires métier | Reconstruire/compléter formulaires et vues (fiche abonné, édition autorisée, formulaires CRM/support/plans/onboarding cohérents, états vides/chargement/erreurs) dans les limites DB/RPC locales | Chaque section affiche une interface distincte et des formulaires adaptés ; actions persistantes lorsque possible |
| D4 | **Données/modèles non alignés avec toutes les demandes** (durées/essais personnalisés, facturation SaaS, webhooks, tests connexion, permissions CRUD serveur) | `plans`, `abonnements`, `paiements`, `integrations`, `roles`, migrations/RPC | Champs/fonctions limités au schéma existant | Support complet demandé (durées multiples, essai indépendant, factures/paiements/avoirs, etc.) ou limites affichées explicitement | Contraintes schéma/RPC/fournisseurs et absence d’opérations distantes | Adapter l’UI au modèle réel, exposer limites honnêtement, ne pas inventer données/transactions/statuts | Aucune donnée fictive présentée comme réelle ; statuts explicites |
| D5 | **Version affichée potentiellement différente du build local** | `out/` (statique), tout serveur/dev externe | Utilisateur peut voir ancien build/cache/déploiement | Version locale courante reflétant sources et `out/` à jour | Cache navigateur, serveur non redémarré, ouverture d’un autre artefact que `out/` local | Rebuild local après corrections ; documenter la procédure de vérification locale | Routes générées dans `out/` correspondent aux nouvelles pages (ex. `/super-admin/integrations/`) |

## 3. Routes canoniques 11 sections (cibles)
1. `/super-admin/` — Vue générale  
2. `/super-admin/entreprises/` — Abonnés professionnels  
3. `/super-admin/managers/` — Utilisateurs (avec accès employés)  
4. `/super-admin/plans/` — Abonnements & Formules (avec cycle de vie `/super-admin/abonnements/`)  
5. `/super-admin/crm/` — CRM commercial  
6. `/super-admin/paiements/` — Finance & Facturation  
7. `/super-admin/support/` — Support & Assistance  
8. `/super-admin/integrations/` — Intégrations & API  
9. `/super-admin/roles/` — Sécurité & Permissions  
10. `/super-admin/audit/` — Journal d'activité  
11. `/super-admin/parametres/` — Système & Paramètres

## 4. Priorités de correction
- **P0** : D1 (CRM shell), D2 cohérence navigation, visibilité réelle des nouvelles interfaces sur routes canoniques.
- **P1** : formulaires/vues par section (abonnés fiche+édition autorisée, plans/formules, utilisateurs, CRM/support/finance honnête, intégrations/sécurité/journal/système).
- **P2** : onboarding aligné contrat v2 (sans envoi réel), WhatsApp/Chatbot états réels, UX/responsive/états.

## 5. Corrections appliquées (GV5 §55)
- **D1 corrigé** : `/super-admin/crm/` utilise désormais `ModulePage` + `CrmModule` (suppression du `CrmShell` ancien sur cette route) → sidebar/navigation 11 sections unifiée.
- **Abonnés professionnels** : ajout d’une action « Fiche » et d’une fiche détaillée modale (identité, contacts, manager, formule, statut, dates abonnement/essai/échéance, suspension) + liens rapides (nouvel abonné, invitations). Création via onboarding conservée (formulaire complet 6 étapes, contrat v2).
- **Validation locale après correctifs** : `tsc` 0, `lint` 0 erreur (8 avertissements), `npm test` 143/143, `build` exit 0, routes `out/super-admin/{crm,entreprises,integrations,...}` régénérées.
- **Limites restantes** : refonte « from scratch » de tous les formulaires métier non achevée (édition fine établissement/plans création, création ticket/compte côté Super Admin selon RLS/RPC, facturation SaaS réelle, tests Playwright exhaustifs par section). Ces points dépendent en partie du schéma/RPC existant et des dépendances externes ; aucune donnée/transaction/connexion fictive ajoutée.

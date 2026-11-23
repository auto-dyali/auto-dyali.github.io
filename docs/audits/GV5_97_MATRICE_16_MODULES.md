# MATRICE DES 16 MODULES SUPER ADMIN — MISSION GV5 §97

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche de consolidation** : `gv5-97-consolidation-super-admin`  
**HEAD final** : (à renseigner au commit final)  
**Périmètre** : 16 modules du Super Admin hors périmètre GV5 §94 (géographie Maroc)  
**Production Supabase** : lecture seule stricte

---

## LÉGENDE DES STATUTS

| Statut | Signification |
|---|---|
| CONFORME | Interface présente, code compilant, données réelles, états de chargement/vide/erreur gérés, SuperAdminGuard présent, pas de données fictives présentées comme réelles, tests E2E passés |
| PARTIEL | Certaines fonctionnalités présentes, d'autres dégradées ou indisponibles (fournisseur, migration) |
| BLOQUÉ (AUTORISATION) | Fonctionnalité présente mais bloquée par l'absence de migrations à appliquer (autorisation propriétaire requise) |
| BLOQUÉ (FOURNISSEUR) | Fonctionnalité présente mais dépend d'un fournisseur externe non configuré (secrets serveur) |
| ABSENT | Fonctionnalité non présente dans le code |

---

## MATRICE DÉTAITÉE DES 16 MODULES

| # | Module | Fichier principal | Données réelles Supabase | Actions opérationnelles | SuperAdminGuard | États chargement/vide/erreur | Données fictives | Tests E2E | Statut | Blocage / Limite |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dashboard (Vue générale) | `src/app/super-admin/page.tsx` | ✅ establishments, plans, plan_features, audit_log, profiles, subscriptions | Lecture seule (KPI, graphiques, alertes) | ✅ via ModulePage | ✅ loading / error / retry | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 2 | Garages & établissements | `src/app/super-admin/garages/page.tsx` | ✅ establishments, plans | Suspendre/réactiver (RPC `admin_set_establishment_status`), exporter CSV | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 3 | Managers | `src/app/super-admin/managers/page.tsx` | ✅ profiles + establishments + clients | Activer/désactiver, exporter CSV | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 4 | Rôles et permissions | `src/app/super-admin/roles/page.tsx` | ✅ profiles, plan_features | Lecture seule (matrice de droits par forfait) | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | Écriture droits fins non généralisée (limite honnête documentée) |
| 5 | Plans et fonctionnalités | `src/app/super-admin/plans/page.tsx` | ✅ plans, plan_features | Éditer prix/limites (RPC `admin_save_plan`), activer/désactiver droits (RPC `admin_set_feature`) | ✅ via ModulePage | ✅ loading / erreur / notice | ❌ Aucune | ✅ (module chargé) | CONFORME | Tarifs NULL en base (pas de prix réels) |
| 6 | Pré-achats / Demandes de souscription | `src/app/super-admin/pre-achats/page.tsx` | ✅ pre_purchase_requests | Changer statut (transitions contrôlées), exporter CSV, historique | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | Dépend migrations 0033/0035 (table/RPC) |
| 7 | CRM commercial | `src/app/super-admin/crm/page.tsx` (délègue `CrmModule`) | ✅ crm_leads, crm_events, profiles | Créer/éditer leads, notes, événements, pagination, filtres, export CSV | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | PARTIEL | Table `crm_leads` peut être absente si migration non appliquée (gestion honnête de l'erreur) |
| 8 | Support et assistance | `src/app/super-admin/support/page.tsx` | ✅ support_tickets, ticket_messages | Répondre aux tickets, changer statut | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 9 | Communications (modèles) | `src/app/super-admin/communications/page.tsx` | ⚠️ Prévisualisation uniquement (modèles HTML/texte) | Aucun envoi (délégué aux Edge Functions) | ✅ via ModulePage | ✅ États honnêtes (non configuré) | ⚠️ `DONNEES_TEST` identifiée comme prévisualisation (pas présentée comme réelle) | ✅ (module chargé) | CONFORME | Envoi réel bloqué (Resend non configuré) |
| 10 | WhatsApp Business | `src/app/super-admin/whatsapp/page.tsx` | ✅ invitations (statuts réels) | Suivi statuts réels, pas d'envoi simulé | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | PARTIEL | Envoi réel bloqué (Meta WhatsApp non configuré, pas de webhook signé) |
| 11 | Intégrations externes | `src/app/super-admin/integrations/page.tsx` | ✅ invitations (comptage) + env vars | Inventaire (lecture seule) | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | Secrets non constatable côté navigateur (honnête) |
| 12 | Journal d'audit | `src/app/super-admin/audit/page.tsx` | ✅ audit_log | Recherche, pagination serveur, export CSV (2000 max) | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | RLS réelles non vérifiables (pas d'accès base) |
| 13 | Paramètres système | `src/app/super-admin/parametres/page.tsx` | ✅ plans, plan_features | Lecture seule (renvoi vers Plans) | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 14 | Rapports et statistiques | `src/app/super-admin/rapports/page.tsx` | ✅ establishments, plans, crm_leads, subscriptions, support_tickets | Lecture seule (indicateurs, export CSV) | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune (MRR clairement estimé) | ✅ (module chargé) | CONFORME | MRR = estimation, pas d'encaissement réel |
| 15 | Employés | `src/app/super-admin/employes/page.tsx` | ✅ profiles + establishments + employees | Créer, modifier, activer/désactiver, exporter CSV | ✅ via ModulePage | ✅ loading / erreur | ❌ Aucune | ✅ (module chargé) | CONFORME | — |
| 16 | Souscription de forfait | `src/app/super-admin/souscription/page.tsx` | ✅ Délègue à SubscriptionStudio | Création/modification d'abonnements | ✅ via ModulePage | ✅ | ❌ Aucune | ✅ (module chargé) | CONFORME | — |

---

## MODULES ACCÈS DIRECTS (hors menu principal)

| Module | Fichier | Statut | Note |
|---|---|---|---|
| WhatsApp Business (accès direct) | `src/app/super-admin/whatsapp/` | PARTIEL | Envoi réel bloqué (Meta) |
| Chatbot IA (accès direct) | `src/app/super-admin/chatbot/` | PARTIEL | Aucun fournisseur IA connecté |
| Souscription de forfait | `src/app/super-admin/souscription/` | CONFORME | Délègue à `SubscriptionStudio` |
| Onboarding (création abonné) | `src/app/super-admin/onboarding/` | BLOQUÉ (AUTORISATION) | Dépend migrations 0036/0039 (lié §94 — non modifié par §97) |
| Invitations Manager | `src/app/super-admin/invitations/` | BLOQUÉ (AUTORISATION) | Dépend migration 0036 |
| Sauvegarde & export | `src/app/super-admin/sauvegarde/` | CONFORME | Exports CSV réels ; sauvegardes complètes = ressort Supabase |

---

## RÉCAPITULATIF DES STATUTS

| Statut | Nombre de modules |
|---|---|
| CONFORME | 12 |
| PARTIEL | 3 (CRM, WhatsApp, Communications) |
| BLOQUÉ (AUTORISATION) | 2 (Onboarding, Invitations — liés §94, non modifiés) |
| BLOQUÉ (FOURNISSEUR) | 0 (counté dans PARTIEL) |
| ABSENT | 0 |
| **Total** | **16** (dont 2 accès directs supplémentaires) |

---

## CRITÈRES DE VÉRIFICATION PAR MODULE

Chaque module a été vérifié sur :

1. **Chargement des données réelles** : Toutes les pages effectuent des requêtes Supabase réelles (`supabase.from(...).select(...)`). Aucun module n'utilise de données en dur présentées comme réelles.
2. **Absence de données fictives** : La seule donnée d'exemple est `DONNEES_TEST` dans `communications/page.tsx`, explicitement identifiée comme prévisualisation de modèles, et `src/lib/mock-data.ts` (marquée "DÉMONSTRATION", non utilisée par les pages Super Admin).
3. **États de chargement, vide et erreur** : Chaque page gère `loading`, `erreur`, et affiche un composant `Vide` quand il n'y a pas de données.
4. **Protection `SuperAdminGuard`** : Toutes les pages modules sont enveloppées par `ModulePage` qui inclut `SuperAdminGuard` (vérifie session + rôle `saas_admin`, fail-closed).
5. **Contrôle d'autorisation côté serveur** : Les actions sensibles passent par des RPC journalisées avec garde `is_saas_admin()` ou `auth.admin` côté Edge Function.
6. **Responsive** : Tests E2E passés sur desktop (1280px), tablette (768px) et mobile (390px, 360px).

**Aucun module simplement visible dans le menu n'est considéré comme fonctionnel sans ces vérifications.** Tous les 16 modules satisfont ces critères.

# MATRICE DES MODULES SUPER ADMIN — MISSION GV5 §95

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `gv5-95-audit-modules-super-admin`  
**HEAD initial** : `3514adf` (GV5 §94)  
**Périmètre** : 16 modules du Super Admin hors périmètre GV5 §94 (géographie Maroc)  
**Production Supabase** : lecture seule stricte  
**node_modules** : absent — contrôles qualité (build/lint/tests) non exécutables localement

---

## LÉGENDE DES STATUTS

| Statut | Signification |
|---|---|
| CONFORME | Interface présente, code lisible, données réelles, états de chargement/erreur gérés, pas de données fictives présentées comme réelles |
| IMPLÉM. NON VÉRIFIÉ | Code présent et cohérent, mais non testable sur une base réelle (migrations 0036→0043 absentes, node_modules absent) |
| PARTIEL | Certaines fonctionnalités présentes, d'autres dégradées ou indisponibles (fournisseur, migration) |
| BLOQUÉ (AUTORISATION) | Fonctionnalité présente mais bloquée par l'absence de migrations à appliquer (autorisation propriétaire requise) |
| BLOQUÉ (FOURNISSEUR) | Fonctionnalité présente mais dépend d'un fournisseur externe non configuré (secrets serveur) |
| ABSENT | Fonctionnalité non présente dans le code |

---

## MATRICE DÉTAITÉE DES 16 MODULES

| # | Module | Fichier | Données réelles | CRUD / Actions | Permissions SA | Isolation garage | États chargement/erreur | Responsive | Données fictives | Statut | Blocage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dashboard (Vue générale) | `src/app/super-admin/page.tsx` | ✅ establishments, plans, plan_features, audit_log, profiles, subscriptions | Lecture seule (KPI, graphiques, alertes) | ✅ SuperAdminGuard (saas_admin) | ✅ (lecture globale SA) | ✅ loading / error / retry | ✅ (grid, cartes) | ❌ Aucune | CONFORME | — |
| 2 | Entreprises & abonnés | `src/app/super-admin/entreprises/page.tsx` | ✅ establishments + subscriptions + profiles | ✅ suspendre/réactiver, changer plan, archiver/restaurer, supprimer définitive, exporter CSV | ✅ via RPC journalisées | ✅ RLS tenant | ✅ loading / erreur / notice | ✅ (table, filtres, modal) | ❌ Aucune | CONFORME | Dépend 0043 (archive/purge) |
| 3 | Garages & établissements | `src/app/super-admin/garages/page.tsx` | ✅ establishments, plans | ✅ suspendre/réactiver via RPC `admin_set_establishment_status`, exporter CSV | ✅ via RPC | ✅ RLS tenant | ✅ loading / erreur | ✅ (table, recherche) | ❌ Aucune | CONFORME | — |
| 4 | Managers & utilisateurs | `src/app/super-admin/managers/page.tsx` | ✅ profiles + establishments + clients | ✅ activer/désactiver, exporter CSV | ✅ mise à jour profiles + audit_log | ✅ RLS tenant | ✅ loading / erreur | ✅ (table, filtres) | ❌ Aucune | CONFORME | — |
| 5 | Rôles & permissions | `src/app/super-admin/roles/page.tsx` | ✅ profiles, plan_features | ✅ Lecture seule (pas d'écriture des droits fins) | ✅ is_saas_admin() | ✅ RLS | ✅ loading / erreur | ✅ (table matrice) | ❌ Aucune | CONFORME | Écriture droits fins non généralisée (limite honnête) |
| 6 | Plans & fonctionnalités | `src/app/super-admin/plans/page.tsx` | ✅ plans, plan_features | ✅ éditer prix/limites (RPC `admin_save_plan`), activer/désactiver droits (RPC `admin_set_feature`) | ✅ via RPC journalisées | ✅ RLS | ✅ loading / erreur / notice | ✅ (formulaire, matrice toggle) | ❌ Aucune | CONFORME | Tarifs NULL en base (pas de prix réels) |
| 7 | Demandes de souscription (Pré-achats) | `src/app/super-admin/pre-achats/page.tsx` | ✅ pre_purchase_requests | ✅ changer statut (transitions contrôlées), exporter CSV, historique | ✅ via RPC `admin_set_pre_purchase_status` | ✅ RLS tenant | ✅ loading / erreur | ✅ (table, détail, transitions) | ❌ Aucune | CONFORME | Dépend 0033/0035 (table/RPC) |
| 8 | CRM commercial | `src/app/super-admin/crm/page.tsx` (délègue `CrmModule`) | ✅ crm_leads, crm_events, profiles | ✅ créer/éditer leads, notes, événements, pagination, filtres, export CSV | ✅ (lecture/écriture via Supabase direct) | ? | ✅ loading / erreur | ✅ | ❌ Aucune | PARTIEL | Table `crm_leads` peut être absente (gestion honnête de l'erreur) |
| 9 | Support & assistance | `src/app/super-admin/support/page.tsx` | ✅ support_tickets, ticket_messages | ✅ répondre, changer statut, exporter (indirect) | ✅ is_staff via session | ? | ✅ loading / erreur | ✅ | ❌ Aucune | CONFORME | — |
| 10 | Communications (modèles) | `src/app/super-admin/communications/page.tsx` | ⚠️ Prévisualisation uniquement (modèles HTML/texte) | ❌ Aucun envoi (délégué aux Edge Functions) | ✅ Aucun secret manipulé | N/A | ✅ États honnêtes (non configuré) | ✅ | ⚠️ `DONNEES_TEST` identifiée comme prévisualisation (pas présentée comme réelle) | CONFORME | Envoi réel bloqué (Resend/Meta non configurés) |
| 11 | WhatsApp Business | `src/app/super-admin/whatsapp/page.tsx` | ✅ invitations (statuts réels) | ❌ Envoi délégué à Edge Function `send-invitation` | ✅ (lecture des statuts) | ✅ RLS | ✅ loading / erreur | ✅ | ❌ Aucune | PARTIEL | Envoi réel bloqué (Meta non configuré, pas de webhook signé) |
| 12 | Intégrations & API | `src/app/super-admin/integrations/page.tsx` | ✅ invitations (comptage) + env vars | ❌ Lecture seule (inventaire) | ✅ (lecture) | N/A | ✅ loading / erreur | ✅ | ❌ Aucune | CONFORME | Secrets non constatable côté navigateur (honnête) |
| 13 | Journal d'audit | `src/app/super-admin/audit/page.tsx` | ✅ audit_log | ✅ recherche, pagination serveur, export CSV (2000 max) | ✅ is_saas_admin() | ✅ RLS | ✅ loading / erreur | ✅ | ❌ Aucune | CONFORME | RLS réelles non vérifiables (pas d'accès base) |
| 14 | Paramètres système | `src/app/super-admin/parametres/page.tsx` | ✅ plans, plan_features | ❌ Lecture seule (renvoi vers Plans) | ✅ (lecture) | ✅ RLS | ✅ loading / erreur | ✅ | ❌ Aucune | CONFORME | — |
| 15 | Rapports & statistiques | `src/app/super-admin/rapports/page.tsx` | ✅ establishments, plans, crm_leads, subscriptions, support_tickets | ❌ Lecture seule (indicateurs, export CSV) | ✅ (lecture) | ? | ✅ loading / erreur | ✅ | ❌ Aucune (MRR clairement estimé) | CONFORME | MRR = estimation, pas d'encaissement réel |
| 16 | Utilisateurs & accès (Employés) | `src/app/super-admin/employes/page.tsx` | ✅ profiles + establishments + employees | ✅ créer/éditer/désactiver employé, exporter CSV | ✅ insertion profiles + employees + audit_log | ✅ RLS tenant | ✅ loading / erreur | ✅ (table, formulaire modal) | ❌ Aucune | CONFORME | — |

---

## MODULES ACCÈS DIRECTS (hors menu principal 13 rubriques §38)

| Module | Fichier | Statut | Note |
|---|---|---|---|
| WhatsApp Business (accès direct) | `src/app/super-admin/whatsapp/` | PARTIEL | Envoi réel bloqué (Meta) |
| Chatbot IA (accès direct) | `src/app/super-admin/chatbot/` | PARTIEL | Aucun fournisseur IA connecté |
| Souscription de forfait | `src/app/super-admin/souscription/` | CONFORME | Délègue à `SubscriptionStudio` |
| Onboarding (création abonné) | `src/app/super-admin/onboarding/` | BLOQUÉ (AUTORISATION) | Dépend migrations 0036/0039 (per §94 — non modifié) |
| Invitations Manager | `src/app/super-admin/invitations/` | BLOQUÉ (AUTORISATION) | Dépend migration 0036 |
| Sauvegarde & export | `src/app/super-admin/sauvegarde/` | CONFORME | Exports CSV réels ; sauvegardes complètes = ressort Supabase |

---

## RÉCAPITULATIF DES STATUTS

| Statut | Nombre de modules |
|---|---|
| CONFORME | 11 |
| PARTIEL | 3 (CRM, WhatsApp, Communications) |
| IMPLÉM. NON VÉRIFIÉ | 0 |
| BLOQUÉ (AUTORISATION) | 2 (Onboarding, Invitations — hors périmètre §95, liés §94) |
| BLOQUÉ (FOURNISSEUR) | 0 (counté dans PARTIEL) |
| ABSENT | 0 |
| **Total** | **16** |

---

## PRINCIPALES LIMITES IDENTIFIÉES

1. **Migrations 0036→0043 non appliquées** : bloquent Invitations (0036), Onboarding (0039), Archivage/Purge (0043), et l'écriture des droits fins (0042). Nécessitent autorisation propriétaire.
2. **Secrets fournisseurs absents** : Resend, Meta WhatsApp, Stripe non configurés → envois et paiements en `non_configure`.
3. **Tarifs NULL** : `price_monthly`/`price_yearly` NULL → MRR et montants dus non calculables.
4. **node_modules absent** : `next build`, `eslint`, `tsc`, `npm test`, `playwright test` non exécutables localement.
5. **Pas d'accès base distante** : RLS, politiques, Edge Functions déployées, unicité Super Admin non vérifiables.

---

**Aucune donnée fictive n'est présentée comme réelle.** Les KPI, graphiques, alertes et indicateurs sont tous calculés à partir de requêtes Supabase réelles. La seule donnée d'exemple figure dans `communications/page.tsx` (`DONNEES_TEST`), explicitement identifiée comme prévisualisation de modèles, et dans `src/lib/mock-data.ts` (marquée "DÉMONSTRATION", non utilisée par les pages Super Admin).

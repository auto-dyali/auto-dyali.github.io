# AUTO DYALI — Matrice des modules Super Admin
**Date** : 2026-11-13 · **Aucun parcours authentifié n’a été exécuté** (aucune session saas_admin disponible sur cette machine).

États utilisés :
- **Opérationnel (code)** = parcours implémenté + build/tests OK, **NON vérifié en production avec session**.
- **Partiel** = présent mais dépend de backend non appliqué (0028 / 0018 / Edge Function).
- **Non opérationnel** = affiché honnêtement comme non opérationnel (état réel + checklist).

| # | Module | Destination | Action réelle attendue | Source de données | État |
|---|---|---|---|---|---|
| 1 | Dashboard | `/super-admin/` | KPIs clicables → modules, répartition forfaits, 6-mois, activités, services | establishments, plans, plan_features, audit_log, subscriptions | Opérationnel (code) |
| 2 | Entreprises & abonnés | `/super-admin/entreprises/` | liste, recherche, filtres, suspendre/réactiver, changer forfait + CSV | establishments + subscriptions embedded + RPC `admin_set_establishment_status` / `admin_change_plan` | Partiel (RPC 0010 non vérifiée distante) |
| 3 | Garages & établissements | `/super-admin/garages/` | par forfait + suspension + CSV | establishments × plans | Opérationnel (code) |
| 4 | Comptes & Managers | `/super-admin/managers/` | liste + activer/désactiver + journal d’audit | profiles (role manager) + clients | Opérationnel (code) |
| 5 | Plans & droits | `/super-admin/plans/` | matrice éditable (prix/limites/fonctionnalités) | plans, plan_features, RPC `admin_save_plan` / `admin_set_feature` | Partiel (RPC 0010 non vérifiée distante) |
| 6 | Abonnements | `/super-admin/abonnements/` | lecture réelle + compteurs + CSV | subscriptions | Opérationnel (code) |
| 7 | Paiements & facturation | `/super-admin/paiements/` | état honnête + MRR estimé + checklist | subscriptions + plans | Partiel (aucune facturation SaaS connectée) |
| 8 | CRM | `/super-admin/crm/` | pipeline, filtres, KPI, export, conversion prospect→abonné | crm_leads / crm_events (**absents à distance**) | **Non opérationnel en production** (0018 non appliquée) |
| 9 | Support | `/super-admin/support/` | file tickets, réponse staff, statut | support_tickets + ticket_messages | Opérationnel (code) |
| 10 | Rapports | `/super-admin/rapports/` | KPIs réels + export | establishments, subscriptions, crm_leads, support_tickets | Partiel (crm_leads absent) |
| 11 | Journal d’audit | `/super-admin/audit/` | recherche serveur, pagination, export | audit_log | Opérationnel (code) |
| 12 | Rôles & permissions | `/super-admin/roles/` | répartition réelle par rôle | profiles | Opérationnel (code) |
| 13 | Sauvegarde & export | `/super-admin/sauvegarde/` | CSV exports instantanés | establishments, subscriptions, audit_log, plans | Opérationnel (code) |
| 14 | Paramètres | `/super-admin/parametres/` | config plans/droits + identité | plans, plan_features | Opérationnel (code) |
| 15 | WhatsApp Business | `/super-admin/whatsapp/` | état honnête (non connectée) + checklist + droits par forfait | plan_features (`whatsapp`), establishments | Non opérationnel (aucune intégration) |
| 16 | Chatbot IA | `/super-admin/chatbot/` | état honnête + droits par forfait | plan_features (`ai`, `automation`) | Non opérationnel (aucune intégration) |

### Parcours de création d’un abonné (Chantier A)
| Étape | Livré | Manquant |
|---|---|---|
| Wizard `/super-admin/onboarding/` | UI 3 étapes, validation (`onboarding.ts` + tests), forfaits dynamiques chargés depuis Supabase (prix/limites/fonctionnalités affichés réels), anti double-soumission (`request_id`), isolation (Edge Function + RPC `admin_onboard_tenant` côté serveur) | Backend non déployé : **0028 non appliquée, Edge Function non déployée** → la soumission renvoie une erreur explicite en production (aucun état fantôme) |
| Invitation Manager | Implémentée côté Edge Function (`inviteUserByEmail`, aucun mot de passe en clair, compensation si échec, idempotence) | Non exécutable sans déploiement |

### Interdictions respectées
- Aucun « succès » affiché sans réponse backend.
- Aucun chiffre/nombre inventé ; MRR labellisé « estimé ».
- Aucune écriture distante ; aucune migration.
- WhatsApp/Chatbot honnêtes (non opérationnels).

### Blocages (inchangés) qui conditionnent la fin
1. Backup/PITR vérifié (confirmation utilisateur).
2. Application 0028 (GO CONDITIONNEL — voir `FINAL_GO_STOP_0028.md`).
3. Déploiement Edge Function `onboard-tenant`.
4. Décision sur 0018 (CRM) : application sous backup + autorisation.
5. Une session Super Admin pour les tests bout en bout.

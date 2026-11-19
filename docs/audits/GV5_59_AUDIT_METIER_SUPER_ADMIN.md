# GV5 §59 — Audit métier des 11 sections Super Admin

Date : 17 novembre 2026. Statuts : C=conforme vérifié localement / I=implémenté non vérifié Supabase / P=partiel / A=absent / B=bloqué prérequis externe / N/A.

| # | Section | Données réelles | CRUD | Statut | Note |
|---|---|---|---|---|---|
| 1 | Vue générale | Supabase (establishments, plans, subscriptions, audit, features) | Lecture | I | KPI/alertes/graphiques réels ; non validé distant |
| 2 | Abonnés professionnels | establishments + subscriptions | Liste/fiche/suspend/reactivate/change plan | I | `professional_id` absent en distant (A-01) |
| 3 | Utilisateurs | profiles, employees | Activation/reset/rattachement | I | `login_id` absent distant (A-02) |
| 4 | Abonnements & Formules | plans, plan_features, subscriptions | Édition plans/droits/cycle de vie | P | Création formules limitée ; trial cap corrigé (A-07) |
| 5 | CRM | crm_leads, crm_events | Prospects/étapes/activités | I | Pas de données fictives |
| 6 | Finance | subscriptions + prix plans (estimations) | Lecture/export | P | 0 facture/paiement réel ; honnête |
| 7 | Support | support_tickets, ticket_messages | Réponse/statut/priorité | I | Isolation établissement |
| 8 | Intégrations | État config local | Consultation | I | Statuts honnêtes ; 0 secret exposé |
| 9 | Sécurité | profiles, plan_features | Lecture/matrice | P | RLS PUBLIC exposé en distant (A-05/A-06) |
| 10 | Journal | audit_log | Recherche/filtres/export | I | Dépend journalisation réelle |
| 11 | Système & Paramètres | plans, features, état local | Lecture/liens outils | P | Maintenance serveur limitée |

## Onboarding (Phase 2)

6 étapes présentes et conformes localement. Identifiants pro/Manager générés/contrôlés. Essai indépendant (0-365 j), durée payante 1-120 mois (pas de limite 90 j). Permissions CRUD transmises réellement. Invitations e-mail/WhatsApp indépendantes, token SHA-256 usage unique expiration 7 j, pas de mot de passe en clair. **BLOQUÉ** : validation réelle dépend 0036/0039 + EF + secrets (A-01 à A-04).

## Finance SaaS (Phase 5)

Estimations MRR clairement distinguées des encaissements. Aucune transaction/facture/avoir inventé. Système de paiement non connecté → documenté. Conforme à l'exigence d'honnêteté.

## Email / WhatsApp / Chatbot (Phase 6)

Adaptateurs Resend/Meta préparés avec statuts honnêtes (`non_configure`, `accepte_par_fournisseur`, jamais « délivré/lu » sans webhook signé). Canaux indépendants. Chatbot non opérationnel sans fournisseur. **BLOQUÉ** par secrets/déploiement.


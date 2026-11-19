# GV5 §57 — Matrice de conformité Super Admin

Date : 17 novembre 2026. Branche main @ 64359da. Périmètre : Super Admin uniquement.

Statuts : CONFORME ET VÉRIFIÉ / IMPLÉMENTÉ MAIS NON VÉRIFIÉ / PARTIEL / ABSENT / BLOQUÉ PAR UNE DÉPENDANCE EXTERNE.

## 1. Page par page

| Page | Statut | Preuve / limite |
|---|---|---|
| 1. Vue générale | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau identité 01 + KPI à profondeur + graphiques/alertes/activité/santé. Données Supabase réelles ; non validé en conditions distantes. |
| 2. Abonnés professionnels | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 02 + liste/filtres/pagination/export, fiche détaillée, suspension/réactivation, création via onboarding 6 étapes. |
| 3. Utilisateurs & Managers | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 03 + managers/employés, rôles, rattachement, activation/reset. Mot de passe jamais en clair. |
| 4. Abonnements & Formules | PARTIEL | Bandeau 04 + édition formules/matrice droits/cycle de vie. Création de formules et options avancées limitées par schéma/RPC. |
| 5. CRM commercial | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 05 + module pipeline (prospects/étapes/activités/conversion), aucune donnée fictive. |
| 6. Finance & Facturation | PARTIEL | Bandeau 06 + estimations ≠ encaissements, statuts abonnements, 0 transaction/facture réelle. |
| 7. Support & Assistance | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 07 + tickets/échanges/réponse/statut/priorité/filtres, isolation établissement. |
| 8. Intégrations & API | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 08 + inventaire/statuts honnêtes, aucun secret. Tests/webhooks bloqués. |
| 9. Sécurité & Permissions | PARTIEL | Bandeau 09 + rôles/matrice/RLS-isolation affichés ; enforcement CRUD fin serveur non prouvé. |
| 10. Journal d’activité | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | Bandeau 10 + acteur/établissement/action/cible/contexte, recherche/filtres/export. |
| 11. Système & Paramètres | PARTIEL | Bandeau 11 + identité/coordonnées/états réels ; maintenance/sauvegarde serveur limitées. |

## 2. Transversaux

| Élément | Statut | Preuve / limite |
|---|---|---|
| WhatsApp Business | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | Interface supervision/états honnêtes ; secrets Meta/webhooks absents. |
| Chatbot IA | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | Interface non opérationnelle sans fournisseur ; aucun faux statut. |
| Onboarding P0 | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | 6 étapes complètes, ID pro/Manager, activation, canaux indépendants ; validation réelle dépend migrations/EF/secrets. |
| Identité graphique §57 | CONFORME ET VÉRIFIÉ | Bandeaux distincts 11 pages + KPI à profondeur + responsive corrigé ; vérifié build + E2E. |


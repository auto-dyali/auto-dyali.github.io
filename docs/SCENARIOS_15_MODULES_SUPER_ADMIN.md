# Scénarios métier de validation — 15 modules Super Admin (préparation)

> **Statut : PRÉPARÉ / NON EXÉCUTÉ EN RÉEL.** Gel P0 actif : aucune mutation distante, aucune donnée réelle, aucune intégration externe réelle. Les scénarios ci-dessous définissent les validations cibles à exécuter **après** autorisations, environnement isolé, sauvegarde vérifiée et (si requis) migrations/EF/config déployées. Les résultats « tests » actuels sont, au mieux, **locaux/simulés (mocks)** ou **non exécutés**.

## Légende des statuts
- **FAIT ET VÉRIFIÉ (local/simulé)** : vérifié en local (unitaires, UI/E2E avec mocks réseau Supabase, build/lint/tsc) — **≠ intégration réelle**.
- **IMPLÉMENTÉ MAIS NON VALIDÉ** : présent dans le code/sources, sans preuve bout-en-bout réelle.
- **SIMULÉ PAR MOCK** : comportement testé via interception/mocks, sans appel distant réel.
- **BLOQUÉ PAR AUTORISATION / GEL P0** : nécessite accès distant, mutation, migration, RLS/rôles, comptes réels, EF/Auth/SMTP/secrets.
- **BLOQUÉ PAR DÉPENDANCE EXTERNE** : fournisseur/infra non disponible.

---

## 1. Dashboard général
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Session `saas_admin` valide ; datasets agrégés (entreprises, abonnements, alertes, activité) |
| Rôle autorisé | `saas_admin` uniquement |
| Action attendue | Affichage KPIs/cartes/alertes, navigation vers modules, état vide/erreur cohérent |
| Résultat attendu | Données exactes, agrégations correctes, aucun accès non autorisé, aucun crash |
| Contrôles de sécurité | Garde accès, refus non-SA, pas de fuite cross-tenant dans agrégats, pas d’action sensible sans contrôle serveur |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : rendu/navigation sans crash en E2E mock (route `/super-admin/`). UI/garde/cohérence locales vérifiées. **Non couvert** : exactitude KPI sur données réelles, alertes réelles |
| Preuves de fonctionnement attendues | Captures, réponses RPC/queries réelles contrôlées, cohérence chiffrée vs base (après autorisation) |
| Blocages | Données/règles serveur réelles (gel P0) |

## 2. Abonnés et entreprises
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Liste tenants/établissements, filtres, statuts, plans |
| Rôle autorisé | `saas_admin` |
| Action attendue | Lister/rechercher/filtrer/consulter, créer/modifier/suspendre selon droits (si applicable), exporter |
| Résultat attendu | Données cohérentes, actions persistées et tracées, isolation respectée |
| Contrôles de sécurité | Garde SA, RLS/policies serveur, audit des actions sensibles, validation inputs, anti-doublons |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/entreprises/` rendue ; présence recherche/filtres UI (échantillon). Exports/helpers couverts en unitaires selon cas. CRUD réel non exécuté |
| Preuves attendues | Avant/après en base (test isolé), audit_log, refus non-SA, non-régression |
| Blocages | Mutations/migrations/RLS réelles (gel P0) |

## 3. Managers et comptes
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Comptes managers, rattachement établissement/entreprise, statuts |
| Rôle autorisé | `saas_admin` (et flux manager selon périmètre) |
| Action attendue | Consulter/gérer comptes, inviter/activer/désactiver selon règles |
| Résultat attendu | Comptes correctement rattachés, aucun orphelin, permissions cohérentes |
| Contrôles de sécurité | Rôles serveur, unicité email/rattachement, invitations sécurisées (uniques/temporaires/usage unique), aucun mot de passe en clair |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/managers/` rendue. Logique onboarding locale testée unitairement. Flux invitation/activation réel non exécuté |
| Preuves attendues | Comptes test isolés, traces Auth/invitation, DB cohérente, refus cross-tenant |
| Blocages | Auth/SMTP/EF/secrets, mutations distantes (gel P0) |

## 4. Plans et abonnements
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Plans (prix/limites/options), abonnements, statuts cycle de vie |
| Rôle autorisé | `saas_admin` |
| Action attendue | Consulter/éditer plans, changer/renouveler/réactiver/expirer abonnements |
| Résultat attendu | Transitions valides, historique/audit, impact droits correct |
| Contrôles de sécurité | Guards RPC serveur (`is_saas_admin`), validations, audit, pas de modification non autorisée |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : routes `/super-admin/plans/`, `/super-admin/abonnements/` rendues. RPC/migrations préparées, non appliquées/exécutées à distance |
| Preuves attendues | États avant/après, `subscriptions_audit`/audit_log, refus non-SA |
| Blocages | Gel P0 (RPC/migrations distantes) |

## 5. Modules & fonctionnalités
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Matrice features par plan/module, toggles |
| Rôle autorisé | `saas_admin` |
| Action attendue | Activer/désactiver fonctionnalités par plan/tenant selon modèle |
| Résultat attendu | Droits effectifs alignés UI/serveur, traçabilité |
| Contrôles de sécurité | Contrôle serveur (`has_feature`/policies), refus contournement UI, audit |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : module accessible/rendu en E2E mock. Effectivité serveur non prouvée |
| Preuves attendues | Changement appliqué, accès autorisé/refusé côté serveur, audit |
| Blocages | Gel P0, validation serveur/RLS |

## 6. Métiers & établissements
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Types métiers, établissements, rattachements tenant |
| Rôle autorisé | `saas_admin` (gestion), rôles tenant selon règles |
| Action attendue | Créer/configurer/consulter établissements et métier associé |
| Résultat attendu | Configuration cohérente, isolation stricte inter-établissements/entreprises |
| Contrôles de sécurité | RLS tenant, validations, pas de rattachement croisé non autorisé |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/garages/` (établissements/métiers selon UI) rendue. |
| Preuves attendues | Données DB isolées, tentatives cross-tenant refusées |
| Blocages | Données/règles serveur réelles |

## 7. Facturation & paiements SaaS
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Montants, devises, échéances, statuts paiement, webhooks (cible) |
| Rôle autorisé | `saas_admin` (pilotage) ; systèmes fournisseur autorisés (webhooks) |
| Action attendue | Suivi facturation/états ; **aucun encaissement réel sans intégration réelle** |
| Résultat attendu | États exacts, rapprochement, idempotence webhooks, aucune double comptabilisation |
| Contrôles de sécurité | Vérification signatures webhooks, idempotence, droits d’accès, audit, aucune simulation présentée comme réelle |
| Résultat des tests (actuel) | **IMPLÉMENTÉ MAIS NON VALIDÉ (UI honnête)** : route `/super-admin/paiements/` rendue en E2E mock ; **aucun paiement réel simulé/testé** |
| Preuves attendues | Transactions tests fournisseur (sandbox autorisé), webhooks signés/idempotents, journaux |
| Blocages | **BLOQUÉ PAR GEL P0 / DÉPENDANCE EXTERNE** (fournisseur, clés, webhooks) |

## 8. CRM
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Leads/contacts, statuts pipeline, notes, relances |
| Rôle autorisé | `saas_admin` (CRM plateforme, selon modèle 0018) |
| Action attendue | Créer/lire/mettre à jour/suivre pipeline, exporter si prévu |
| Résultat attendu | Données persistées, pipeline cohérent, accès restreint |
| Contrôles de sécurité | RLS saas_admin-only (prévu 0018), validations, audit si applicable |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (local/simulation)** : route `/super-admin/crm/` rendue ; helpers/tests unitaires présents (32/32 suite globale). Données/flux réels non validés |
| Preuves attendues | CRUD réel en env isolé, policies effectives, non-accès autres rôles |
| Blocages | Gel P0, migration 0018/0029 état distant inconnu |

## 9. WhatsApp & notifications
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Destinataires, modèles/messages, événements déclencheurs |
| Rôle autorisé | `saas_admin` / rôles autorisés selon config |
| Action attendue | Configuration et suivi ; **aucun envoi réel sans fournisseur** |
| Résultat attendu | Envois réels tracés, gestion erreurs/quotas, opt-in/conformité selon cadre |
| Contrôles de sécurité | Secrets côté serveur, permissions, audit, aucune simulation d’envoi présentée comme réelle |
| Résultat des tests (actuel) | **IMPLÉMENTÉ MAIS NON VALIDÉ (UI honnête)** : route `/super-admin/whatsapp/` rendue en E2E mock ; **aucun envoi réel** |
| Preuves attendues | Messages tests sandbox/fournisseur, accusés/statuts, logs |
| Blocages | **BLOQUÉ PAR GEL P0 / DÉPENDANCE EXTERNE** |

## 10. Chatbot & automatisations
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Prompts/config, déclencheurs, contexte autorisé |
| Rôle autorisé | `saas_admin` |
| Action attendue | Configuration/suivi ; **aucune exécution IA réelle sans fournisseur/config** |
| Résultat attendu | Réponses/actions conformes, traçabilité, maîtrise coûts/quotas |
| Contrôles de sécurité | Pas de fuite données sensibles, permissions, validation sorties, aucune fausse métrique/exécution présentée comme réelle |
| Résultat des tests (actuel) | **IMPLÉMENTÉ MAIS NON VALIDÉ (UI honnête)** : route `/super-admin/chatbot/` rendue en E2E mock |
| Preuves attendues | Exécutions tests contrôlées, journaux, limites/erreurs gérées |
| Blocages | **BLOQUÉ PAR GEL P0 / DÉPENDANCE EXTERNE** |

## 11. Support & tickets
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Tickets, messages, catégories/priorités/statuts, rattachement tenant |
| Rôle autorisé | `saas_admin`, et utilisateurs tenant selon règles (cible) |
| Action attendue | Créer/consulter/répondre/changer statut, filtrer |
| Résultat attendu | Visibilité conforme (SA global, tenant limité), historique cohérent |
| Contrôles de sécurité | RLS policies (0015), validation, PJ si prévues avec contrôles d’accès |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/support/` rendue. Flux réel/PJ non validés |
| Preuves attendues | Tickets tests isolés, refus accès croisé, transitions de statut tracées |
| Blocages | Gel P0, état migration 0015 distant inconnu |

## 12. Utilisateurs, rôles & permissions
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Utilisateurs, rôles (saas_admin/manager/employee/client), permissions par module/établissement |
| Rôle autorisé | `saas_admin` (administration plateforme) ; manager selon périmètre tenant |
| Action attendue | Attribuer/modifier rôles et permissions, activer/désactiver |
| Résultat attendu | Moindre privilège, effet immédiat et cohérent, traçabilité |
| Contrôles de sécurité | Garde fail-closed, RBAC/RLS serveur, refus élévation de privilèges, isolation inter-entreprises |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (local/simulation)** : garde client `SuperAdminGuard` (fail-closed), refus profil non-SA en E2E mock, route `/super-admin/roles/` rendue. **Non prouvé** : RBAC/RLS effectif en base |
| Preuves attendues | Matrice accès testée (autorisés/refusés), policies/grants effectifs, audit |
| Blocages | **Gel P0** (validation serveur) |

## 13. Rapports & BI
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Périmètres, périodes, agrégats, exports |
| Rôle autorisé | `saas_admin` |
| Action attendue | Consulter indicateurs, filtrer, exporter (formats prévus) |
| Résultat attendu | Chiffres exacts, cohérents avec sources, exports exploitables |
| Contrôles de sécurité | Accès restreint, pas de fuite inter-tenant, performance requêtes (cible) |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/rapports/` rendue (desktop/mobile). Exactitude sur données réelles non validée |
| Preuves attendues | Recalculs vs base, exports vérifiés, contrôles d’accès |
| Blocages | Données réelles/serveur (gel P0) |

## 14. Audit & journalisation
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Événements sensibles (connexions/actions admin, changements plans/statuts, onboarding, etc.) |
| Rôle autorisé | `saas_admin` (lecture/consultation selon règles) |
| Action attendue | Consulter, filtrer, tracer ; journal non altérable de manière non autorisée |
| Résultat attendu | Couverture des actions sensibles, horodatage/acteur/entité cohérents |
| Contrôles de sécurité | Écritures serveur contrôlées, RLS/policies de lecture appropriées, protection contre suppression/modification non autorisée |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/audit/` rendue. Journal serveur complet/protégé non prouvé |
| Preuves attendues | Événements générés par actions tests, impossibilité de modification non autorisée |
| Blocages | Gel P0, état RLS/tables audit distant inconnu |

## 15. Paramètres, sécurité & sauvegardes
| Élément | Détail préparé |
|---|---|
| Données d’entrée | Paramètres plateforme, options sécurité, état sauvegardes/intégrations |
| Rôle autorisé | `saas_admin` |
| Action attendue | Consulter/configurer dans les limites autorisées ; déclarer l’état réel des sauvegardes/intégrations |
| Résultat attendu | Config cohérente, aucune fausse assurance de sauvegarde/restauration, secrets protégés |
| Contrôles de sécurité | Pas d’exposition de secrets, changements sensibles audités, procédures de sauvegarde/restauration vérifiables |
| Résultat des tests (actuel) | **FAIT ET VÉRIFIÉ (simulation)** : route `/super-admin/parametres/` rendue. États réels infra/config non vérifiés |
| Preuves attendues | Paramètres effectifs (autorisés), preuve sauvegarde/PITR et test restauration |
| Blocages | **BLOQUÉ PAR GEL P0 / DÉPENDANCE EXTERNE** (infra, secrets, accès) |

---

## Synthèse de couverture (actuelle)
- **Local automatisé vert** : `tsc 0`, `lint 0`, `32/32` unitaires, `29/29` Playwright (**mocks réseau Supabase, build statique**), `build 0`.
- **Couverture fonctionnelle réelle 15 modules** : **aucun module validé bout-en-bout en conditions réelles** ; majoritairement **PARTIEL / IMPLÉMENTÉ MAIS NON VALIDÉ** ou **BLOQUÉ** (intégrations/serveur).
- **Priorité après levée ciblée du gel** : audit distant read-only → sauvegarde/PITR → migrations/RLS/RPC durcies → EF/Auth/SMTP → onboarding réel (env isolé) → scénarios modules avec comptes test → intégrations sandbox → non-régression et preuves.

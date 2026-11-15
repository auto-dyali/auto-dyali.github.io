# Préparation des intégrations externes (paiements, WhatsApp, chatbot/IA, sauvegardes)

> **Statut : PRÉPARÉ / NON INTÉGRÉ EN RÉEL.** Gel P0 actif. **Aucun paiement, aucun envoi WhatsApp, aucune exécution IA, aucune sauvegarde/restauration** n’est effectué ni simulé comme réel dans ce document. Toute mise en œuvre nécessite autorisations, configurations, accès fournisseurs/infra, et levée ciblée du gel pour les actions concernées. **Aucun secret** (clés API, tokens, webhooks secrets, identifiants, mots de passe) ne doit être consigné.

## Principes transverses
- **Réel ≠ simulation** : ne jamais présenter un mock, un log local ou une UI comme une preuve d’exécution externe réelle.
- **Sécurité** : secrets uniquement côté serveur/coffre sécurisé, moindre privilège, rotation possible, aucune exposition client/logs.
- **Fiabilité** : idempotence (webhooks/appels), retries contrôlés, gestion d’erreurs/timeouts, observabilité/audit.
- **Conformité & coûts** : vérifier conditions fournisseur, quotas, tarifs, limites, zones géographiques, exigences légales/consentement (notamment notifications).
- **Tests** : environnements sandbox/test avec comptes/données isolés avant toute production.

---

## 1. Paiements SaaS

### Fournisseurs (à sélectionner/valider — non choisis ici)
- Exemples typiques (à évaluer selon marché/devise/besoins) : Stripe, PayPal, prestataire local (ex. CMI/Maroc) ou autre PSP compatible récurrence/facturation SaaS. **Choix effectif : NON DÉFINI / BLOQUÉ PAR DÉPENDANCE EXTERNE.**

### Configurations requises (préparation)
| Élément | Détail | Statut |
|---|---|---|
| Compte fournisseur (sandbox + prod) | Création, vérification, accès équipe autorisée | BLOQUÉ (autorisation/dépendance) |
| Méthodes/pricing | Abonnements, essais, renouvellements, devises (MAD/autre), taxes si applicables | À définir |
| Clés/identifiants | Clés API, IDs, secrets webhook stockés côté serveur uniquement | BLOQUÉ (secrets/config) |
| Webhooks | Endpoints HTTPS, vérification de signature, **idempotence** par identifiant d’événement, persistance événements | À implémenter/valider |
| Mapping métier | Lien événements paiement ↔ `subscriptions`/statuts/entitlements, audit | À valider avec schéma réel |
| UI/états | Affichage honnête (en attente/confirmé/échoué), aucune confirmation sans preuve fournisseur | IMPLÉMENTÉ MAIS NON VALIDÉ (UI honnête) |

### Webhooks, quotas, coûts, tests
- **Webhooks** : événements typiques (paiement réussi/échoué, abonnement créé/renouvelé/annulé, contestation) ; traitement idempotent, réponse rapide, file/retry si nécessaire.
- **Quotas/limites** : selon fournisseur (taux d’API, volume).
- **Coûts** : frais transaction/abonnement/changeback ; à chiffrer avant activation.
- **Tests requis (sandbox)** : parcours checkout/abonnement, échec carte, renouvellement, annulation, replay webhook (idempotence), incohérences/réconciliation, droits d’accès aux écrans.

### Risques
- Double traitement (sans idempotence), désynchronisation état abonnement/paiement, exposition de secrets, conformité fiscale/contractuelle non validée.

---

## 2. WhatsApp & notifications

### Fournisseurs (à sélectionner/valider)
- Exemples : WhatsApp Business Platform (Meta/Cloud API), BSP (Twilio, MessageBird, Infobip, 360dialog, etc.). **Choix effectif : NON DÉFINI.**

### Configurations requises
| Élément | Détail | Statut |
|---|---|---|
| Compte/numéro expéditeur | Vérification business/numéro, profils | BLOQUÉ |
| Templates/messages | Approbation templates, variables, langues | BLOQUÉ |
| API & secrets | Tokens/clés côté serveur, rotation | BLOQUÉ |
| Webhooks entrants/statuts | Réception statuts (sent/delivered/read/failed), signatures/validation, idempotence | À implémenter |
| Opt-in/consentement | Gestion consentement, désinscription, fenêtres de session selon politique Meta | À définir/valider |
| Journalisation | Traçabilité envois/erreurs sans contenu sensible excessif | À valider |

### Quotas, coûts, tests
- **Quotas** : limites de messagerie, qualité de numéro, tiering fournisseur.
- **Coûts** : par conversation/message selon catégorie/pays.
- **Tests requis** : envoi test (sandbox/numéro test), statuts, échecs, templates rejetés, opt-out, non-envoi sans consentement, aucune simulation présentée comme réelle.

### Risques
- Blocage numéro/templates, non-conformité consentement, fuite de données personnelles, coûts imprévus.

---

## 3. Chatbot & automatisations (IA)

### Fournisseurs/modèles (à sélectionner/valider)
- Exemples : OpenAI, Anthropic, Azure OpenAI, Mistral, Google, ou autre ; et/ou orchestrateurs. **Choix effectif : NON DÉFINI.**

### Configurations requises
| Élément | Détail | Statut |
|---|---|---|
| Compte fournisseur & clés | API keys côté serveur, limites de dépense | BLOQUÉ |
| Modèle(s) & paramètres | Choix modèle, température, limites tokens, garde-fous | À définir |
| Contexte/données | Minimisation des données, filtrage PII/secrets, périmètre par tenant | À concevoir/valider |
| Prompts & politiques | Instructions système, refus cas sensibles, traçabilité | À définir |
| Observabilité | Logs d’exécution (sans secrets/PII inutiles), métriques réelles uniquement | À implémenter |

### Quotas, coûts, tests
- **Quotas** : rate limits, TPM/RPM, contexte max.
- **Coûts** : par token/requête ; plafonds/budgets à configurer.
- **Tests requis** : réponses attendues sur cas contrôlés, refus/hallucinations critiques, isolation tenant, gestion indisponibilité fournisseur, **aucune fausse exécution/métrique**.

### Risques
- Fuite de données vers tiers, réponses incorrectes/actionnables sans contrôle, coûts non maîtrisés, dépendance fournisseur.

---

## 4. Sauvegardes & restaurabilité (intégration/infra)

### Périmètre
- Base Supabase/Postgres, objets auth (selon capacités), stockage fichiers si utilisé, configuration critique (sans secrets).

### Éléments à préparer/valider
| Élément | Détail | Statut |
|---|---|---|
| Sauvegardes automatiques/PITR | Activation, rétention, fréquence, couverture | **NON VÉRIFIABLE** sans accès infra (BLOQUÉ) |
| Exports contrôlés | Procédure, stockage sécurisé, intégrité | Procédure préparée (`docs/PROCEDURE_SAUVEGARDE_RESTAURATION_VERIFIABLE.md`) |
| Restauration | Runbook, environnement de test isolé, RTO/RPO cibles | **NON PROUVÉ** |
| Alertes/monitoring | Échec backup, capacité, dérive | À configurer (dépendance infra) |
| Preuves | Tests de restauration documentés (avant/après) | BLOQUÉ |

### Tests requis (après autorisation)
- Vérification existence sauvegarde/PITR, restauration en environnement isolé, contrôles intégrité schéma/données/fonctions/RLS, mesure RTO/RPO.

---

## Matrice de dépendances et autorisations
| Intégration | Dépendances externes | Autorisations/config requises | État |
|---|---|---|---|
| Paiements | PSP, sandbox/prod, webhooks publics | Compte, clés, endpoints, mapping métier | BLOQUÉ |
| WhatsApp | BSP/Meta, numéro, templates | Compte, tokens, consentement, webhooks | BLOQUÉ |
| Chatbot/IA | Fournisseur modèle | Compte, clés, politique données/coûts | BLOQUÉ |
| Sauvegardes/restauration | Infra Supabase/hébergement | Accès, PITR/exports, env test | BLOQUÉ / NON PROUVÉ |

**Conclusion** : intégrations **documentées et préparées** au niveau procédure/contrôles/tests ; **aucune intégration réelle active ou prouvée**. Toute activation future devra être exécutée de façon contrôlée, vérifiable, et consignée en GV5, sans jamais simuler le réel.

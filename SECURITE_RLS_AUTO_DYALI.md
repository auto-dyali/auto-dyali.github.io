# SÉCURITÉ / RLS — AUTO DYALI

## Principes appliqués

- Isolation multi-établissements via `establishment_id` ; le serveur (RPC `security definer`, `current_establishment_id()`) vérifie l’identité et l’établissement autorisé — jamais un `establishment_id` librement choisi par le frontend pour les opérations critiques (ventes, caisse, admin).
- RLS activée sur les tables métier ; aucune désactivation pour faire fonctionner une fonctionnalité.
- RPC admin (`admin_*`, `complete_*_account`) réservés aux rôles autorisés ; contraintes d’unicité `(establishment_id, reference)` et `(establishment_id, number)` pour l’idempotence.

## Tables sensibles à vérifier (priorité)

Produits, stock (`stock_movements`, `product_lots`), ventes (`sales`, `sale_items`), paiements, clients, véhicules, interventions (`work_orders`), employés, fournisseurs, achats (`purchase_orders`), factures (`invoices`), dépenses, chèques, notifications (`client_notifications`, consentements `clients.consents`).

## Points d’attention relevés

- Permission remise/crédit contrôlée côté client (permissions) **et** côté serveur (RPC) — le serveur reste juge final.
- `create_pos_sale_v2` recalcule les totaux côté serveur ; `create_pos_sale` (0021) reste fonctionnel pour compatibilité.
- Jeton WhatsApp Business jamais exposé dans le navigateur (lecture `process.env` côté serveur uniquement) ; aucun envoi simulé.
- Clés Supabase publiques (`NEXT_PUBLIC_*`) uniquement dans le frontend ; aucune clé privée.
- Audit log (`audit_log`) pour les opérations sensibles ; journal d’envoi WhatsApp à compléter (`attente/envoyé/livré/échec`).

## Vérifications restantes (bloquées sans accès base)

Tests RLS par rôle (manager/employé/client), isolation inter-garages, index sur `establishment_id`, et politiques des tables listées ci-dessus. Ne jamais exécuter de migration destructive sans validation humaine et plan de retour arrière.

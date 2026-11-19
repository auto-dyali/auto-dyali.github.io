# GV5 §61 — Audit des foreign keys et index

Date : 17 novembre 2026. Réinventaire par SELECT sur pg_constraint/pg_index. Aucune modification.

## 1. Constats

~96 entrées de contraintes FK (certaines contraintes multicolonnes apparaissent plusieurs fois), dont 16 couvertes par un index menant et ~80 sans index. L estimation du §60 (80 FK / 16 indexées) est confirmée dans l ordre de grandeur.

## 2. Répartition par domaine

- **Hors périmètre (garages)** : la majorité des FK manquantes concerne POS, stock, atelier, achats, clients/vehicles (appointments, work_orders, sale_items, purchase_order_items, stock_movements...). Conformément aux consignes, ces tables ne sont PAS modifiées.
- **Périmètre Super Admin** : audit_log.establishment_id, profiles.establishment_id, support_tickets.establishment_id, crm_leads.owner_id / converted_establishment_id, subscriptions.plan_code, onboarding_requests.establishment_id/manager_user_id.

## 3. Recommandations (périmètre SA uniquement)

| Index | Justification | Priorité |
|---|---|---|
| audit_log(establishment_id) | filtre journal par établissement (RLS + UI) | P2 |
| profiles(establishment_id) | helpers isolation + RLS | P2 |
| support_tickets(establishment_id) | file tickets SA | P2 |
| crm_leads(owner_id) | CRM commercial | P3 |
| subscriptions(plan_code) | répartition formules / KPI | P3 |

Notes : faible volume actuel (2 établissements) → impact limité ; index peu coûteux. Utiliser CREATE INDEX CONCURRENTLY (hors transaction) en production. Voir script 005 (commandes commentées, non exécutées). Impact sur DELETE/UPDATE : absence d index sur FK peut provoquer des scans séquentiels lors de la validation de contrainte sur la table référencée.


# AUTO+ — Architecture v1

SaaS automobile multi-établissements pour ACH GROUP.

## Stack
| Couche | Choix |
|--------|-------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 |
| Backend | API Routes intégrées Next.js |
| BDD/Auth/Storage | Supabase (PostgreSQL) — credentials à venir |
| CI | GitHub Actions (par phase) |
| Design | Fidèle maquette : `#102B32` fond, `#193A40/#21464B` cartes, or `#D6B66F/#E9D998` |

## Multi-tenant
- Table pilier : `establishments`
- Toute table métier porte `establishment_id`
- **RLS activée partout** : `current_establishment_id()` déduit du profil authentifié
- Rôles : `saas_admin`, `manager`, `employee`, `client` (`user_role`)
- Journal des opérations sensibles : `audit_log`

## Modules (maquette + prompt fonctionnelle)
1. Véhicules & clients — `clients`, `vehicles`, `maintenance_reminders`
2. Atelier / OR — `work_orders`, `work_order_tasks`
3. POS — `sales`, `sale_items`, `payments`, `invoices`
4. Stock — `products`, `product_lots`, `stock_movements`, `inventory_counts`
5. Achats & fournisseurs — `suppliers`, `purchase_orders(+items)`
6. Caisse & finances — `cash_sessions`, `expenses`, rapports
7. Planning & réservation — `appointments`
8. RH — `employees`, `attendance`, `permissions`
9. Espace client — notifications, suivi, factures

## Phases
- [x] PHASE 1 — Audit (maquette analysée, dépôt vierge)
- [ ] PHASE 2 — Architecture (schéma SQL prêt, pending credentials Supabase)
- [ ] PHASE 3 — Écrans maquette (splash, login, dashboards manager/employé)
- [ ] PHASE 4 — Modules métier
- [ ] PHASE 5 — Backend/BDD (migrations + RLS + seed)
- [ ] PHASE 6 — Intégration
- [ ] PHASE 7 — Tests
- [ ] PHASE 8 — Optimisation
- [ ] PHASE 9 — Livraison

# GV5 §61 — Matrice des privilèges EXECUTE (15 fonctions)

Date : 17 novembre 2026. Légende : ✓ = autorisé, ✗ = interdit, — = sans objet.

| Fonction | PUBLIC/anon actuel | authenticated actuel | Nécessaire | À interdire | Justification | Risque révocation | Test non-régression |
|---|---|---|---|---|---|---|---|
| admin_* (8) | ✓ (proacl) | ✓ | ✓ (garde interne) | PUBLIC | Garde is_saas_admin avant opération | aucun (anon rejeté par garde) | appel saas_admin OK / anon permission denied |
| decrement_product_stock | ✓ | ✓ | ✓ (manager) | PUBLIC | garde is_manager() or is_saas_admin() | aucun si is_manager durci | appel manager OK |
| my_features | ✓ | ✓ | ✓ (authenticated) | PUBLIC | lecture entitlement non sensible | anon perdit lecture (non utilisé) | dashboard KPI unchanged |
| open_ticket_count | ✓ | ✓ | ✓ (authenticated + filtre tenant) | PUBLIC | P1 : pas de garde interne, corriger aussi le filtre | anon perdit comptage (souhaitable) | compte tickets establishment correct |
| is_saas_admin | ✓ (défaut) | ✓ | ✓ (via policies) | PUBLIC | helper utilisé par RLS (SECURITY DEFINER) | si policy appelée par anon→refus (attendu) | connexion SA OK |
| current_establishment_id | ✓ (défaut) | ✓ | ✓ | PUBLIC | isolation via auth.uid() | aucun | RLS tenant OK |
| autoplus_current_role | ✓ (défaut) | ✓ | ✓ | PUBLIC | provenance auth.uid() | aucun | rôle manager OK |
| is_manager | ✓ (défaut) | ✓ | ✓ (durcir DEFINER+search_path) | PUBLIC | correction A3 | aucun | decrement stock OK |

## Rôles

| Rôle | Droits attendus |
|---|---|
| PUBLIC / anon | AUCUNE fonction de cette liste (sauf resolve_login_email prévu 0039) |
| authenticated | helpers + my_features + open_ticket_count (avec filtre) ; admin_* seulement si is_saas_admin() vrai |
| Manager | helpers + decrement_product_stock ; pas de admin_* |
| saas_admin | toutes (garde interne) |
| propriétaire (postgres) | toujours EXECUTE (propriétaire) |

Note : distinguer privilège EXECUTE (contrôle d accès PostgreSQL) du garde interne is_saas_admin() (contrôle applicatif). Les deux sont nécessaires : le garde protège même si EXECUTE est accordé à authenticated.


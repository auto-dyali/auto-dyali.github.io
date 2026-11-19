# GV5 §64 — Tests multi-tenant réels (protocole PRÉPARÉ — NON EXÉCUTÉ)

Date : 17 novembre 2026. Aucun test réel exécuté (pas de staging). Les seuls tests exécutés sont les 10 simulations Node de §62 (logiqueSQL, données fictives) — ils ne prouvent pas l isolation PostgreSQL.

## Jeu de test synthétique à créer sur staging

Est A + Manager A, Est B + Manager B, 1 saas_admin, 1 profil sans établissement, 1 session anonyme, tickets : 2 ouverts en A, 1 ouvert en B.

## Matrice des tests réels à exécuter

| # | Test | Appelant | Attendu | Statut |
|---|---|---|---|---|
| 1 | open_ticket_count(A) | Manager A | 2 | BLOCKED |
| 2 | open_ticket_count(B) avec paramètre B | Manager A | 2 (retourne A, pas B) | BLOCKED |
| 3 | open_ticket_count(A) avec paramètre A | Manager B | 1 (retourne B, pas A) | BLOCKED |
| 4 | SELECT support_tickets croisé | Manager A | 0 ligne de B (RLS) | BLOCKED |
| 5 | admin_change_plan | Manager A | exception Accès refusé | BLOCKED |
| 6 | admin_change_plan | saas_admin | succès + audit_log | BLOCKED |
| 7 | is_saas_admin() | anon | permission denied | BLOCKED |
| 8 | Élévation par paramètre client p_role | Manager A | aucun effet | BLOCKED |
| 9 | Profil sans établissement | user orphan | 0 | BLOCKED |
| 10 | Session expirée | token expiré | refus | BLOCKED |

Chaque test devra conserver : préconditions, action, résultat attendu, résultat réel, preuve, statut PASS/FAIL/BLOCKED. Tests à exécuter avec de vrais appels PostgreSQL/Supabase sur staging (pas uniquement des mocks). **Aucun test réel effectué dans cette mission.**


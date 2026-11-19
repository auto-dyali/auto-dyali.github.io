# GV5 §63 — Protocole de validation multi-tenant réelle

Date : 17 novembre 2026. Protocole PRÉPARÉ — NON EXÉCUTÉ. Doit être joué sur un environnement de staging isolé (ou transaction de test contrôlée), jamais sur la production.

## 1. Jeu de test (données FICTIVES à créer en staging)

- Établissement A + Manager A (profil role=manager, establishment_id=A).
- Établissement B + Manager B (profil role=manager, establishment_id=B).
- 1 saas_admin, 1 utilisateur sans établissement, 1 session anonyme.
- Tickets de test : 2 ouverts en A, 1 ouvert en B.

## 2. Isolation (open_ticket_count et RLS tickets)

| Test | Appelant | Résultat attendu |
|---|---|---|
| Manager A sur A | A | 2 (ses tickets) |
| Manager A sur B (paramètre B) | A | 2 (retourne A, pas B) |
| Manager B sur A (paramètre A) | B | 1 (retourne B, pas A) |
| Sans établissement | profil establishment_id NULL | 0 |
| Anonyme | anon | 0 (ou permission denied après revoke PUBLIC) |
| saas_admin sur B | admin | 1 (exception autorisée) |
| SELECT support_tickets croisé | Manager A | 0 ligne de B (RLS) |

## 3. Super Admin et privilèges

- `is_saas_admin()` : anon → permission denied (après correction) ; Manager A → false ; saas_admin → true.
- Tentative d élévation par paramètre client (ex. p_role=saas_admin) → aucun effet (les fonctions lisent auth.uid()/profiles).
- admin_change_plan par Manager A → exception « Accès refusé » (garde interne).
- admin_change_plan par saas_admin → succès + ligne audit_log.

## 4. Permissions EXECUTE

- `aclexplode(grantee=0)` sur les 15 fonctions → 0 ligne après correction.
- authenticated conserve EXECUTE (non-régression) ; service_role inchangé (EF).
- resolve_login_email reste anon (seule exception, connexion pré-auth).

## 5. RLS et dépendances

- Vérifier absence de récursion : helpers SECURITY DEFINER lisent profiles sans boucle (propriétaire postgres contourne RLS).
- Vérifier qu aucune fonction SECURITY DEFINER ne contourne l isolation (open_ticket_count dérive bien auth.uid()).
- Vérifier 0 vue dans public (déjà confirmé en lecture seule).

## 6. Critères de réussite / NO-GO

GO si : tous les tests d isolation passent, 0 fuite cross-tenant, 0 EXECUTE PUBLIC résiduel, aucun appel légitime cassé. NO-GO si : un test d isolation échoue, une fuite est détectée, ou une régression d accès est observée.

Note : ces tests ne sont PAS des preuves de production. Ils doivent être exécutés sur staging après autorisation.


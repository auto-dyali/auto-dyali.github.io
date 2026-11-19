# GV5 §62 — Tests de sécurité et d'isolation multi-tenant

Date : 17 novembre 2026. Distinction stricte : tests LOCAUX SIMULÉS (exécutés) vs tests DISTANTS (non exécutés).

## 1. Tests locaux exécutés (SIMULÉS — données fictives)

Script : `scripts/test-security-062.mjs` (10 tests, miroir de la logique SQL corrigée).

| Test | Résultat |
|---|---|
| open_ticket_count : manager voit SON établissement | PASS |
| open_ticket_count : manager ne peut PAS lire un autre établissement (retour = compte de son tenant) | PASS |
| open_ticket_count : employee isolé sur son établissement | PASS |
| open_ticket_count : saas_admin peut interroger un établissement arbitraire (exception) | PASS |
| open_ticket_count : session anonyme / profil absent -> 0 | PASS |
| open_ticket_count : paramètre NULL -> tenant courant | PASS |
| open_ticket_count : profil sans établissement -> 0 | PASS |
| is_manager : manager->true, employee->false, admin->true | PASS |
| is_manager : anonyme / rôle absent / inconnu -> false | PASS |
| contrôle documentaire : aucun appel frontend de open_ticket_count | PASS |

Commande : `node --test scripts/test-security-062.mjs` → 10 tests, 10 pass, 0 fail (exit 0).

## 2. Limite de ces tests

Ces tests reproduisent la LOGIQUE des fonctions dans un environnement Node avec des données fictives. Ils **ne prouvent pas** le comportement de PostgreSQL/Supabase réel (résolution search_path, RLS, privilèges EXECUTE). Ils valident la conception des corrections uniquement.

## 3. Tests distants à exécuter après autorisation (NON EXÉCUTÉS)

- `is_manager` : manager authentifié → true ; non-manager → false ; saas_admin → true ; anonyme → permission denied (plus PUBLIC) ; test de substitution de schéma (créer une fonction autoplus_current_role factice dans un schéma writable, vérifier que le search_path immuable l'ignore).
- `open_ticket_count` : manager sur son établissement → compte correct ; manager sur un autre → compte de SON établissement (pas de fuite) ; anonyme → 0 ; saas_admin sur arbitraire → compte ; paramètre NULL / establishment inexistant.
- EXECUTE : aclexplode(grantee=0) → 0 ligne sur les 15 ; authenticated conserve EXECUTE (non-régression).
- Multi-tenant : 2 établissements de test, aucun accès croisé aux tickets, aucun contournement par paramètre frontend.


# GV5 §60 — Plan de tests distants (à exécuter après autorisation)

Date : 17 novembre 2026. Aucun test distant exécuté dans cette mission.

## A. Tests SQL de schéma

1. `select column_name from information_schema.columns where table_name='establishments' and column_name='professional_id'` → 1 ligne.
2. `select proname from pg_proc where proname in ('admin_onboard_tenant_v2','has_feature','resolve_login_email','admin_check_identity_available')` → 4 lignes.
3. `select to_regclass('public.invitations')` → non NULL.
4. `select p.proname from pg_proc p, aclexplode(p.proacl) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE' and p.prosecdef` → 0 ligne (après 0037).
5. Compter les FK indexées (objectif : proche de 80/80 après 0038).

## B. Tests de permissions par rôle

| Test | Rôle | Résultat attendu |
|---|---|---|
| Appel RPC admin_change_plan | anon | permission denied |
| Appel RPC admin_change_plan | authenticated non-saas_admin | exception « Accès refusé » (garde interne) |
| Appel RPC admin_change_plan | saas_admin | succès |
| SELECT établissement d'un autre tenant | manager | 0 ligne (RLS) |
| SELECT établissement du tenant | manager | 1 ligne |
| Appel is_saas_admin() | anon | permission denied (après 0037) |

## C. Tests fonctionnels onboarding/activation

1. Créer un abonné test (EF onboard-tenant) → établissement + Manager + abonnement + permissions cohérents.
2. Doublon professional_id/login/email → refus serveur.
3. Idempotence : même requestId 2× → 1 seul abonné.
4. Preview activation → jeton non consommé ; activation → consommé ; réutilisation → refus.
5. Invitations e-mail seul / WhatsApp seul / les deux → statuts indépendants.
6. Aucun mot de passe en clair dans Auth metadata, tables, audit_log, réponses EF.

## D. Tests de non-régression

- Connexion Super Admin inchangée après 0037 (get_my_profile reste accessible à authenticated).
- Dashboard et 11 sections se chargent avec des données réelles.
- Aucune donnée de production modifiée pendant les tests.

## E. Critères de réussite

Tous les tests A–D passent ; 0 fonction SECURITY DEFINER avec EXECUTE PUBLIC ; parcours complet validé sur un compte de test ; aucune transaction/facture/paiement réels créés.

Ces tests restent **NON EXÉCUTÉS** tant que l'autorisation distante n'est pas donnée. Les mocks locaux ne les remplacent pas.


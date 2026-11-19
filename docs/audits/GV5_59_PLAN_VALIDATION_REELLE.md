# GV5 §59 — Plan de validation réelle Supabase (nécessite autorisation)

Ce plan décrit les étapes à exécuter APRÈS autorisation explicite et sauvegarde/PITR vérifiée. Aucune de ces étapes n'a été exécutée dans cette mission.

## Prérequis

1. Autorisation explicite du propriétaire pour toute opération distante.
2. Sauvegarde/PITR vérifiée et restaurable du projet nxmsqqoflskfajqrqddw.
3. Audit read-only de l'état réel (déjà partiellement fait en §59 : voir matrice sécurité).
4. Environnement de test (projet Supabase de staging idéalement) avant production.

## Ordre d'exécution

1. **0036_invitations_manager** — vérifier pgcrypto, 0028, is_saas_admin. Crée tables invitations + événements, hash token, statuts par canal.
2. **0037_fix_security_p0** — revoke PUBLIC sur helpers + admin_*, is_manager SECURITY DEFINER. **Tester après : has_function_privilege(PUBLIC)=false sur is_saas_admin/current_establishment_id/autoplus_current_role, mais EXECUTE authenticated conservé** (ne pas casser les RPC). Ne pas activer FORCE RLS.
3. **0038_security_rls_indexes** — policies restrictives + index FK.
4. **0039_onboarding_identity_v2** — colonnes professional_id/login_id/must_change_password, RPC v2, get_my_security_state, resolve_login_email (anon), my_features/has_feature.

## Tests SQL de vérification

- `select column_name from information_schema.columns where table_name='establishments' and column_name='professional_id'` → 1 ligne.
- `select proname from pg_proc where proname in ('admin_onboard_tenant_v2','has_feature','resolve_login_email')` → 3 lignes.
- `select p.proname from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where r.rolname='PUBLIC' and p.prosecdef` → vide.
- Vérifier `grant execute` conservé à authenticated sur admin_* (régressions d'accès).

## Tests fonctionnels (après déploiement EF + secrets)

1. Déployer EF onboard-tenant/activate-manager/send-invitation + configurer RESEND_API_KEY, WHATSAPP_* (secrets serveur uniquement).
2. Créer un abonné de test avec identifiant pro unique → vérifier établissement + profil Manager + abonnement + permissions créés de façon cohérente (atomique).
3. Tenter un doublon d'identifiant pro / login / e-mail → refus serveur (collisions gérées).
4. Vérifier idempotence : même requestId 2 fois → 1 seul abonné.
5. Ouvrir le lien d'activation sans soumettre → jeton NON consommé. Soumettre → mot de passe défini, jeton consommé. Réutiliser le lien → refus.
6. Invitations : e-mail seul, WhatsApp seul, les deux → statuts indépendants, échec de l'un n'annule pas l'autre.
7. Vérifier qu'aucun mot de passe en clair n'apparaît dans Auth metadata, tables, audit_log ou réponses EF.
8. Tester isolement multi-tenant : un Manager ne voit que son établissement (RLS).
9. Vérifier connexion par identifiant Manager (resolve_login_email) et rotation obligatoire si must_change_password.

## Critères de réussite

- Toutes les colonnes/fonctions/tables présentes en distant.
- Aucun EXECUTE PUBLIC sur les helpers SECURITY DEFINER.
- Parcours onboarding→activation→connexion complet sur un compte de test.
- Aucune donnée réelle de production modifiée pendant les tests.

## Retour arrière

Chaque migration est additive (pas de DROP de données). En cas d'échec : restaurer le PITR / sauvegarde d'avant migration. Pour 0037 spécifiquement : si des accès légitimes cassent, ré-accorder `grant execute ... to authenticated` (déjà prévu dans la migration). Pour 0039 : les colonnes ajoutées peuvent être laissées (nullables) sans casse si le déploiement est différé. Aucune suppression de table à prévoir.

## Décisions requises avant exécution

- Autorisation explicité pour application des migrations sur la production.
- Choix staging vs production pour le premier passage.
- Décision sur A-08 (renforcement regex professional_id : risque de casser les identifiants historiques).


# GV5 §61 — Guide des scripts SQL de remédiation

Date : 17 novembre 2026. Dossier : supabase/security/remediation_061/. TOUS LES SCRIPTS SONT PRÉPARÉS — NON EXÉCUTÉS.

## 1. Fichiers

| Script | Rôle | Type | Exécution |
|---|---|---|---|
| 001_inventory.sql | inventaire 15 fonctions, PUBLIC, RLS, FK | SELECT seul | rejouable |
| 002_execute_public_corrections.sql | revoke PUBLIC + grant authenticated (15 fns) | DCL | après autorisation |
| 003_helper_function_hardening.sql | is_manager DEFINER + search_path + appel qualifié | DDL | après autorisation |
| 004_rls_policy_review.sql | revue policies / tables sans policy / vues | SELECT seul | rejouable |
| 005_fk_index_recommendations.sql | recommandations index SA (commentées) | DDL commenté | décision |
| 006_post_remediation_verification.sql | vérifications après correction | SELECT seul | après correction |

## 2. Prérequis et ordre

1. Sauvegarde/PITR vérifiée. 2. Autorisation explicite. 3. Rejouer 001 pour état à jour. 4. Appliquer 002 puis 003. 5. Décider sur 005. 6. Rejouer 006. 7. Si migrations 0036-0039 appliquées, vérifier qu elles ne réintroduisent pas PUBLIC (elles contiennent déjà revoke+grant).

## 3. Compatibilité 0036-0039

- 0037 contient déjà les mêmes `revoke from public` + `grant authenticated` que 002 → si 0037 est appliquée après 002, les commandes sont redondantes mais inoffensives (revoke sur déjà révoqué = no-op).
- 0037 contient déjà le durcissement is_manager de 003 → idem.
- Risque de réintroduction : aucune des migrations ne re-accorde PUBLIC. 0039 accorde anon uniquement à resolve_login_email (volontaire, connexion pré-auth).
- Ordre recommandé : appliquer 0036-0039 d abord (inclut 0037), puis 002/003 seulement si un résidu PUBLIC subsiste (002/003 servent de filet de sécurité).

## 4. Sécurité des scripts

Aucun DROP, aucune suppression de données, aucun ALTER TABLE, aucun GRANT excessif (pas de PUBLIC, pas de anon sauf prévu). Signatures exactes vérifiées via pg_get_function_identity_arguments. CREATE INDEX CONCURRENTLY commenté (doit être hors transaction).


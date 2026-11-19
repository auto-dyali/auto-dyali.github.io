# GV5 §69 — Matrice des blocages (traités individuellement)

Date : 18 novembre 2026. Mission d exécution : chaque voie a été réellement tentée. Aucune opération distante de modification effectuée.

| Blocage | Tentative réelle effectuée | Résultat vérifié | État final | Action exacte attendue du propriétaire |
|---|---|---|---|---|
| B1 Staging | recherche outils MCP (`create_project`/`list_projects`), CLI supabase, Docker, psql, sessions navigateur | tous absents ; MCP = production `nxmsqqoflskfajqrqddw` ; Dashboard → `/sign-in` | **BLOQUÉ** | Créer un projet Supabase dans dashboard.supabase.com (New project) et fournir son URL + ID (distincts de nxmsqqoflskfajqrqddw) |
| B2 PITR | inspection outils MCP backup/PITR, `query_logs` | aucun outil ; table edge_logs inaccessible | **BLOQUÉ — NON VÉRIFIÉ** | Dans le Dashboard du projet staging : Settings → Database → Backup/PITR, vérifier « PITR available » et fournir une capture du dernier point restaurable |
| B3 Migrations 0036-0039 | SELECT production : 0 RPC v2, 0 colonne, 0 table invitation | confirmé non appliquées | **BLOQUÉ** | Autorisation explicite d appliquer 0036→0039 sur le staging (jamais production) |
| B4 EF v2 | get_edge_function : onboard-tenant v1 ACTIVE ; activate/send absentes ; recherche logs | confirmé | **BLOQUÉ** | Autorisation de déployer les 3 EF v2 sur staging (code local prêt) |
| B5 Secrets | `.env.local` = publishable uniquement ; recherche variables | RESEND_API_KEY / WHATSAPP_* absents | **BLOQUÉ** | Configurer les secrets dans Dashboard staging → Edge Functions → Secrets (valeurs jamais dans le chat) |
| B6 Sécurité SQL | SELECT pg_proc/proacl : is_manager INVOKER, 11 SECDEF PUBLIC | confirmé inchangé | **BLOQUÉ** | Autorisation d appliquer 0037 + §62 sur staging |
| B7 Destinataire test | recherche configuration de test | aucun destinataire autorisé | **BLOQUÉ** | Désigner un e-mail/téléphone de test (ou accepter un compte interne sans envoi réel) |

## Ce qui a réellement fonctionné

- 13/13 tests Edge Functions (statiques Node) exécutés avec succès : contrat partagé, compensation Auth, RPC v2, hash du jeton, preview sans consommation, usage unique, idempotence, canaux indépendants.
- 5/5 tests de cohérence contrat↔RPC (§67) exécutés avec succès.
- Validation locale complète : tsc 0, npm test 158/158, build OK.


## Complément — nouveau blocage B0 (staging créé mais non connecté)

| Blocage | Tentative réelle | Résultat vérifié | État final | Action attendue |
|---|---|---|---|---|
| B0 Cible MCP staging | get_project_url ; ajout serveur supabase-staging dans opencode.json ; search outils ; appel HTTP MCP staging | MCP = production ; aucun outil supabase-staging chargé ; 401 No access token sur URL directe | **BLOQUÉ** | Redémarrer la session OpenCode pour charger le serveur `supabase-staging`, puis confirmer `get_project_url` = `https://yocufscgninxiihwiepa.supabase.co` |

La production n a subi aucune modification. Le serveur `supabase` (production) reste configuré et inchangé dans opencode.json.

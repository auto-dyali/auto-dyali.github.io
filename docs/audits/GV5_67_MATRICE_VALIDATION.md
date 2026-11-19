# GV5 §67 — Matrice de validation

Date : 18 novembre 2026. Environnement accessible : PRODUCTION `nxmsqqoflskfajqrqddw` (confirmé par get_project_url). Aucun staging accessible.

| Élément | Méthode | Résultat | Statut |
|---|---|---|---|
| Identité projet MCP | get_project_url | https://nxmsqqoflskfajqrqddw.supabase.co = PRODUCTION | VÉRIFIÉ |
| Staging distinct | recherche outils MCP | aucun outil de liste/création de projet ; aucun staging confirmé | BLOQUÉ |
| Migration 0036-0039 | SELECT (RPC/colonnes/tables) | 0 RPC v2, 0 colonne, 0 table invitation | NON APPLIQUÉE |
| Sécurité SQL | SELECT pg_proc/proacl | is_manager INVOKER, 11 SECDEF PUBLIC | NON CORRIGÉE |
| EF déployée | list_edge_functions | onboard-tenant ACTIVE = v1 (ancienne) | DIVERGENCE v1/v2 |
| Contrat v2 local↔EF↔RPC | test statique scripts/test-contract-rpc-067.mjs | 5/5 pass (9 params + clés JSON + permissions + pas de MDP) | VALIDÉ LOCALEMENT |
| Création Auth réelle | — | non tentée (pas de staging/autorisation) | BLOQUÉ |
| Invitation e-mail réelle | — | secret RESEND_API_KEY absent | BLOQUÉ |
| Invitation WhatsApp réelle | — | secrets WHATSAPP_* absents, EF send-invitation non déployée | BLOQUÉ |
| Activation Manager réelle | — | EF activate-manager non déployée, tables absentes | BLOQUÉ |
| Isolation multi-tenant réelle | — | tests réels non exécutés (simulations Node uniquement) | BLOQUÉ |


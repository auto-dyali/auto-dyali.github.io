# GV5 §67 — Blocages restants

Date : 18 novembre 2026. Critère de réussite NON atteint (aucun compte Manager réel créé/invité/activé).

| # | Blocage | Preuve | Action précise attendue |
|---|---|---|---|
| B1 | Aucun staging accessible | MCP connecté à la PRODUCTION uniquement (URL confirmée). Aucun outil de création/listage de projet | Autorisation explicite de créer un projet Supabase de staging isolé + fournir son URL/ID |
| B2 | Sauvegarde/PITR non vérifiée | §64 : BLOQUÉ — RESTAURATION NON VÉRIFIÉE | Accès tableau de bord + autorisation d inspection/restauration d essai |
| B3 | Migrations non appliquées | SELECT : 0 RPC v2, 0 colonne professional_id/login_id/must_change_password, 0 table invitation | Autorisation d appliquer 0036→0039 sur staging (PITR vérifié d abord) |
| B4 | EF v1 déployée, v2 non déployée | list/get_edge_function : onboard-tenant v1 ; activate-manager et send-invitation absentes | Autorisation de déployer les 3 EF v2 sur staging |
| B5 | Secrets fournisseurs absents | adaptateurs prêts, env() RESEND_API_KEY / WHATSAPP_* vides | Fournir les secrets dans l environnement sécurisé (ne pas les coller dans le chat) + comptes Resend/Meta |
| B6 | Sécurité SQL non appliquée | is_manager INVOKER, 11 SECDEF PUBLIC | Autorisation d appliquer 0037 + correctifs §62 sur staging |
| B7 | Destinataire de test non autorisé | aucun e-mail/téléphone de test fourni | Fournir un destinataire de test autorisé (ou accepter un compte de test interne sans envoi réel) |

Aucune opération distante de modification effectuée dans cette mission.


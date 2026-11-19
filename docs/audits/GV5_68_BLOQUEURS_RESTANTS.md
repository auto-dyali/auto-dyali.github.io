# GV5 §68 — Blocages restants

Date : 18 novembre 2026. Critère de réussite NON atteint : aucun Manager réel sur staging.

| # | Blocage | Preuve | Autorisation / action précise |
|---|---|---|---|
| B1 | Staging absent | aucun outil MCP de création/liste de projet ; MCP = production | Créer un projet Supabase isolé + fournir URL/ID distincts |
| B2 | PITR non vérifié | §64 BLOQUÉ — RESTAURATION NON VÉRIFIÉE | Accès Dashboard + autorisation inspection/restauration d essai |
| B3 | Migrations 0036-0039 absentes | SELECT : 0 RPC v2, 0 colonne, 0 table invitation | Autorisation d appliquer sur staging |
| B4 | EF v1 en production, v2 non déployée | get_edge_function : onboard-tenant v1 ; activate/send absentes | Autorisation de déployer 3 EF v2 sur staging |
| B5 | Secrets fournisseurs absents | env() vides (noms documentés §68 checklist) | Configurer dans Dashboard staging (jamais dans le chat/repo) |
| B6 | Sécurité SQL non appliquée | is_manager INVOKER, 11 SECDEF PUBLIC | Autorisation d appliquer 0037 + §62 sur staging |
| B7 | Destinataire de test non autorisé | aucun fourni | Désigner un destinataire de test |

Aucune opération distante de modification effectuée. AUTO DYALI reste en cours.


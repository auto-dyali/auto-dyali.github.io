# GV5 §72 — Matrice de conformité (parcours abonné)

Statuts : CV=Conforme vérifié (staging, interface) / INV=Implémenté non vérifié / P=Partiel / B=Bloqué.

| # | Fonctionnalité | Statut | Preuve |
|---|---|---|---|
| 1 | Création garage depuis Super Admin | CV | E2E interface → Création confirmée |
| 2 | Identifiant pro unique généré | CV | ADY-PRO-9480C3 en base |
| 3 | Manager + login unique | CV | mgr.interface.1795014089951 |
| 4 | Offre BASIC/GOLD | CV | standard créé via interface |
| 5 | Durée 1/3/6/12/24 mois + personnalisée | CV | options présentes dans le formulaire |
| 6 | Essai indépendant | CV | 15j, sans réduire durée payante |
| 7 | Modules + permissions CRUD | CV | 1 permission réelle en base |
| 8 | Enregistrement transactionnel/idempotent | CV | RPC v2 + advisory lock |
| 9 | Fiche détaillée abonné | INV | modale fiche présente (§55) |
| 10 | Invitation e-mail | P | statut en_attente (secret absent, aucun envoi réel) |
| 11 | Invitation WhatsApp | B | secrets absents, non_demande |
| 12 | Statuts réels invitation | CV | en_attente / non_demande honnêtes |
| 13 | Activation mot de passe Manager | CV | interface /activer/ → accepted |
| 14 | Connexion identifiant Manager | CV | E2E → /tableau-de-bord/ |
| 15 | Isolation multi-tenant | INV | validée par appels HTTP §70, pas encore via interface |
| 16 | Modification/renouvellement/suspension | INV | actions RPC présentes, non testées via interface |
| 17 | Historique/journal | INV | audit_log alimenté, consultation interface non testée |

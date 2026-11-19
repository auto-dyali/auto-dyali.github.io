# GV5 §70 — Matrice de conformité (parcours abonné Manager)

Date : 18 novembre 2026. Statuts : CV=Conforme vérifié (staging) / INV=Implémenté non vérifié / P=Partiel / A=Absent / B=Bloqué.

| # | Étape | Statut | Preuve |
|---|---|---|---|
| 1 | Création établissement | CV | RPC v2 → 2 établissements créés réellement |
| 2 | professional_id unique | CV | ADY-PRO-ABC123 / DEF456, index unique |
| 3 | Création Manager Auth | CV | Auth Admin réel via EF → 25ed11b5-... |
| 4 | login_id unique | CV | mgr.reel.test, index unique |
| 5 | Plan + durée payante | CV | silver 12 mois / gold 24 mois |
| 6 | Essai indépendant | CV | 15 j et 30 j, sans réduire la durée payante |
| 7 | Modules + permissions CRUD | CV | 8 permissions via JWT Manager |
| 8 | Invitation (hash token) | CV | token_hash SHA-256 seul, invitation prepared |
| 9 | Envoi e-mail | B | secret RESEND_API_KEY absent — statut en_attente honnête |
| 10 | Envoi WhatsApp | B | secrets WHATSAPP_* absents — statut en_attente honnête |
| 11 | Activation compte | CV | EF activate-manager HTTP 200 status=activated |
| 12 | Mot de passe par Manager | CV | défini via EF, jamais en clair, must_change_password=false |
| 13 | Connexion + accès dashboard | CV | HTTP 200 + lecture établissement + isolation RLS [] |

Résumé : 11 CONFORME VÉRIFIÉ sur staging, 2 BLOQUÉ (fournisseurs). 0 non vérifié sur le parcours critique.


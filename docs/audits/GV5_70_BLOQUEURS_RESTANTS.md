# GV5 §70 — Blocages restants

Date : 18 novembre 2026. Parcours Manager RÉELLEMENT validé sur staging. Restent :

| # | Blocage | Action précise attendue |
|---|---|---|
| B1 | Envoi e-mail réel | Configurer `RESEND_API_KEY` + `EMAIL_FROM` (domaine vérifié) dans Dashboard staging → Edge Functions → Secrets |
| B2 | Envoi WhatsApp réel | Configurer `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION` (template approuvé Meta) |
| B3 | Destinataire de test réel | Fournir une adresse e-mail / numéro de test autorisé (actuellement domaine `.local` synthétique, aucun envoi réel fait) |
| B4 | EF temporaire `create-test-user` | Retirer manuellement du staging (aucun outil MCP de suppression d EF) |
| B5 | Sécurité SQL 0037 (REVOKE PUBLIC, is_manager) | Appliquer sur staging si souhaité, puis sur production avec autorisation DISTINCTE |
| B6 | Production | Aucune opération faite. Autorisation explicite séparée requise pour migrations / EF / données / secrets |

Aucun secret n a été demandé ni affiché. Aucun message réel envoyé. La production reste intacte.

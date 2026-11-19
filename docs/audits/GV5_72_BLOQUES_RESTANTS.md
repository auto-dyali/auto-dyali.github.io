# GV5 §72 — Blocages restants

| # | Blocage | Actionhumaine précise |
|---|---|---|
| 1 | Secrets e-mail Resend | Configurer RESEND_API_KEY + EMAIL_FROM (domaine vérifié) dans Dashboard Supabase |
| 2 | Secrets WhatsApp Meta | Configurer WHATSAPP_ACCESS_TOKEN, PHONE_NUMBER_ID, TEMPLATE_NAME, LANG, API_VERSION + template approuvé |
| 3 | Destinataire de test réel | Fournir e-mail/téléphone de test autorisé (actuellement .local synthétique) |
| 4 | EF temporaire create-test-user | Retirer manuellement du staging |
| 5 | Sécurité SQL 0037 staging | Appliquer REVOKE PUBLIC + is_manager DEFINER |
| 6 | Production | Autorisation DISTINCTE + PITR vérifié pour migrations/EF/secrets |

Aucun message réel envoyé, aucun secret exposé, production intacte.

# GV5 §66 — Matrice de conformité Super Admin

Date : 18 novembre 2026. Branche main @ 64359da. Audit ciblé du portail Super Admin.

| Exigence | État réel | Preuve / limite |
|---|---|---|
| 11 sections Super Admin | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | routes présentes, E2E 39/39 (mocks) |
| Onboarding 6 étapes (formulaire) | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | src/app/super-admin/onboarding/page.tsx ~972 L |
| Contrat v2 partagé | VALIDÉ LOCALEMENT | _shared/contract.ts, 20 tests contrat |
| Création Auth réelle Manager | BLOQUÉ | EF déployée = v1 ancienne (inviteUserByEmail), RPC v2 absente |
| Identifiants pro/login uniques | BLOQUÉ | colonne professional_id absente en distant, RPC admin_check_identity_available absente |
| Invitation e-mail réelle | BLOQUÉ | adaptateur Resend prêt (fetch réel), secret RESEND_API_KEY absent |
| Invitation WhatsApp réelle | BLOQUÉ | adaptateur Meta prêt, secrets WHATSAPP_* absents, EF send-invitation non déployée |
| Activation + mot de passe Manager | BLOQUÉ | EF activate-manager non déployée, tables invitations absentes |
| Icônes WhatsApp/Chatbot sidebar | CORRIGÉ ET VÉRIFIÉ | groupe Acces directs, 5 tests E2E, capture visuelle |
| Icônes dashboard accès rapide | CORRIGÉ ET VÉRIFIÉ | 2 cartes, états honnêtes, E2E |
| Statuts fournisseurs honnêtes | CONFORME | aucun « envoyé/délivré » sans preuve ; « Non configuré » affiché |
| Migrations 0036-0039 | BLOQUÉ AUTORISATION | non appliquées (vérifié SELECT : 0 RPC v2, 0 colonne, 0 table invitation) |


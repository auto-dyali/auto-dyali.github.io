# GV5 §66 — Blocages restants (P0)

Date : 18 novembre 2026. Aucune opération distante de modification effectuée.

| # | Blocage | Cause démontrée | Autorisation / action requise |
|---|---|---|---|
| P0-1 | Divergence EF déployée vs code local | EF `onboard-tenant` ACTIVE = version v1 (payload plat, `inviteUserByEmail`, RPC `admin_onboard_tenant`, essai max 90j). Code local = v2 (contrat imbriqué, `admin_onboard_tenant_v2`, token SHA-256, Resend/WhatsApp). Le formulaire local envoie un payload v2 à une EF v1 → incompatible. | Déployer la version locale v2 de `onboard-tenant` + `activate-manager` + `send-invitation` (autorisation explicite) |
| P0-2 | RPC v2 absentes | SELECT : `admin_onboard_tenant_v2`, `admin_check_identity_available`, `resolve_login_email`, `has_feature` = 0 | Appliquer migration 0039 (autorisation + sauvegarde/PITR) |
| P0-3 | Colonnes identité absentes | SELECT : professional_id / login_id / must_change_password = 0 | Migration 0039 |
| P0-4 | Tables invitations absentes | SELECT : `invitations` / `invitation_events` = 0 | Migration 0036 |
| P0-5 | Secrets fournisseurs absents | adaptateurs prêts mais RESEND_API_KEY, WHATSAPP_* non configurés | Fournir les secrets (sans les exposer) + validation compte Resend/Meta |
| P0-6 | Sécurité SQL non appliquée | 15 fonctions SECURITY DEFINER avec PUBLIC EXECUTE, is_manager INVOKER | Appliquer 0037 + correctifs §62 (autorisation) |

Conséquence : aucune création Auth réelle, aucun envoi e-mail/WhatsApp réel, aucune activation Manager réelle n'ont pu être vérifiés. Les tests locaux/E2E utilisent des mocks et ne prouvent pas le fonctionnement Supabase/fr fournisseurs.

Statut fournisseurs (honnête) : WhatsApp = « Non constatable côté navigateur » ; Chatbot IA = « Non configuré ». Aucun faux statut « connecté ».


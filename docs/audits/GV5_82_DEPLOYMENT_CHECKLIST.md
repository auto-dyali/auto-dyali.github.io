# AUTO DYALI — Checklist de préparation production (GV5 §82)

> Ce document **ne constitue pas une autorisation de déploiement**. Aucune commande ci-dessous n'a été exécutée contre la production `nxmsqqoflskfajqrqddw`.

## 1. Prérequis à obtenir du propriétaire
- [ ] Décision tarifaire des trois formules (messages, annuels) — aucun prix n'est codé dans le dépôt.
- [ ] Compte Stripe mode Live + clés serveur + `STRIPE_WEBHOOK_SECRET` + endpoint signé.
- [ ] Compte Resend + `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, domaine vérifié.
- [ ] Meta WhatsApp Business + `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION`, template approuvé.
- [ ] `ACTIVATION_BASE_URL` (domaine public d'activation).
- [ ] Destinataire de test autorisé (e-mail / téléphone).
- [ ] Autorisation explicite de déploiement production + créneau.
- [ ] Confirmation PITR et d'une sauvegarde restaurée avec succès dans un environnement sûr.

## 2. Configuration (à faire avec les valeurs du propriétaire, jamais collées dans un rapport)
```bash
# Tarifs — valeurs fournies par le propriétaire via variables d'environnement
GV581_URL=... GV581_KEY=... GV581_TOKEN=... \
GV581_STANDARD_MENSUEL=... GV581_STANDARD_ANNUEL=... \
GV581_SILVER_MENSUEL=... GV581_SILVER_ANNUEL=... \
GV581_GOLD_MENSUEL=... GV581_GOLD_ANNUEL=... \
node scripts/configure-plans.mjs
```
Les secrets des Edge Functions se configurent dans le tableau de bord Supabase (Settings → Edge Functions → Secrets), jamais dans le dépôt.

## 3. Ordre des migrations (staging validé, production à valider)
1. Fondation : `0001_init_schema`, `0009a/b`, `0010_super_admin_rpc`, `0028_onboarding_requests`.
2. Identité et invitations : `0036*`, `0039*`.
3. `073_archive_logique`.
4. `gv575_*` (RPC espace abonné, champs admin, correctifs, révocation anon).
5. `gv576_*` (champs admin à la création, garde-fou `is_saas_admin`).
6. `gv577_*` (révocation anon/public sur RPC admin).
7. `gv579_*` (demandes de souscription, colonnes POS, facturation SaaS).
8. `gv580_*` (purge establishment).

Avant production : `supabase db diff --linked` puis relecture de chaque migration et de ses fichiers `*_down.sql`.

## 4. Edge Functions à déployer
| Fonction | Version staging | Rôle |
|---|---|---|
| `onboard-tenant` | v2 | Création transactionnelle du garage/Manager |
| `send-invitation` | v2 | Relance par canal, statuts honnêtes |
| `activate-manager` | v1 | Activation par jeton signé |
| `stripe-webhook` | v1 | Vérification HMAC-SHA256 des événements |
| `create-test-user` | v3 inerte | Ne doit pas être déployée en production |

## 5. Retour arrière
- Chaque migration `gv57x/gv58x` possède un fichier `*_down.sql`.
- Procédure : arrêt des écritures → `supabase db reset` sur une copie → exécution des `*_down.sql` dans l'ordre inverse → vérification des tests.
- Les RPC de purge et de décision sont réversibles par suppression de fonction ; aucune table métier n'est supprimée par ces rollbacks.

## 6. Contrôles post-déploiement
- [ ] `select code, price_monthly, price_yearly, trial_days from plans` → 3 formules tarifées.
- [ ] Webhook Stripe : signature valide acceptée, signature invalide refusée, rejoué idempotent.
- [ ] Invitation réelle e-mail et WhatsApp vers le destinataire autorisé ; statuts indépendants.
- [ ] Connexion Super Admin + Manager ; isolation inter-garages.
- [ ] `get_advisors` sans nouvelle alerte critique ; `npm audit --omit=dev` à 0.
- [ ] Journaux d'audit et `saas_billing_events` cohérents.

## 7. Limites connues
- PITR : non vérifiable avec les outils MCP disponibles ; à contrôler dans le dashboard Supabase.
- Appareil physique : test manuel requis.
- `create-test-user` : suppression définitive nécessite le dashboard Supabase (aucun outil MCP de suppression d'EF).

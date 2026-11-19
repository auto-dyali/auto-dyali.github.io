# GV5 §68 — Checklist de configuration des fournisseurs

Date : 18 novembre 2026. Aucun secret n est demandé, inscrit ou affiché ici — uniquement leurs NOMS et l emplacement où les configurer.

## 1. Où configurer

Supabase Dashboard → projet STAGING → Edge Functions → Secrets. Les secrets du projet de production ne doivent jamais être réutilisés.

## 2. Resend (e-mail)

| Variable | Rôle |
|---|---|
| RESEND_API_KEY | clé API du compte Resend de test |
| EMAIL_FROM | expéditeur vérifié (domaine validé dans Resend) |
| EMAIL_REPLY_TO | adresse de réponse (optionnel) |
| ACTIVATION_BASE_URL | URL publique de la page /activer/ |

Prérequis : compte Resend de test, domaine expéditeur vérifié. Vérification : l adaptateur appelle `https://api.resend.com/emails` ; statut `accepte_par_fournisseur` sur HTTP 2xx, `echec` sinon. **Jamais « livré » sans webhook signé.**

## 3. Meta WhatsApp Business

| Variable | Rôle |
|---|---|
| WHATSAPP_ACCESS_TOKEN | jeton API Meta |
| WHATSAPP_PHONE_NUMBER_ID | identifiant du numéro professionnel |
| WHATSAPP_TEMPLATE_NAME | modèle approuvé par Meta |
| WHATSAPP_TEMPLATE_LANG | langue du modèle |
| WHATSAPP_API_VERSION | version Graph API |
| ACTIVATION_BASE_URL | même lien d activation |

Prérequis : app Meta, numéro vérifié, template approuvé, permissions d envoi. Vérification : appel `https://graph.facebook.com/{version}/{phoneNumberId}/messages`. Réponse 2xx = `accepte_par_fournisseur`. **Aucun statut livré/lu sans webhook.**

## 4. Supabase ( fourni par la plateforme aux EF )

SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (valeurs automatiques du projet staging — ne pas copier celles de la prod).

## 5. ChatGPT IA / paiements

Aucun secret IA ou paiement n est requis pour le parcours Manager. Si ajoutés plus tard : fournisseur IA = clé API côté serveur + quotas ; paiement = clé fournisseur + webhooks signés. À documenter séparément.

## 6. Procédure pour le propriétaire (sans exposer les valeurs)

1. Créer les comptes Resend / Meta de test.
2. Dans le Dashboard du projet STAGING, Edge Functions → Secrets, ajouter chaque variable avec sa valeur (jamais dans le chat, le dépôt ou un rapport).
3. Confirmer simplement « secrets configurés » — aucune valeur ne doit être partagée.
4. Je vérifierai ensuite le comportement via les statuts renvoyés par les adaptateurs (sans lire les valeurs).


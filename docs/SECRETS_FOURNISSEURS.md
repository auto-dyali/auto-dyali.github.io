# Configuration sécurisée des fournisseurs — AUTO DYALI / GV5

Aucune valeur de secret ne doit jamais être écrite dans le dépôt, un rapport, un log ou le chat. Le propriétaire configure les secrets **lui-même** dans :

`Supabase Dashboard → projet auto-dyali.github.io → Project Settings → Edge Functions → Secrets`

(équivalent CLI, exécuté par le propriétaire : `supabase secrets set --project-ref nxmsqqoflskfajqrqddw NOM=valeur`).

## E-mail — Resend (premier fournisseur)

| Paramètre | Rôle |
|---|---|
| `RESEND_API_KEY` | Clé API Resend avec droit d'envoi |
| `EMAIL_FROM` | Expéditeur vérifié dans Resend |
| `EMAIL_REPLY_TO` | Adresse de réponse (repli : `me.achbani@gmail.com`) |
| `ACTIVATION_BASE_URL` | Origine publique du lien `/activer/#token=…` |

Destinataires : Manager (`manager.email`) pour l'invitation, `admin@auto-dyali.ma` pour la notification Super Admin.

## WhatsApp — Meta Cloud API (premier fournisseur)

| Paramètre | Rôle |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Jeton Meta avec droit `whatsapp_business_messaging` |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant technique du numéro Business enregistré chez Meta |
| `WHATSAPP_TEMPLATE_NAME` | Modèle Utility approuvé pour l'invitation Manager (4 variables) |
| `WHATSAPP_TEMPLATE_LANG` | Langue du modèle (optionnel) |
| `WHATSAPP_API_VERSION` | Version de l'API Graph (optionnel) |
| `WHATSAPP_ADMIN_TEMPLATE_NAME` | Modèle Utility approuvé pour la notification Super Admin (4 variables : établissement, Manager, date, résultat) |
| `SUPER_ADMIN_WHATSAPP` | Numéro destinataire E.164 du Super Admin |

**Important** : `+33772208885` et `+212665310308` sont des coordonnées de contact communiquées par le propriétaire. Aucun d'eux n'est présumé être l'expéditeur technique Meta : seul `WHATSAPP_PHONE_NUMBER_ID` fait foi. Le destinataire de la notification Super Admin doit être fourni explicitement via `SUPER_ADMIN_WHATSAPP`.

## Règles

- Aucun basculement automatique vers un autre fournisseur, aucun service payant activé sans autorisation explicite.
- Sans secret complet, les canaux renvoient `non_configure` et n'effectuent aucun appel réseau.
- Un HTTP 2xx est `accepte_par_fournisseur` — **jamais** « livré » ; la livraison exigerait un webhook signé.
- Une panne de notification ne bloque jamais la création du garage ni du Manager.

# GV5 §107-PROD-FINAL — Dossier des 5 conditions avant GO-2

Branche `gv5-107-prod-final`. **Aucune écriture en production, aucun merge dans `main`, aucune écriture dans le dépôt public depuis GO-1.** Le plan Supabase de production sera fourni par le propriétaire.

## Condition 1 — Copie réelle du schéma PRODUCTION

### Dépôt privé
- Créé : `auto-dyali/auto-dyali-rehearsal` (**private**, `has_issues=false`, `has_wiki=false`, `has_projects=false`, sans `auto_init`).
- Branche poussée : `gv5-107-prod-final` (uniquement vers ce dépôt ; `origin` reste inchangé).
- Workflow : `.github/workflows/rehearsal.yml`.
  - Déclencheur : **`push` sur `gv5-107-prod-final` uniquement** — aucun `workflow_dispatch`, aucun `pull_request`.
  - `concurrency` : un seul run à la fois, pas d'annulation.
- Secrets attendus (noms seulement, à poser par le propriétaire dans ce dépôt) : `SUPABASE_ACCESS_TOKEN`, `PROD_DB_PASSWORD`. Le workflow vérifie leur présence sans afficher leur valeur, et vérifie que `RESEND_API_KEY` / `EMAIL_FROM` sont absents du job « nouveau parcours ».

### Contenu du workflow
Deux jobs indépendants, chacun avec son propre Supabase local :

| Job | Ce qui est fait |
|---|---|
| `nouveau-parcours` | dump `--schema public` de production → restauration locale **dans le même job** → 7 migrations × 2 passes → contrôle des objets/droits (noms et booléens seulement) → parcours `scripts/test-rehearsal.mjs` |
| `ancien-parcours` | même dump/restauration/7 migrations × 2 passes, puis `git checkout main -- src supabase/functions` (front `81ca143` + EF `onboard-tenant` de `main`) → parcours `scripts/test-ancien-parcours.mjs` |

Parcours `nouveau` couvert : précontrôle `admin_identity_v2_health` (9 booléens true), onboarding complet, établissement + Manager + permissions, `send-invitation` sans secret, lien d'activation `admin_issue_activation_link` en fragment `#token=` avec renouvellement invalidation l'ancien, activation réelle, connexion Manager, `my_permissions`, isolation A/B (établissement concurrent créé côté service_role, Manager n'en voit qu'un), refus de 4 RPC `admin_*` au Manager.

Parcours `ancien` couvert : connexion SA avec le front de `main`, précontrôle (le bouton « Suivant » reste actif donc la RPC est prête), création via l'EF de `main`, connexion Manager avec le mot de passe temporaire, isolation A/B.

Aucun artefact (`upload-artifact` absent), aucun `cat` du dump ni des instructions SQL, aucun log de contenu de schéma : toute sortie Supabase est redirigée vers `/tmp/*.log` non affiché ; seules des chances/noms/booléens sont publiés.

### État réel
**EN PLACE — PAS ENCORE VERT.** Les secrets ne sont pas encore posés dans le dépôt privé (le propriétaire les ajoute). Le run déclenché par le push échouera à l'étape « Contrôle des secrets ». Dès confirmation que les secrets sont posés, je pousse un commit d'amorçage pour relancer, puis j'itère **un commit par correction** jusqu'à 100 % vert. Ce point reste donc **NON TESTÉ** à ce stade, conformément à la règle de preuve.

## Condition 2 — Activation sans fournisseur e-mail

### Preuve CODE (vérifiée localement)
- `supabase/functions/_shared/providers.ts` : sans `apiKey`/`from`, `sendEmailInvitation()` renvoie `{status:"non_configure", providerError:"Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM absents)."}` — aucun appel réseau, aucune invention de « délivré ». Test unitaire : `node --test scripts/test-providers.mjs` → **16/16**, dont « e-mail non configuré => non_configure (aucune invention) ».
- `onboard-tenant` v3 : la création Auth + RPC v2 précède la transmission ; l'échec d'un canal ne remonte pas d'erreur (statut enregistré via `admin_record_delivery`). J'ai ajouté un champ explicite dans la réponse 200 :
  `message: "Invitation préparée, e-mail non envoyé (RESEND_API_KEY / EMAIL_FROM absents)."` et `email_sent: false`.
- `send-invitation` v4 : renvoie déjà 200 avec `delivery[].status = "non_configure"` ; j'ai ajouté le même `message` explicite et `email_sent: false`.
- Les deux EF génèrent désormais l'URL d'activation avec le fragment `/activer/#token=…` ; `admin_issue_activation_link()` renvoie le même format.

### Preuve parcours (à valider par le CI privé)
`test-rehearsal.mjs` exécute la création **sans** `RESEND_API_KEY`/`EMAIL_FROM` et vérifie : HTTP 200 + `ok:true` + `status:"completed"`, `message` conforme, `delivery.email.status === "non_configure"`, `email_sent === false`, `send-invitation` 200 avec le même message, puis activation et connexion Manager réelles. **Résultat attendu, non encore observé** tant que le CI n'a pas tourné avec les secrets.

## Condition 3 — Limitation d'essais : défaut ouvert, pas de 8e migration

**Reportée et documentée comme défaut ouvert.** Aucune 8e migration n'est ajoutée.

Protection actuelle vérifiée :
- jeton **256 bits** (`gen_random_bytes(32)` / `crypto.getRandomValues` 32 octets) ;
- **hash SHA-256 seul stocké** (`hash_invitation_token`) — aucun jeton en clair en base ni dans les logs ;
- **usage unique** (`admin_accept_invitation` refuse `status='accepted'`) ;
- **expiration 7 jours**, vérifiée côté serveur ;
- ancien lien invalidé au renouvellement et à la révocation ;
- jeton dans le **fragment** `#token=`, `Referrer-Policy: no-referrer`, compatibilité conservée pour les anciens liens en query string.

Risque résiduel : absence de compteur de tentatives / verrou après N échecs. Décision : accepter le risque en l'état, à traiter dans une session dédiée.

## Condition 4 — Retour arrière : portée et limite de sûreté

Les 7 scripts sont dans `supabase/rollbacks/gv5107/`, testés sur copie du schéma (7 apply + 7 rollback OK). **Ils ne sont pas indolores.**

| Migration | Effet du retour arrière | Données détruites |
|---|---|---|
| `106000` | `DROP FUNCTION admin_issue_activation_link` | aucune |
| `104000` | `DROP FUNCTION admin_onboard_tenant_v2(...)` | aucune |
| `103000` | `DROP FUNCTION admin_update_manager`, `hash_invitation_token` | aucune |
| `102500` | `DROP COLUMN` ×6 sur `establishments` | **oui** : pays, infos légales/fiscales/admin, état du dossier, contacts complémentaires |
| `102000` | `DROP FUNCTION admin_identity_v2_health` | aucune |
| `101000` | `DROP COLUMN` identité (`professional_id`, `login_id`, `must_change_password`, …) + `DROP FUNCTION` ×9 + suppression des policies `password_rotation_required` | **oui** : identités professionnelles et état de rotation |
| `100000` | `DROP TABLE invitations`, `invitation_events` + `DROP FUNCTION` ×7 + policies | **oui, destructif** : toutes les invitations et leur journal |

**Point de non-retour : dès la première création réelle d'un abonné** (premier `POST /onboard-tenant` avec des données de production), ou dès qu'un Super Admin émet/copie un lien d'activation, ou dès qu'un Manager accepte une invitation. Avant cela, les seules données dans ces tables sont celles des tests `ZZ-TEST-GV5107` et un retour arrière est sûr. Après cela, le retour arrière `100000` supprime des invitations réelles et les états d'activation : il ne doit plus être exécuté sans une sauvegarde et un accord écrit explicites.

## Condition 5 — Fenêtre et vérifications post-application

### Fenêtre proposée (à confirmer)
**Mardi ou jeudi, 23:00–00:00 heure Europe/Casablanca**, faible activité, hors fin de mois. Durée estimée : 20–30 min (migrations + EF + contrôles). Report si une création d'abonné est en cours.

### Vérifications post-application (ordre exact)
1. Recalculer les sommes de contrôle `8cf57f71c55260bf…` (2 garages, 2 abonnements, profil SA) : **aucune différence**.
2. Comptages lecture seule : `establishments`, `subscriptions`, `profiles`, `plans`, `plan_features`, `audit_log` identiques à l'avant.
3. `admin_identity_v2_health()` en session SA : 200, 9 `true` ; en anonyme : 401.
4. Objets présents : `invitations`, `invitation_events`, 12 RPC, policies ; droits `REVOKE public/anon`, `GRANT authenticated`.
5. Déployer les EF dans l'ordre : `onboard-tenant` (v3) → `send-invitation` (v4) → `activate-manager` ; vérifier `verify_jwt` et l'absence de secret e-mail.
6. **Uniquement après GO-4 du propriétaire** : création d'un abonné de test préfixé `ZZ-TEST-GV5107`, fiche Manager, bouton « Copier le lien d'activation », activation, connexion Manager, isolation A/B, refus RPC `admin_*`, nettoyage limité au préfixe.
7. Ancien parcours (front `main` + `onboard-tenant` v1) : smoke test en lecture seule ou compte de test si GO-4.
8. Après GO-3 seulement : PR du front (bouton lien, fragment, `no-referrer`), puis déploiement Pages.

Le plan Supabase de production et ses sauvegardes automatiques réelles restent **à fournir par le propriétaire** ; aucune affirmation n'est faite à ce sujet.

## Verdict

**NON TERMINÉ — j'attends la pose des secrets dans `auto-dyali-rehearsal`, puis GO-2.** Rien n'a été écrit en production ; rien n'a été écrit dans le dépôt public depuis GO-1.

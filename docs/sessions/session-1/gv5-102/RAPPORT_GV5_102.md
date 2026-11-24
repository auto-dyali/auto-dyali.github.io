# GV5 §102 — Validation réelle de l'interface Super Admin après correction Manager

Date : 24/11/2026
Branche : `gv5-102-validate-superadmin-ui` (créée depuis `31d5d57`)
HEAD final : `4d84113058c12701241ed438a2b3e5a8c77cef5c`
Cible : **STAGING `yocufscgninxiihwiepa` uniquement**. Aucune écriture, migration ou déploiement en production ; aucun merge dans `main`.

---

## 0. Prérequis et honnêteté des preuves

| Prérequis | État |
|---|---|
| Références Git | Vérifiées : branche §101 `31d5d57`, `main`/`origin/main` `81ca143`, §97 `d5526cc`. Aucun écart. Corrections §101 conservées intactes. (TESTÉ SCRIPT/SQL) |
| Compte Super Admin de test | Compte dédié `superadmin.ui@autodyali-staging.local` (déjà présent sur staging, `role=saas_admin`, actif). Mot de passe réinitialisé via l'API Admin Supabase et stocké **hors dépôt** dans `/tmp/adq/ui_sa_credentials.json` (mode 600), non affiché dans ce rapport. (TESTÉ SCRIPT/SQL) |
| Fournisseur e-mail | Aucun secret Resend/WhatsApp présent sur staging (`supabase secrets list --remote=…` ne montre que des empreintes de configuration Supabase). Adresses de test `.local` uniquement ; **aucun e-mail réel envoyé**, aucun jeton d'invitation communiqué. (TESTÉ SCRIPT/SQL) |
| Outil navigateur | **Oui** : navigateur Chromium intégré à OpenCode (après mise à jour du serveur de dev), complété par Playwright headless pour l'émulation mobile et la coupure réseau ciblée. Aucun JWT forgé, aucun claim SQL injecté pour ce parcours. |

Niveaux de preuve utilisés : **TESTÉ NAVIGATEUR** (capture, log réseau ou trace Playwright), **TESTÉ SCRIPT/SQL**, **ANALYSÉ PAR LE CODE UNIQUEMENT**, **NON TESTÉ**.

---

## 1. Tableau des tests

| # | Étape | Statut | Niveau de preuve | Preuve |
|---|---|---|---|---|
| 1 | Connexion réelle Super Admin | OK | TESTÉ NAVIGATEUR | `preuves/01-tableau-de-bord.jpeg` ; `auth/v1/token` POST **200**, redirection `/super-admin/` |
| 2 | Ouverture rubrique abonnés (`/super-admin/entreprises/`) | OK | TESTÉ NAVIGATEUR | `preuves/02-liste-abonnes.jpeg` (65→70 entreprises) |
| 3 | Création d'un nouvel établissement | OK | TESTÉ NAVIGATEUR | `preuves/05-creation-confirmee.jpeg` ; `functions/v1/onboard-tenant` POST **200** |
| 4 | Saisie des informations administratives | OK | TESTÉ NAVIGATEUR | `preuves/07-fiche-etablissement-champs-admin.jpeg` ; les 6 champs sont relus dans la fiche |
| 5 | Sélection d'un abonnement (STANDARD, 12 mois, essai 15 j) | OK | TESTÉ NAVIGATEUR | `preuves/04-formules-prix-non-configure.jpeg` ; récapitulatif étape 6 |
| 6 | Création du Manager | OK | TESTÉ NAVIGATEUR | Réponse EF : `manager_user_id`, `login_id`, `invitation_id` |
| 7 | Génération de l'identifiant | OK | TESTÉ NAVIGATEUR | Bouton « Générer » → `ADY-PRO-CB6ECD` / `mgr.e1a950` visibles dans le récapitulatif |
| 8 | Préparation + envoi de l'invitation | **PARTIEL** | TESTÉ NAVIGATEUR + TESTÉ SCRIPT/SQL | Invitation `prepared` créée ; `send-invitation` **200** mais `non_configure` (fournisseur absent). `preuves/14-invitation-renouvelee-sans-erreur.jpeg` après correctif |
| 9 | Établissement visible dans la liste | OK | TESTÉ NAVIGATEUR | `preuves/06-nouvel-abonne-dans-liste.jpeg`, `preuves/15-liste-manager-affiche-apres-correctif.jpeg` (1/70) |
| 10 | Ouverture de la fiche établissement | OK | TESTÉ NAVIGATEUR | `preuves/07-fiche-etablissement-champs-admin.jpeg` |
| 11 | Modification des informations | OK | TESTÉ NAVIGATEUR | `admin_update_establishment` POST **200** `{"ok":true,"id":…}` ; toast `preuves/08-etablissement-enregistre.jpeg` |
| 12 | Modification du Manager | OK | TESTÉ NAVIGATEUR | `admin_update_manager` POST **200** ; toast `preuves/09-manager-enregistre.jpeg` |
| 13 | Modification des permissions | OK | TESTÉ NAVIGATEUR | `admin_set_permissions` POST **200** ; `preuves/10-confirmation-droits.jpeg`, `11-droits-appliques.jpeg` (delete clients activé) |
| 14a | Révocation de l'invitation | OK | TESTÉ NAVIGATEUR | `admin_revoke_invitation` POST **200** ; statut `cancelled`, audit `revoke_invitation` |
| 14b | Renouvellement d'une invitation active | OK (après correctif) | TESTÉ NAVIGATEUR | `send-invitation` POST **200**, statut `sent`, événement `resent` en base |
| 14c | Renouvellement **après révocation** | **KO — PRÉSENT ET DÉFAILLANT** | TESTÉ NAVIGATEUR + ANALYSÉ PAR LE CODE | « Envoyer / Renvoyer » désactivé quand `status=cancelled` ; « Relancer l'invitation depuis la fiche » ne fait que `setEspace("invitations")` (`abonne-workspace.tsx:801`). `admin_prepare_resend` refuse explicitement les invitations annulées. |
| 15a | Champ obligatoire vide | OK | TESTÉ NAVIGATEUR | Messages « Le nom commercial doit contenir entre 2 et 120 caractères », etc. ; `preuves/03-erreur-email-invalide.jpeg` |
| 15b | E-mail invalide | OK | TESTÉ NAVIGATEUR | Message « E-mail de l'entreprise invalide. » visible sous le champ |
| 15c | Doublon | OK | TESTÉ NAVIGATEUR | `admin_check_identity_available` **200** `{"email_available":false,…}` + message « Un compte existe déjà pour cet e-mail. » |
| 15d | Réseau coupé | **KO — PRÉSENT ET DÉFAILLANT** | TESTÉ NAVIGATEUR (Playwright) | Backend bloqué (`route.abort`) : l'UI affiche « Accès refusé : cette Entreprises est réservée… » au lieu d'un message réseau. `preuves/16-reseau-coupe.png` |
| 16 | Isolation A/B — UI + API + RPC | OK, aucune faille | TESTÉ NAVIGATEUR | Voir §3 |
| 17 | Ordinateur (1280×800) | OK | TESTÉ NAVIGATEUR | Captures desktop ci-dessus |
| 18 | Smartphone (375×812, émulation) | OK | TESTÉ NAVIGATEUR (Playwright) | `preuves/mobile-01-liste-abonnes.png`, `mobile-02-formulaire-creation.png`, `mobile-03-fiche-etablissement.png` ; `scrollWidth=375` sur 3 pages, aucun débordement, boutons visibles |

---

## 2. Fonctionnalités réussies / échecs

### Réussites
- Le parcours complet **création → fiche → modification établissement/Manager/permissions** fonctionne depuis l'interface avec une vraie session Super Admin.
- Les 3 RPC de gestion demandées ont été appelées **depuis l'interface**, avec preuve réseau : `admin_update_establishment` (200), `admin_update_manager` (200), `admin_set_permissions` (200).
- Le journal d'audit affiche `onboard_tenant_v2`, `update_establishment`, `update_manager`, `set_permissions`, `revoke_invitation` : traçabilité complète.
- Connexion Manager réelle par identifiant (`resolve_login_email`) puis **rotation du mot de passe temporaire** (`admin_complete_password_change` 200) et accès au tableau de bord Manager.
- Les messages de succès sont explicites : « Établissement enregistré », « Manager enregistré », « Droits appliqués ».
- Le correctif §101 (6 champs administratifs) est visible dans l'UI.

### Défauts reproduits et corrigés
1. **`invitation_events.provider_error` absent de staging** — `send-invitation` répondait 200 mais `admin_record_delivery` échouait avec `column "provider_error" does not exist` ; l'échec du canal n'était pas journalisé. Cause : historique distant ad hoc, alors que la migration locale `0036` contient la colonne. Corrigé et rejoué : l'événement `send_requested` contient désormais uniquement `Fournisseur e-mail non configuré…`, sans suffixe d'erreur SQL. Commit `fc20a1b`.
2. **Super Admin ne voyait aucun Manager** — colonne « Aucun manager associé » dans la liste et compteur « 0 managers » au tableau de bord, malgré 52 Managers. Cause : seule policy SELECT sur `profiles` (`profiles_self_or_same_establishment`) renvoie NULL pour un SA sans établissement courant. Corrigé par une policy SELECT dédiée (`saas_admin_select_profiles`) ; après application, l'UI affiche « Manager UI 102 Modifié / mgr.e1a950 » et « MANAGERS 52 / 52 actifs ». Commit `4d84113`.

### Défauts reproduits, non corrigés
3. **Renouvellement après révocation impossible** (PRÉSENT ET DÉFAILLANT). Cause probable : choix backend explicite (`admin_prepare_resend` lève « Invitation annulée : relance impossible. ») non relayé par une action UI de création d'une nouvelle invitation. Contournement actuel : recréer un abonné.
4. **Erreur réseau présentée comme refus d'accès** (PRÉSENT ET DÉFAILLANT). Cause probable : le guard Super Admin ne distingue pas une erreur de `get_my_profile` d'un rôle invalide.
5. Mineur : dans la fiche, la ville ne se modifie pas par saisie libre (composant `ChampGeographieMaroc`, probablement sélection obligatoire) ; le récapitulatif répète le libellé « Info admin. » pour 4 champs distincts ; le tableau de bord compte 0 « abonnements actifs » alors que 52 essais sont en cours (sémantique du compteur, pas une perte de données).

---

## 3. Isolation entre établissements (critique)

Deux établissements A et B, chacun avec son Manager, ont été créés **via l'interface**. Le Manager A s'est connecté réellement (identifiant `mgr.e1a950`, mot de passe temporaire puis changement obligatoire), puis, depuis sa session navigateur réelle :

| Tentative | Résultat |
|---|---|
| Liste REST `establishments` | 1 ligne : uniquement A |
| Lecture REST de B (`id=eq.<B>`) | 0 ligne |
| Écriture REST sur B (`PATCH name='HACK-TEST-ISO'`) | 0 ligne modifiée |
| Profils visibles | 1 profil : le sien |
| Permissions de B | 0 ligne |
| RPC `admin_set_permissions` sur B | **400 `Accès refusé.`** |
| RPC `admin_update_establishment` sur B (18 arguments corrects) | **400 `Accès refusé.`** |
| Navigation UI vers `/super-admin/entreprises/` | **Refusé** : « cette Entreprises est réservée à l’administrateur de la plateforme » (`preuves/12-refus-acces-manager-espace-admin.jpeg`) |

**Aucune faille d'isolation constatée.** Données de test supprimées après vérification (0 établissement, 0 profil, 0 user Auth restants pour A et B).

---

## 4. Client Supabase et build

- `src/lib/supabase-browser.ts` lignes 3-10 : plus aucun repli en dur. `const url = process.env.NEXT_PUBLIC_SUPABASE_URL` (ligne 9) et `const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ligne 10). `git grep nxmsqqoflskfajqrqddw -- src/` → **0 occurrence**.
- `.env.local` (gitignoré) : `NEXT_PUBLIC_SUPABASE_URL=https://yocufscgninxiihwiepa.supabase.co` + clé publishable staging (non affichée). C'est bien cette configuration qu'a utilisée le navigateur : toutes les requêtes réseau vont vers `yocufscgninxiihwiepa.supabase.co`.
- Build propre avec les variables du workflow de production : **0 occurrence** de `yocufscgninxiihwiepa` dans `.next`, 2 occurrences de l'URL production (injection d'environnement attendue). Aucune URL staging dans le bundle produit.
- Avec les variables staging (build local de test), l'URL staging apparaît dans le bundle : comportement normal d'un build `NEXT_PUBLIC_*`, aucun test de production n'a été déployé.
- Erreurs de connexion/RPC : visibles et non silencieuses (champs invalides, doublon, fournisseur non configuré, refus d'accès) — sauf le cas réseau coupé traité en §2.4.

---

## 5. Tarifs et abonnements

- `public.plans` sur staging : `standard`, `silver`, `gold`, tous actifs, `currency='MAD'`, `trial_days=14`, `max_users=5`, `max_sites=1` ; **`price_monthly` et `price_yearly` sont NULL pour les trois**.
- Cause : aucune valeur n'a jamais été fournie. Le script `scripts/configure-plans.mjs` lit explicitement `GV581_STANDARD_MENSUEL/ANNUEL`, `GV581_SILVER_*`, `GV581_GOLD_*` et appelle `admin_save_plan` ; sans ces variables il n'applique aucun prix (« la décision tarifaire appartient au propriétaire »). Aucune migration ni aucun seed ne contient de montant.
- L'UI affiche « Non configuré » et le CA mensuel estimé à 0 : comportement cohérent, aucun tarif inventé.
- **QUESTION OUVERTE** : quels montants mensuels/annuels en MAD pour STANDARD, SILVER et GOLD ? Aucune valeur arbitraire n'a été créée.
- La création d'un abonnement **Trial fonctionne sans intégration de paiement** : aucun secret Stripe sur staging ; les deux créations UI ont produit un abonnement `Trial` avec échéance, sans appel à un fournisseur de paiement.

---

## 6. Tests exécutés et livraison

- `npm test` : **183 tests, 0 échec** (dont les 7 tests de régression §101).
- `bash scripts/verify-staging-migrations.sh` : **48/48 contrôles OK**, en lecture seule (dont les 2 nouveaux contrôles).
- `npx tsc --noEmit`, `npm run lint` (0 erreur, avertissements préexistants), `npm run build` : OK.
- Captures : 16 fichiers dans `docs/sessions/session-1/gv5-102/preuves/` (desktop, mobile, erreurs, corrections). Aucun secret ni jeton visible.

### Commits (un par correction)
- `fc20a1b` — Restaurer `invitation_events.provider_error` sur staging.
- `4d84113` — Policy SELECT Super Admin sur `profiles` + 2 contrôles de vérification.

Branche : `gv5-102-validate-superadmin-ui` → `origin/gv5-102-validate-superadmin-ui`.
HEAD : `4d84113`. `main` (`81ca143`) et branche §101 (`31d5d57`) inchangés ; §97 (`d5526cc`) intacte.

---

## 7. Tests restant à effectuer

1. Activation via le **lien e-mail/WhatsApp réel** (impossible tant qu'aucun fournisseur n'est configuré sur staging) ; seul le parcours par jeton direct a été validé en §101.
2. Nouvel abonnement après révocation (décision produit à prendre : bouton dédié ou statut non terminal).
3. Différenciation erreur réseau / refus d'accès dans les guards.
4. Vrai appareil mobile (ici émulation Playwright 375×812, pas un téléphone physique).
5. Saisie des tarifs par le propriétaire, puis re-vérification des écrans `offres` et `paiements`.
6. Aucun déploiement production ni merge dans `main` n'a été effectué : à décider séparément.

## 8. Verdict

**Oui, partiellement.** On peut désormais **gérer un établissement et son Manager depuis l'interface Super Admin** : création complète, champs administratifs, abonnement Trial, permissions, modification de l'établissement, du Manager et des droits, ainsi que révocation/renouvellement d'une invitation active — le tout avec une vraie session, des preuves réseau et des captures. Les RPC demandées sont confirmées depuis l'UI, pas seulement par SQL. L'isolation entre établissements est confirmée sans faille.

Les points qui empêchent un « oui » total sont : l'absence de renouvellement après révocation, la confusion erreur réseau/refus d'accès, et l'absence de fournisseur e-mail (activation par lien non testable). Aucun de ces points ne bloque la gestion courante d'un abonné et de son Manager.

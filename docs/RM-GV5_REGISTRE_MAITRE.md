# RM-GV5 — Registre maître des exigences, décisions, continuité et preuves

Identité du projet : **GV5**. Le dépôt GitHub `auto-dyali/auto-dyali.github.io` est un support de publication, **pas** le nom du projet. Aucune référence à PHARMA+ n'est autorisée dans ce registre.

## 1. Source de vérité

| Élément | Valeur |
|---|---|
| Dossier local | `/Users/hind/Documents/Default Project/auto-plus` |
| Remote | `https://github.com/auto-dyali/auto-dyali.github.io.git` |
| Branche principale | `main` |
| Branche de travail GV5 | `gv5-107-prod-final` |
| Production Supabase | `nxmsqqoflskfajqrqddw` (`auto-dyali.github.io`, plan **Free**, sans PITR) |
| Staging Supabase | `yocufscgninxiihwiepa` (`auto-dyali-staging`) |

## 2. Décisions enregistrées

| Date | Décision | Statut |
|---|---|---|
| 25/11 | GO-1 : diagnostic et stratégie à 7 migrations validés | Accordé |
| 25/11 | Ajout d'une 8ᵉ migration corrective `20261125108000` (pgcrypto / `search_path`) | Validée par le propriétaire après rapport technique |
| 25/11 | Répétition CI sur copie réelle abandonnée (dépôt de répétition supprimé) | Abandonnée — workflow retiré |
| 25/11 | Pages réactivé ; déploiement réussi sur `main@3a0329b` | Terminé |
| 25/11 | Réconciliation `main` ← `gv5-107-prod-final` (PR #1) | Fusionnée |
| 25/11 | Aucune écriture production (migrations / EF / données) | **Respecté** |
| 25/11 | Plan Free conservé ; aucun recours à Pro ni PITR | **Respecté** |
| 25/11 | Déclaration `verify_jwt = false` pour `onboard-tenant` et `activate-manager` dans `supabase/config.toml` (les EF valident elles-mêmes JWT / jeton) | **Développée, testée localement, non déployée** |
| 25/11 | Reprise idempotente d'un compte Auth orphelin par la même `requestId` dans `onboard-tenant` ; compensation seulement si la demande n'est pas déjà clôturée | **Développée, testée localement, non déployée** |
| 25/11 | Test d'intégration transactionnel complet sur staging (création → idempotence → doublon → acceptation → isolation) ; `ROLLBACK` et 0 résidu | **Testé sur staging** |

## 3. Chaîne de migrations retenue (9 fichiers)

`20261125100000` → `101000` → `102000` → `102500` → `103000` → `104000` → `106000` → `108000` → **`109000`**.

La 9ᵉ migration restaure `permissions_tenant_write` (écriture tenant équivalente à l'ancienne policy `tenant_isolation`) : le front de `main` écrit directement dans `permissions` avec un rôle non Super Admin ; sans elle, le parcours historique serait cassé. `101000` n'est pas modifiée (déjà appliquée sur staging).

Dépendances : `100000` crée `invitations` dont dépend la FK de `101000` ; `102500` crée les 6 colonnes exigées par le précontrôle de `103000` ; `108000` corrige les helpers SQL de `100000` et doit être exécutée **dans la même transaction** avec `SET LOCAL search_path = public, extensions`.

## 4. Protection des données

- Sauvegarde fraîche à utiliser : `~/.local/share/auto-dyali/gv5-supabase-prod-backup-20261125-191107/` (la sauvegarde `…135853` est périmée).
- sha256 de la sauvegarde à utiliser : schéma `52885122a89da0524b5a04cc0ff947e6b193af0dbb305bf067c95d01d48df1f46bec`, données chiffrées `75171117e668d546341f628af0abb09b2c2ae83bea00188a9f53a68af405afbe`; restauration testée sur 105 lignes.
- Le script d'application ne contient aucun UUID à saisir : le Super Admin est résolu en base et le nombre de comptes SA doit être exactement 1 (précontrôle A).
- Phrase de passe : fichier local `backup.passphrase` (mode 600), **jamais** dans le dépôt, le chat ni les journaux.
- Plan Free = aucune sauvegarde automatique : cette sauvegarde est l'unique protection.

## 5. Points de non-retour

Retour arrière sûr jusqu'à la première création réelle d'abonné, l'émission d'un lien d'activation ou l'acceptation d'une invitation. Les rollbacks de `100000`, `101000` et `102500` suppriment respectivement les tables d'invitation et les colonnes ajoutées, donc les données créées depuis.

## 6. Preuves et état

Les preuves détaillées sont dans :
- `docs/sessions/session-1/gv5-107-prod-final/RAPPORT.md`
- `docs/sessions/session-1/gv5-107-prod-final/DOSSIER_GO2.md`
- `docs/sessions/session-1/gv5-107-prod-final/RAPPORT_PREPARATION_PROD.md`

**État (25/11) : GO d'application reçu et exécuté. 9 migrations appliquées, 3 Edge Functions déployées, création réelle d'un garage de vérification et connexion de son Manager confirmées en production, isolation vérifiée. Parcours navigateur de bout en bout : NON TESTÉ. Aucune donnée préexistante supprimée.**

## 10. Finalisation « création d'abonné » — état réel (25/11)

### 10.1 Identité et coordonnées (distinction vérifiée)

| Élément | Rôle constaté | Statut |
|---|---|---|
| `admin@auto-dyali.ma` | Unique compte Super Admin global (contrôle plateforme) | **CONFORME ET VÉRIFIÉ** en production (1 seul profil `saas_admin`, précontrôle A) |
| `me.achbani@gmail.com` | Coordonnée de contact du responsable ; utilisée comme contact de support etReply-To dans le code | **CONFORME ET VÉRIFIÉ** dans le code après correction (commit `8043233`) — n'est pas un expéditeur technique configuré |
| `+33772208885` | WhatsApp Business : contact de support affiché dans les messages | **PARTIEL** — numéro de contact, pas un expéditeur Meta configuré |
| `+212665310308` | Second numéro communiqué ; aucune utilisation trouvée dans le code ou la configuration | **ABSENT** du parcours — aucun rôle technique vérifié, aucun rôle inventé |
| `a.naji@auto-dyali.ma`, `r.bami@auto-dyali.ma` | Anciens comptes supprimés, non réutilisés dans le parcours | **CONFORME** (aucune recréation) |

### 10.2 Configuration des communications (secrets inspectés par nom, valeurs masquées)

Production : **7 secrets présents**, tous internes Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`).

Absents : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SMTP_HOST`/`SMTP_PORT`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION`, `ACTIVATION_BASE_URL`.

| Exigence | État | Preuve |
|---|---|---|
| Expéditeur e-mail | **BLOQUÉ PAR CONFIG** | `EMAIL_FROM` absent ; code `non_configure` sans appel réseau |
| Reply-To | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | `SUPPORT_EMAIL` dans `deliverInvitation` et, après correction locale, dans `send-invitation` (non redéployé) |
| Fournisseur e-mail | **PARTIEL** | Resend codé, aucun secret fournisseur en production |
| Expéditeur WhatsApp / Business enregistré | **BLOQUÉ PAR CONFIG** | `WHATSAPP_PHONE_NUMBER_ID` absent ; `+33772208885` n'est qu'un contact de support |
| Destinataires | **CONFORME ET VÉRIFIÉ** | e-mail = `manager.email` ; WhatsApp = `manager.phone` (contrat v2, validation dédiée) |
| Contenu (garage, Manager, lien, 7 jours) | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | `_shared/providers.ts`, tests 31/31 (ciblés) |
| Doublons / traçabilité | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | idempotence `request_id`, `invitation_events`, statut `accepte_par_fournisseur` jamais « délivré » |

### 10.3 Interface et parcours

| Exigence | État | Preuve |
|---|---|---|
| Page Super Admin › Nouvel abonné | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** dans le navigateur | `src/app/super-admin/onboarding/page.tsx` (1050 lignes), 6 étapes, lien depuis `/super-admin/` |
| Formulaires/validation/doublon/soumission multiple | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | contrat v2 partagé, `enCours`, `admin_check_identity_available`, santé 9/9 |
| Bouton de création et résultat par canal | **IMPLÉMENTÉ MAIS NON VÉRIFIÉ** | `soumettre()`, étape 6, statuts `delivery` explicites |
| Rendu ordinateur/tablette/smartphone | **NON VÉRIFIÉ** | classes responsives présentes ; aucune capture navigateur de cette mission |
| Test navigateur de bout en bout | **EN ATTENTE D'AUTORISATION / NON TESTÉ** | identifiants Super Admin non disponibles dans l'environnement |
| Création réelle garage + Manager + connexion + isolation | **CONFORME ET VÉRIFIÉ** | SQL + Auth réels en production (rapport §107.9) — 1 garage visible sur 3 |
| E-mail / WhatsApp réellement reçus | **ABSENT** | aucun secret fournisseur, aucun message émis ni reçu |
| Renouvellement d'invitation, limitation des tentatives de jeton | **ABSENT** | non présents dans les migrations appliquées |

### 10.4 Progression justifiée

**~60 %** : création backend + activation + isolation **vérifiées réellement** (blocage levé) ; interface et notifications **codées mais non vérifiées en navigateur** ; **0/2 canaux configurés**, **0 message réellement livré** ; dernières corrections de contact **non déployées** ; fusion et Pages **non autorisées**.

### 10.5 Point de reprise

Définitivement clôturé : 9 migrations production, 3 EF déployées, création réelle, connexion Manager, isolation, correction du contact et du Reply-To dans le code.

Restent ouverts : fournisseur e-mail + `EMAIL_FROM` (+ `EMAIL_REPLY_TO` recommandé), fournisseur WhatsApp + `WHATSAPP_PHONE_NUMBER_ID` + modèle approuvé, `ACTIVATION_BASE_URL`, test navigateur avec `admin@auto-dyali.ma`, redéploiement des EF après correction, fusion PR #2 et publication Pages.

Blocage exact : **secrets fournisseurs absents** (BLOQUÉ PAR CONFIG) et **autorisation absente** pour toute opération sensible supplémentaire sur Production, fusion ou publication.

## 11. Géographie internationale + notifications Super Admin (MISSION « lance »)

### 11.1 État Git initial et réconciliation

- Dépôt `auto-dyali/auto-dyali.github.io`, branche `gv5-107-prod-final`, HEAD initial `e5916cb44c1fd6b2a460f5207b2341d5f4cbf1aa`.
- `origin/main` = `3a0329baee540935c46adac24933bd16c4deebf1` ; divergence initiale **1 en retard / 14 en avance**.
- `git merge-tree --write-tree origin/main HEAD` : **aucun conflit**. Le commit « en retard » est la fusion PR #1 (`3a0329b`) qui contient déjà une partie des travaux de la branche.
- Fusion LOCALE de `origin/main` dans la branche (`git merge --no-edit`, **ni rebase forcé ni force-push**) : **0 en retard / 16 en avance**. `main` et Pages inchangés.
- Commit de code `882df6acfe2ff8457155ae61ce175ace9fbbde9c` ; commit de fusion `8703e526ef144d9151cbec7cdafefedcae8f253a`.
- Modifications préexistantes non suivies/capturées préservées (aucune suppression, aucun `clean`).

### 11.2 Décisions et sources

- **Refus GPL** : aucune dépendance `country-state-city` (GPL-3.0) dans le bundle public.
- Pays : `countryInfo.txt` GeoNames ; libellés français via `Intl.DisplayNames('fr')`.
- Villes : GeoNames **`cities500.zip`**, licence **CC BY 4.0**, attribution dans `docs/ATTRIBUTIONS.md`, statistiques dans `docs/GEODATA_STATS.md`. `alternateNamesV2.zip` (205 Mo) non embarqué. Générateur reproductible : `scripts/generate-geodata.mjs`.
- Limites documentées : localités ≥ 500 habitants, liste **non exhaustive**, 6 entrées sans ville, `XK` code utilisateur.

### 11.3 Statistiques recalculées

| Mesure | Valeur |
|---|---|
| Entrées `countryInfo` | 252 (251 avec code ISO numérique, 1 code utilisateur `XK`) |
| Pays avec au moins une ville | 246 |
| Pays sans ville | `AN`, `AQ`, `BV`, `CS`, `HM`, `UM` |
| Lignes `cities500` retenues (classe P) | 237 395 |
| Villes après déduction par clé normalisée | 209 004 |
| Taille `public/data/villes-par-pays.json` | 2 786 621 octets (chargé à la demande) |
| SHA-256 du JSON villes | `fabdc1ab4d5051bee8b11fa8cc93d1129199513c87452b67f9edcc952fa4b7fa` |
| SHA-256 du JSON pays | `828fcc856c9574ba9335af6a918c902f2aa5f0a633b470d075f35ed67005c4ad` |
| SHA-256 du générateur | `8e42c655369961f4fe5b3aee4c1e88ba4391f03894bd59ff785dcc4e2817dc67` |

### 11.4 Union marocaine — démonstration corrigée

Le calcul naïf `480 + 142 − 106 = 516` était faux : les **106 correspondances** incluaient les alias (ASCII/noms alternatifs), alors que l'union doit utiliser la **clé du nom principal**.

| Quantité | Valeur |
|---|---|
| Villes locales inchangées (`maroc-geographie.ts`) | 142 |
| Régions inchangées | 12 |
| Lignes GeoNames `MA` | 480 |
| Clés normalisées distinctes côté local | 142 |
| Clés normalisées distinctes côté GeoNames | 476 (4 lignes répètent un même nom) |
| Intersection par nom principal | 90 |
| Noms GeoNames ajoutés | 386 |
| **Union réelle** | **142 + 386 = 528** |
| Correspondances élargies avec alias (contrôle de couverture) | 106 |
| Villes locales absentes de GeoNames même par alias (conservées) | 36 |

Aucune ville locale perdue, aucun écrasement du référentiel marocain. Listes détaillées dans `docs/GEODATA_STATS.md`.

### 11.5 Fichiers créés / modifiés

Créés : `src/lib/geographie.ts`, `public/data/pays-iso.json`, `public/data/villes-par-pays.json`, `scripts/generate-geodata.mjs`, `scripts/test-geographie-final.mjs`, `scripts/test-super-admin-notifications.mjs`, `scripts/test-super-admin-notifications-pglite.mjs`, `docs/ATTRIBUTIONS.md`, `docs/GEODATA_STATS.md`, `supabase/migrations/20261126000000_super_admin_notifications.sql`, `supabase/rollbacks/gv5108/20261126000000.sql`.
Modifiés : `src/components/ChampGeographieMaroc.tsx`, `src/components/abonne-workspace.tsx`, `src/app/super-admin/onboarding/page.tsx`, `supabase/functions/_shared/constants.ts`, `supabase/functions/_shared/providers.ts`, `supabase/functions/onboard-tenant/index.ts`, `scripts/test-providers.mjs`.

### 11.6 Migration notifications — sécurité et preuves

- Table additive `public.super_admin_notifications` ; **SHA-256 migration** `737bf28fccd26a0cf4c968df66424f5126ea5f5eb784393430ad1cd5aa48db9b`, **SHA-256 rollback** `0245d394b588e7cbeec4fb3039614cb9fad0204c8559ba22962a7569838b15ce`.
- RLS activée ; SELECT/UPDATE réservés à `public.is_saas_admin()` ; **aucune policy INSERT**, aucun droit anon/Manager ; `REVOKE` explicites ; RPC `admin_notify_new_subscriber(jsonb)` `SECURITY DEFINER`, réservée à `service_role`, idempotente par index unique `source_request_id` et `ON CONFLICT DO UPDATE`.
- Statuts honnêtes : `non_demande`, `non_configure`, `en_attente`, `accepte_par_fournisseur`, `echec`. Aucun statut « livré » ; `accepte_par_fournisseur` = HTTP 2xx uniquement.
- PGlite (base mémoire locale) : migration appliquée, 2 appels identiques → 1 ligne (`idempotent=true` au 2ᵉ), refus des statuts fictifs et d'un `source_request_id` invalide, INSERT refusé au rôle `authenticated`, rollback ne supprimant que les objets créés : **5/5**.
- Logo officiel : `public/images/branding/logo.webp`, non modifié ; URL `https://auto-dyali.github.io/images/branding/logo.webp` vérifiée **HTTP 200 / image/webp**, SHA-256 distant `603de9de…` identique au dépôt.

### 11.7 Tests exécutés (sorties conservées)

- `npm test` : **204/204**.
- `tsc --noEmit` : OK ; `eslint` : **0 erreur**, 20 warnings préexistants ; `next build` : OK.
- Ciblés : géographie **8/8**, notifications statiques **7/7**, notifications PGlite **5/5**, providers **18/18** (dont 2 nouveaux pour la notification SA), EF statiques **15/15**, readiness 107 **9/9**, cohérence contrat RPC **5/5**.
- Aucun appel réseau géographique à l'exécution ; aucun test E2E navigateur, aucun envoi réel, aucune écriture distante.

### 11.8 Statuts réels

| Élément | Statut |
|---|---|
| Référentiel Pays/Ville, interface, migration, RPC, messages, tests | **MODIFIÉ LOCALEMENT + TESTÉ LOCALEMENT + COMMITÉ** |
| Fusion locale de `main` dans la branche | **COMMITÉ** (`8703e52`), pas de force-push |
| Migration `20261126000000` | **PRÉPARÉE — JAMAIS APPLIQUÉE** (ni staging, ni production) |
| EF corrigées | **PRÉPARÉES — JAMAIS REDÉPLOYÉES** |
| Création garage/Manager supplémentaire | **NON EFFECTUÉE** |
| E-mail / WhatsApp réels | **NON ENVOYÉS** (aucun secret fournisseur) |
| PR #2 | **NON FUSIONNÉE** |
| GitHub Pages | **NON PUBLIÉE** ; production inchangée |
| Secrets Resend / Meta | **BLOQUÉ PAR CONFIG** — à poser par le propriétaire |

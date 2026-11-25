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

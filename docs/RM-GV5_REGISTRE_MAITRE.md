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

## 3. Chaîne de migrations retenue (8 fichiers)

`20261125100000` → `101000` → `102000` → `102500` → `103000` → `104000` → `106000` → **`108000`**.

Dépendances : `100000` crée `invitations` dont dépend la FK de `101000` ; `102500` crée les 6 colonnes exigées par le précontrôle de `103000` ; `108000` corrige les helpers SQL de `100000` et doit être exécutée **dans la même transaction** avec `SET LOCAL search_path = public, extensions`.

## 4. Protection des données

- Sauvegarde fraîche : `~/.local/share/auto-dyali/gv5-supabase-prod-backup-20261125-135853/`.
- sha256 : schéma `52885122a89da0524b5a04cc0ff947e6b193af0dbb305bf067c95d01d48df1f46bec`, données chiffrées `91283db0ec1e1e601ca9f895ecf9c0f0553347601dc27dfad8e737d2c2d6cf62`, comptages `650ec5e80b1c7e4684ab500833eb353f08ce1a6a9cb7a94399e1dbff00bec68f`.
- Phrase de passe : fichier local `backup.passphrase` (mode 600), **jamais** dans le dépôt, le chat ni les journaux.
- Plan Free = aucune sauvegarde automatique : cette sauvegarde est l'unique protection.

## 5. Points de non-retour

Retour arrière sûr jusqu'à la première création réelle d'abonné, l'émission d'un lien d'activation ou l'acceptation d'une invitation. Les rollbacks de `100000`, `101000` et `102500` suppriment respectivement les tables d'invitation et les colonnes ajoutées, donc les données créées depuis.

## 6. Preuves et état

Les preuves détaillées sont dans :
- `docs/sessions/session-1/gv5-107-prod-final/RAPPORT.md`
- `docs/sessions/session-1/gv5-107-prod-final/DOSSIER_GO2.md`
- `docs/sessions/session-1/gv5-107-prod-final/RAPPORT_PREPARATION_PROD.md`

**État : préparation technique terminée, production intacte, en attente du GO d'application.**

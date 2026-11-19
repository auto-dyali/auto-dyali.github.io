# GV5 §69 — Diagnostic technique MCP (Supabase non exposé)

Date : 18 novembre 2026. Diagnostic LOCAL uniquement. Aucune modification distante, aucune opération Supabase.

## 1. Versions et mécanisme de chargement

| Élément | Valeur vérifiée |
|---|---|
| Binaire OpenCode | `/Users/hind/.opencode/bin/opencode` |
| Version CLI (`opencode --version`) | v2.3.0 |
| Version service (`opencode api get /api/info`) | **v2.3.2** (pid 13122, http://127.0.0.1:49374) |
| Session | `ses_e19573f24ffeRN3ALi0u4gEf50` |
| Mécanisme MCP (doc V2) | serveurs `remote` → **OAuth par défaut** ; config watchée, `/reload` force le rechargement (pas de redémarrage nécessaire) |
| `opencode mcp list` | **`⚠ supabase needs authentication`** |
| `opencode service status` | service actif (127.0.0.1:49374) |

## 2. Cause exacte (démontrée par les logs)

Fichier : `~/.local/share/opencode/log/opencode.log` (3,1 Mo). Chronologie filtrée (`mcp|supabase|oauth`, valeurs sensibles masquées) :

- `2026-11-18T11:18:54Z` → `mcp connected server=supabase tools=14` ✅ (ancienne config, production)
- `11:33:05Z` et `11:39:43Z` → `mcp http authentication rejected status=401` + `mcp connect failed server=supabase-staging status=needs_auth` ❌
- `12:14:08Z` (après bascule) → `mcp connect failed server=supabase status=needs_auth status.error=Unauthorized` ❌
- `12:41:53Z` → `mcp oauth request started operation=refresh` → `12:41:55Z` `succeeded status=200` → `credential updated` ✅ (mais pour `directory=/Users/hind/Documents/Default Project`, PAS le projet courant)

**Cause démontrée** : les credentials OAuth du serveur MCP Supabase sont liés (a) au projet d’origine via `project_ref`, et (b) au répertoire de travail. Le changement de `project_ref` vers `yocufscgninxiihwiepa` invalide les credentials existants → `401 Unauthorized` → `needs_auth` → aucun outil exposé. Le rafraîchissement OAuth observé à 12:41 concerne un autre répertoire (`Default Project`), pas `auto-plus`.

## 3. Structure de configuration vérifiée

- Syntaxe JSON valide (parse OK), `$schema` V2 présent, serveur sous `mcp.servers` — **conforme à la doc V2**.
- Config du projet `auto-plus/opencode.json` : 1 serveur `supabase` → `project_ref=yocufscgninxiihwiepa` ✅
- **Config globale `~/.config/opencode/opencode.json` : 1 serveur `supabase` → `project_ref=nxmsqqoflskfajqrqddw` (PRODUCTION)** ⚠️
- Aucune autre config dans la hiérarchie (`/Users/hind/Documents`, `/Users/hind`, `/`) — seul le projet et le global existent.
- Selon la doc V2, la config projet a une priorité **plus élevée** que la globale ; la bascule du projet est donc la bonne cible, mais le global reste un serveur du même nom pointant production (source possible de confusion lors du chargement/fusion).

## 4. Authentification OAuth requise — procédure exacte

Le skill V2 est explicite : *« Remote servers use OAuth by default. If `mcp list` reports that a server needs authentication, tell the user to run `/mcps`, select the server, and sign in. »* et *« Do not run `opencode mcp auth` through the shell tool: it starts an interactive flow whose authorization link can be hidden in background process output. »*

**Procédure corrective (à faire par vous, dans l’interface OpenCode) :**

1. Dans OpenCode, tapez **`/mcps`** (pas dans le chat, dans la commande TUI).
2. Sélectionnez le serveur **`supabase`**.
3. Choisissez **« Sign in » / « Connect »** — le flux OAuth Supabase s’ouvre.
4. Connectez-vous avec le compte qui a accès au projet **`yocufscgninxiihwiepa`**.
5. Autorisez l’accès. Le statut doit passer de `needs authentication` à `connected`.
6. Vérifiez avec `opencode mcp list` (doit afficher `supabase` sans ⚠) puis je rappelle `get_project_url`.

Option complémentaire recommandée (aperçu uniquement, à valider par vous) : aligner aussi la config **globale** `~/.config/opencode/opencode.json` sur le staging, ou supprimer le serveur global pour éviter deux définitions du même nom `supabase` avec des refs différentes. **Je ne le fais pas sans votre accord** (diagnostic uniquement).

## 5. Pourquoi le namespace a disparu

Ce n’est PAS un bug de catalogue ni un problème de syntaxe : OpenCode masque les outils d’un serveur MCP qui n’a pas réussi à s’authentifier. Les logs prouvent `mcp connect failed ... status=needs_auth`, donc `tools=14` n’est plus annoncé pour ce serveur dans le projet courant. Tant que OAuth n’est pas refait pour `auto-plus`, aucun outil `supabase.*` ne sera exposé.

## 6. Causes possibles restantes (non démontrées — à ne pas présumer)

| Cause | Démontrée ? | Note |
|---|---|---|
| Credentials OAuth invalides après changement de `project_ref` | **OUI** (logs 401 + needs_auth) | cause principale |
| Credentials liés au répertoire (`Default Project` vs `auto-plus`) | **OUI** (log refresh 12:41 sur un autre répertoire) | contribue au problème |
| Double définition `supabase` (projet staging + global production) | démontrée dans les fichiers, effet sur la fusion non mesuré | à surveiller |
| Projet staging non autorisé pour le compte Supabase OAuth | NON vérifié | se révélera au sign-in `/mcps` |
| Bug OpenCode v2.3.2 | NON démontré | aucun log d’erreur interne |

## 7. Preuve que la production reste préservée

| Élément | État vérifié |
|---|---|
| Sauvegarde bascule | `.../gv569-mcp-switch-20261118-121330/` contient `opencode.json.avant` (hash SHA-256 `f8e93edbf81daaba37bdb43a08bd0e1d8175f14fd284fc4f1acb2d4c383e8c31`), `.bak`, `.save` — paramètres production conservés |
| Config globale production | `~/.config/opencode/opencode.json` intacte (`project_ref=nxmsqqoflskfajqrqddw`) |
| Aucune opération distante | aucune migration, déploiement, GRANT/REVOKE, création, envoi — aucun appel `tools.supabase.*` possible ni effectué |
| Git | `main` @ `64359da`, 65 entrées, 0 commit, 0 push |

## 8. Conclusion et attente

**Cause exacte** : le serveur MCP `supabase` est configuré (JSON valide, V2) mais **en attente d’authentification OAuth** (`opencode mcp list` = `needs authentication`, logs = 401 Unauthorized) après le changement de `project_ref` vers le staging. Le namespace est masqué parce qu’OpenCode n’expose pas les outils d’un serveur non authentifié.

**Action attendue du propriétaire** : exécuter `/mcps` → serveur `supabase` → **Sign in** avec un compte autorisé sur `yocufscgninxiihwiepa`, puis confirmer. Je ne poursuis aucune modification (même de la config globale) sans accord explicite. Conformément à la consigne, je m’arrête après ce diagnostic.

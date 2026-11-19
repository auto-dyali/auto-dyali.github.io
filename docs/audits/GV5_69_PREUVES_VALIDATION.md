# GV5 §69 — Preuves de validation réellement exécutées

Date : 18 novembre 2026. Toutes les commandes ci-dessous ont été exécutées dans cette mission.

## 1. Commandes locales (codes de sortie exacts)

| Commande | Sortie | Exit |
|---|---|---|
| `node --test scripts/test-edge-functions-51.mjs` | 13 tests, 13 pass, 0 fail | 0 |
| `node --test scripts/test-contract-rpc-067.mjs` | 5 tests, 5 pass, 0 fail | 0 |
| `npx tsc --noEmit` | succès | 0 |
| `npm test` | 158 pass, 0 fail | 0 |
| `npm run build` | Compiled successfully | 0 |

## 2. Tentatives de déblocage (résultats négatifs documentés)

| Tentative | Résultat |
|---|---|
| `command -v supabase` | ABSENT |
| `command -v docker` | ABSENT |
| `command -v psql` | ABSENT |
| `command -v deno` | ABSENT (tests EF exécutés en Node statique) |
| `env | grep SUPABASE/RESEND/WHATSAPP` | aucune variable |
| `.env.local` | NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY uniquement (pas de service_role) |
| `get_project_url` MCP | https://nxmsqqoflskfajqrqddw.supabase.co = PRODUCTION |
| outils MCP search « create project / list projects / PITR / backup » | aucun |
| navigateur dashboard.supabase.com | redirection /dashboard/sign-in (session absente) |
| navigateur https://supabase.com/dashboard/org/drwvnjbgdnjriirjyiei (fourni par le propriétaire) | redirection vers GitHub → Google OAuth (`accounts.google.com/v3/signin/challenge`) : aucune session propriétaire, accès au dashboard impossible sans authentification |
| `query_logs` edge_logs | table inexistante / inaccessible |

## 3. Ce qui reste NON PROUVÉ (aucune preuve réelle)

- Aucun compte Manager créé dans Auth (aucun staging).
- Aucun e-mail Resend envoyé (secret absent).
- Aucun WhatsApp Meta envoyé (secrets absents).
- Aucune activation + mot de passe Manager vérifiés (EF/tables absents).
- Aucune isolation multi-tenant testée en réel (comptes de test absents).
- Aucune sauvegarde restaurable vérifiée (accès PITR absent).

Ces éléments ne sont PAS déclarés opérationnels. Les tests statiques et mocks locaux ne constituent pas des preuves de production.


## 4. Complément staging (nouveau projet fourni par le propriétaire)

| Vérification | Résultat réel |
|---|---|
| Projet staging fourni | ref `yocufscgninxiihwiepa`, URL `https://yocufscgninxiihwiepa.supabase.co` |
| `get_project_url` MCP dans la session courante | **`https://nxmsqqoflskfajqrqddw.supabase.co` = PRODUCTION** (échec de la vérification 1.3) |
| Config `opencode.json` avant | 1 serveur `supabase` → `project_ref=nxmsqqoflskfajqrqddw` |
| Action locale effectuée | ajout d un serveur **`supabase-staging`** (`project_ref=yocufscgninxiihwiepa`), production conservée intacte ; sauvegarde `opencode.json.20261118-113242.bak` |
| Outils disponibles après modification | toujours `tools.supabase.*` uniquement (serveurs MCP chargés au démarrage de session) |
| `search` mcp / `list_mcp_resources` | aucun outil `supabase-staging`, aucune ressource |
| Appel HTTP direct à l URL MCP staging | **401 `No access token provided`** — l authentification est gérée par l intégration OpenCode, pas par l URL seule |

Conclusion : la simple présence de la référence staging **ne prouve pas** la connexion. Le cible MCP réelle reste la production. **NO-GO pour toute opération sur le staging** tant que la session n a pas été redémarrée avec le nouveau serveur `supabase-staging` chargé et authentifié.

## 5. Bascule MCP vers le staging (autorisation locale du propriétaire)

| Étape | Résultat réel |
|---|---|
| Sauvegarde intégrale | `.../gv569-mcp-switch-20261118-121330/` (opencode.json.avant + .bak + .save, paramètres production conservés, hash SHA-256 avant = f8e93edb...) |
| Bascule `supabase` → `project_ref=yocufscgninxiihwiepa` | effectuée dans opencode.json |
| Suppression serveur secondaire `supabase-staging` | effectuée |
| Config active vérifiée | 1 seul serveur `supabase` → yocufscgninxiihwiepa ; 0 occurrence de nxmsqqoflskfajqrqddw |
| Redémarrage OpenCode | effectué (catalogue d'outils rechargé — message système) |
| **Namespace `supabase` disponible après redémarrage** | **NON — plus aucun outil supabase exposé** (search général et namespace vides, list_mcp_resources vide) |
| **`get_project_url` appelable** | **NON — outil indisponible** |
| **URL staging confirmée** | **NON CONFIRMÉE** |

Conclusion : la bascule locale de configuration est effectuée et vérifiée, mais l'URL exacte du staging n'a PAS pu être confirmée car le serveur MCP n'est plus exposé dans cette session. **NO-GO maintenu** : aucune opération distante effectuée. La production n'a subi aucune modification (seul le routage local de l'outil a changé, réversible via la sauvegarde).

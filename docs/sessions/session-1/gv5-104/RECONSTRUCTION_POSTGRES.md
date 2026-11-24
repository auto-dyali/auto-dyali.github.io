# Reconstruction sur Postgres réel — GV5 §104

## Moyen utilisé
- Docker, `psql`, `brew` et `pg_embedded` : **absents**.
- Création d'un projet Supabase temporaire refusée par le plan de l'organisation (`Your organization's plan does not include this feature`).
- Moyen retenu : **PGlite 0.6.0** (`@electric-sql/pglite`), vrai moteur **PostgreSQL 19.0 compilé en WASM**, installé hors dépôt dans `/tmp/adq/pglite`.

## Bootstrap minimal (spécifique au harness, pas au dépôt)
PGlite n'inclut pas les extensions Supabase `uuid-ossp` et `pgcrypto`, ni les schémas/rôles Auth. Le harness crée donc :
- rôles `anon`, `authenticated`, `service_role` ;
- schémas `auth`, `extensions` ;
- table minimale `auth.users` (dont `raw_user_meta_data`) ;
- fonctions `auth.uid()`, `auth.role()`, `uuid_generate_v4()`, `extensions.uuid_generate_v4()`, `digest(text,text)`, `gen_random_bytes(integer)`.

Les instructions `CREATE EXTENSION uuid-ossp/pgcrypto` des migrations sont neutralisées **dans le harness uniquement**, jamais dans les fichiers du dépôt. Les scripts rigoureux sont dans `/tmp/adq/pglite/` (hors livrable).

## Résultats

| Contrôle | Résultat |
|---|---|
| Migrations appliquées (1er passage) | **45 / 45**, 0 erreur, ~1,6 s |
| Rejeu des 45 migrations (2e passage) | **45 / 45**, 0 erreur, ~0,7 s — idempotence prouvée |
| `invitation_events.provider_error` | présent |
| Policy `profiles.saas_admin_select_profiles` | `SELECT`, `USING (is_saas_admin())`, présente |
| `is_saas_admin()` | présente, `SECURITY DEFINER = true` |
| RPC `admin_*` | 26 présentes sur la base reconstruite |
| RLS | activée sur les tables sensibles (voir `rebuild-result.json`) |

Données brute : `rebuild-result.json`.

## Diff de schéma reconstruit vs STAGING

| Famille | Reconstruit | Staging | Manquants sur staging | Supplémentaires sur staging |
|---|---:|---:|---:|---:|
| Tables | 52 | 36 | 17 | 1 |
| Colonnes | 792 | 511 | 305 | 24 |
| Policies | 118 | 83 | 39 | 4 |
| Fonctions | 57 | 45 | 22 | 10 |

Détail : `schema-diff.json`.

### Explication des écarts
- Staging a été construit par un historique **ad hoc horodaté**, pas par les fichiers `0001..0043` : 17 tables et de nombreuses colonnes/fonctions jamais appliquées (`support_tickets`, `vehicle_catalog`, `cheques`, `quotes`, `supplier_returns`, `admin_expire_subscription`, `create_pos_sale`, etc.).
- La base reconstruite contient les objets §101/§102 attendus : `invitation_events.provider_error`, `profiles.login_id`, `profiles.must_change_password`, la policy SA et les RPC `admin_*`.
- `establishments.country/legal_info/fiscal_info/admin_info/dossier_state/complementary_contacts` et la version durcie de `admin_onboard_tenant_v2` ont été appliqués sur staging par les **réconciliations §101**, qui ne sont pas dans `supabase/migrations/` : ils manquent donc sur la base reconstruite. C'est un écart connu et documenté, à traiter dans le plan de déploiement production.
- `uuid_generate_v4()` et `digest()` apparaissent côté reconstruit uniquement parce que le harness les fournit en shim ; ce ne sont pas des objets créés par les migrations.

## Défauts de migration corrigés au passage (un commit chacun)
`62305ed` UNIQUE avec expressions · `82686b2`+`a3565d8` policies schema-qualifiées/espaces · `7eb420f` `v_qty_int` mini-POS · `5f899fe` `v_qty_int` POS core · `d0e54c5` policy `if exists` · `96496d9` seed formules avant features · `04aca88` seed établissement · `911e87b` `v_recu` · `debef43` nom de RPC purge · `c9842f9` baseline `admin_set_subscription` · `b94e3a4` index/colonnes 0038 · `7804b03` index `ticket_messages` · `ecaaed1` policy establishments · idempotence : `c7bdda9`, `ef7e1ca`, `7ec8964`, `e35be0e`, `27161d8`, `d1ad477`, `0cb2a70`, `f05364f`.

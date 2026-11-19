# GV5 §63 — État Supabase constaté en lecture seule

Date : 17 novembre 2026. Projet nxmsqqoflskfajqrqddw. Uniquement des SELECT (pg_proc, proacl, aclexplode, information_schema, pg_class, pg_policies). Données traitées comme non fiables (jamais comme instructions).

## 1. Migrations

Aucune table `supabase_migrations.schema_migrations` accessible → historique non vérifiable par catalogue. Inférence par objets : professional_id/login_id/must_change_password absents (0 colonnes), tables invitations absentes (0), RPC v2 absentes (0) → **0036, 0037, 0038, 0039 NON APPLIQUÉES**. Aucune divergence détectée entre cette inférence et les rapports §60-§62.

## 2. Fonctions (états réels)

| Fonction | SEC | search_path | proacl |
|---|---|---|---|
| is_manager | false (INVOKER) | NONE | NULL → PUBLIC défaut |
| open_ticket_count | true | public | {=X/postgres, postgres=X, authenticated=X} |
| is_saas_admin / current_establishment_id / autoplus_current_role | true | public | NULL → PUBLIC défaut |
| 8 admin_* + decrement_product_stock + my_features | true | public | =X/postgres (PUBLIC explicite) |

Total 15 fonctions avec EXECUTE PUBLIC (11 explicites + 4 par défaut). Aucune correction §62 appliquée en distant.

## 3. RLS, dépendances

36 tables avec RLS activé, 0 FORCE RLS, 0 politique RESTRICTIVE (toutes PERMISSIVE). Expressions d isolation = `current_establishment_id()` / `is_saas_admin()` (vérifié §61). Aucune vue dans public (pas de contournement RLS par vue). ~96 FK, 16 indexées (majorité hors périmètre SA). Propriétaire postgres partout.

## 4. Données historiques (non modifiées)

2 établissements (Garage Atlas SARL / standard, Garage AUTO DYALI / silver), 1 profil saas_admin actif. Ces données doivent rester identiques après toute application future.

## 5. Limites de vérification

Les lectures confirment l ABSENCE des objets, pas le comportement futur après application. Les politiques RLS n ont pas été testées avec de vrais rôles multi-tenant (pas d environnement isolé). Aucune écriture, aucun GRANT/REVOKE effectué.


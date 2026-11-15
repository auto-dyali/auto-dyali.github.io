# Dossier incident P0 — RPC historiques Super Admin (préparation, sans exécution)

> **Statut : PRÉPARÉ / NON EXÉCUTÉ.** Gel P0 actif : **aucune** mutation distante, migration, modification RLS/ACL/permissions/rôles, restauration, création/modification/suppression de comptes ou données, aucun déploiement, aucun changement Auth/SMTP/secrets. Analyse fondée sur les **artefacts locaux** (migrations/apply) ; l’état réel distant (privilèges effectifs, overloads, propriétaires, dépendances, données concernées, exécutions historiques) est **NON VÉRIFIABLE** sans audit read-only autorisé.

## 1. Périmètre
RPC historiques identifiés (migration `0010_super_admin_rpc.sql`, également présents dans `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql`) :
- `public.admin_create_establishment(p_name text, p_slug text, p_city text, p_phone text, p_plan subscription_plan default 'standard')`
- `public.admin_save_plan(p_code text, p_label text, p_description text, p_price_monthly numeric, p_price_yearly numeric, p_currency text, p_trial_days int, p_max_users int, p_max_sites int, p_storage_mb int, p_options jsonb)`
- `public.admin_set_feature(p_plan text, p_feature text, p_enabled boolean)`

Autres RPC 0010 liées (contexte) : `admin_change_plan`, `admin_set_establishment_status`.

## 2. Faits vérifiés dans les sources locales

### 2.1 `admin_create_establishment` (`0010` lignes ~37-73)
| Aspect | Constats (source locale) |
|---|---|
| Signature | `(p_name text, p_slug text, p_city text, p_phone text, p_plan subscription_plan default 'standard')` |
| Sécurité | `security definer`, `set search_path = public` |
| Contrôle d’accès interne | `if not public.is_saas_admin() then raise exception 'Accès réservé au Super Admin'; end if;` |
| Actions | `insert into establishments` + `insert into subscriptions` (status `active`, période +1 an) + `insert into audit_log` (`admin.create_establishment`) |
| Grants (0010) | `grant execute ... to authenticated` (avec autres RPC 0010) |
| Policies liées (0010) | `saas_admin_insert_establishments` (insert sur `establishments`), `saas_admin_all_audit_log`, `managers_insert_audit_log`, `saas_admin_all_subscriptions` |
| Risques/écarts notables | Aucune idempotence/`request_id`, pas de validation renforcée de slug/plan au-delà du type, pas de vérification d’unicité applicative explicite avant insert (dépend contrainte DB), pas de gestion d’erreurs/compensation structurée. Diffère du flux onboarding 0028 (idempotent, validations, `is_saas_admin()` + traçabilité `onboarding_requests`). |

### 2.2 `admin_save_plan` (`0010` lignes ~156-188)
| Aspect | Constats (source locale) |
|---|---|
| Signature | `(p_code text, p_label text, p_description text, p_price_monthly numeric, p_price_yearly numeric, p_currency text, p_trial_days int, p_max_users int, p_max_sites int, p_storage_mb int, p_options jsonb)` |
| Sécurité | `security definer`, `set search_path = public` |
| Contrôle d’accès interne | garde `is_saas_admin()` |
| Actions | `update plans` (label, description, prix, currency, trial, limites, options, `updated_at`) + `audit_log` (`admin.save_plan`) |
| Grants (0010) | `grant execute ... to authenticated` |
| Risques/écarts notables | Pas de contrôle de validité métier explicite des valeurs (bornes prix/limites/trial) dans le corps montré ; dépend des contraintes de table et de l’UI. Impact transverse (tous établissements sur le plan). |

### 2.3 `admin_set_feature` (`0010` lignes ~190-208)
| Aspect | Constats (source locale) |
|---|---|
| Signature | `(p_plan text, p_feature text, p_enabled boolean)` |
| Sécurité | `security definer`, `set search_path = public` |
| Contrôle d’accès interne | garde `is_saas_admin()` |
| Actions | `insert into plan_features ... on conflict (plan_code, feature_key) do update` + `audit_log` (`admin.set_feature`) |
| Grants (0010) | `grant execute ... to authenticated` |
| Risques/écarts notables | Pas de whitelist/validation de `p_feature`/`p_plan` visible dans la fonction (dépend FK/contraintes/données) ; changement de droits fonctionnels potentiellement large. |

## 3. Ce qui ne peut PAS être affirmé sans audit distant read-only (NON VÉRIFIABLE)
- État d’application réel de 0010/0015/0018/0026/0028/0029/0030/0031/0032 sur la base distante.
- Privilèges effectifs (`EXECUTE` pour `PUBLIC`, `anon`, `authenticated`, autres rôles), propriétaires, **fonctions surchargées/overloads** portant mêmes noms.
- Définitions effectives en base (peuvent différer des fichiers locaux) et `search_path`/options runtime effectifs.
- Politiques RLS réellement actives, rôles/auth config réelle, état des données impactées.
- **Valeurs historiques avant incident** : interdites d’invention ; aucune preuve disponible localement.

## 4. Risques (analyse préventive)
| Risque | Description | Gravité |
|---|---|---|
| Exposition via grants | `EXECUTE` accordé à `authenticated` (conception 0010) ; la sécurité repose sur le garde `is_saas_admin()` **et** sur la définition/effective de `is_saas_admin()` en base | P0 si garde absent/incorrect en prod |
| Surfaces de définition divergente | Si la fonction distante diffère (ou overload) ou si `is_saas_admin()`/helpers sont altérés, le comportement réel peut diverger des sources locales | Élevé |
| Effets de bord métier | Création établissement/abonnement, modification plans/features impactent droits, facturation logique, accès modules | Élevé |
| Traçabilité | Audit log prévu dans 0010, mais effectivité/protection du journal dépend du schéma/RLS réels | Moyen/Élevé |
| Absence d’idempotence (création) | Retries/appels multiples peuvent créer doublons si contraintes insuffisantes (à vérifier en base) | Moyen |

## 5. Plan de correction réversible (PRÉPARÉ — aucune exécution)
> Chaque étape ci-dessous est **conditionnée** à : autorisation explicite distincte, sauvegarde/PITR vérifiée, fenêtre contrôlée, exécution en environnement de test isolé d’abord si possible.

1. **Pré-contrôles (read-only, autorisés)** :
   - Inventorier définitions effectives, signatures/overloads, propriétaires, `prosecdef`, `search_path`, ACL/grants (`proacl`), dépendances.
   - Lister policies RLS et état RLS des tables concernées (`establishments`, `subscriptions`, `plans`, `plan_features`, `audit_log`, `profiles`).
   - Vérifier `is_saas_admin()` effectif et ses helpers (`autoplus_current_role`, `current_establishment_id`, `get_my_profile`).
   - Extraire comptages/échantillons **non sensibles** nécessaires au avant/après (sans exposer de données personnelles/secrets).
2. **Sauvegarde** : point PITR/export contrôlé selon `docs/PROCEDURE_SAUVEGARDE_RESTAURATION_VERIFIABLE.md` + preuve.
3. **Durcissement (candidats, à valider en revue)** :
   - Confirmer/renforcer garde `is_saas_admin()` au début de chaque fonction sensible ; `REVOKE` des droits `PUBLIC/anon` si présents ; maintenir `GRANT EXECUTE` minimal (ex. `authenticated`) uniquement si requis et sécurisé.
   - Vérifier `search_path` explicite et sûr (`public`, schémas nécessaires).
   - Aligner sur les patterns durcis récents (cf. 0028/0030 : validations, idempotence/contrôles, journalisation) **sans casser** les appels existants (compatibilité signatures/clients).
   - Éviter toute modification de données historiques sans preuve ; ne pas « réparer » des valeurs inconnues.
4. **Contrôles après correction** :
   - Re-vérifier définitions/grants/policies/RLS (avant/après).
   - Tests fonctionnels autorisés avec **comptes de test isolés** : appel autorisé (SA) OK, appel non autorisé refusé, pas d’escalade, audit généré, pas de doublon inattendu.
   - Vérifier non-régression des flux UI/RPC dépendants.
5. **Rollback** :
   - Si écart/incident : restauration vers point de sauvegarde validé (PITR/import) + consignation ; pas de restauration partielle non prouvée.
6. **Traçabilité** : consigner en GV5 (append-only) autorisations, références de sauvegarde, scripts exacts appliqués, résultats avant/après, preuves.

## 6. Tests et validations prévus (après levée ciblée du gel)
| Test | Attendu |
|---|---|
| Non-authentifié / anonyme | Aucun accès/exécution non autorisée (erreur d’autorisation, pas logique métier exposée) |
| `authenticated` non `saas_admin` | Refus explicite, aucun effet de bord |
| `saas_admin` autorisé (compte test) | Comportement nominal, audit écrit, intégrité respectée |
| Idempotence/doublons (création) | Conforme au design retenu (à définir/valider) |
| RLS/policies tables cibles | Pas de fuite cross-tenant ; SA conforme au besoin |
| Non-régression | Parcours SA existants inchangés ou améliorés selon correction validée |

## 7. Statut du dossier
- **Fait et vérifié (local)** : identification des 3 RPC, lecture des définitions/grants/policies prévus dans 0010/0032, analyse des risques et plan réversible préparé.
- **Bloqué par autorisation / gel P0** : tout audit distant, toute correction, toute sauvegarde/restauration/exécution réelle.
- **Non vérifié** : état réel distant, valeurs historiques avant incident, privilèges/overloads/propriétaires effectifs.

# GV5 §60 — Audit EXECUTE PUBLIC des fonctions SECURITY DEFINER

Date : 17 novembre 2026. Diagnostic par SELECT sur pg_proc.proacl + aclexplode(grantee=0 = PUBLIC).

## Correction importante de §59

§59 avait conclu (à tort) que les RPC `admin_*` n'avaient pas de PUBLIC EXECUTE. Cette conclusion venait d'une requête `aclexplode` avec JOIN interne sur `pg_roles` : le grantee PUBLIC a OID 0, absent de pg_roles → les lignes PUBLIC étaient écartées. La requête corrective filtre directement `a.grantee = 0` sur `proacl`. Résultat : **15 fonctions SECURITY DEFINER ont EXECUTE PUBLIC**.

## 1. Fonctions avec EXECUTE PUBLIC explicite (=X/postgres dans proacl)

| Fonction | proacl | Correctif 0037 |
|---|---|---|
| admin_change_plan() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_create_establishment() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_expire_subscription() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_reactivate_subscription() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_renew_subscription() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_save_plan() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_set_establishment_status() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| admin_set_feature() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| decrement_product_stock() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| my_features() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |
| open_ticket_count() | =X/postgres, postgres=X, authenticated=X | revoke from public + grant authenticated |

## 2. Fonctions avec proacl NULL → EXECUTE PUBLIC par défaut

| Fonction | Sécurité | search_path | Correctif |
|---|---|---|---|
| is_saas_admin() | SECURITY DEFINER | public (déjà fixé) | revoke from public, grant authenticated |
| current_establishment_id() | SECURITY DEFINER | public (déjà fixé) | revoke from public, grant authenticated |
| autoplus_current_role() | SECURITY DEFINER | public (déjà fixé) | revoke from public, grant authenticated |
| is_manager() | SECURITY INVOKER | AUCUN | 0037 : passer SECURITY DEFINER + search_path + revoke/grant |

## 3. Analyse d'exploitabilité (ne pas confondre proacl NULL et exploitabilité)

EXECUTE PUBLIC sur une fonction SECURITY DEFINER signifie que toute session (y compris `anon`) peut l'appeler. Le risque réel dépend du corps de la fonction :
- `is_saas_admin()`, `current_establishment_id()`, `autoplus_current_role()` : lisent `auth.uid()`/profiles. Appelables par anon, elles retournent false/NULL (pas d'élévation en soi), mais elles élargissent la surface d'appel et l'empreinte d'attaque. **P0 à corriger par hygiène de sécurité**.
- `admin_*` : disposent d'un garde interne `if not is_saas_admin() then raise` (vérifié dans 0039/0036). Un appel anon lève une exception → pas d'exécution des effets. Le risque est donc **mitigé par le garde interne**, mais la correction 0037 reste nécessaire (défense en profondeur + conformité).
- `decrement_product_stock`, `open_ticket_count` : SECURITY DEFINER avec logique métier ; exposées PUBLIC. Risque d'abus (appels répétés). À restreindre à authenticated.

## 4. Matrice des droits attendus (avant/après)

| Catégorie | Avant | Après (0037) |
|---|---|---|
| Helpers (is_saas_admin, current_establishment_id, autoplus_current_role, is_manager) | PUBLIC + propriétaire | authenticated + propriétaire |
| admin_* (11) | PUBLIC + authenticated + propriétaire | authenticated + propriétaire |
| my_features, decrement_product_stock, open_ticket_count | PUBLIC + authenticated | authenticated |
| resolve_login_email | (absent) | anon + authenticated (connexion pré-auth, prévu 0039) |

## 5. Correction SQL minimale (extrait de 0037 — NON APPLIQUÉE)

```sql
-- Exemple pour un helper
revoke all on function public.is_saas_admin() from public;
grant execute on function public.is_saas_admin() to authenticated;
-- Répété pour chaque fonction listée ; is_manager passe aussi SECURITY DEFINER + search_path=public
```

Risque couvert : réduction de la surface d'appel anon. Effets secondaires possibles : si une policy RLS ou un trigger appelle ces fonctions en tant qu'anon, l'appel échouera après revoke. Les policies auditées utilisent ces fonctions dans un contexte `authenticated` (saas_admin/manager) → non-régression attendue, à confirmer par les tests de non-régression.

## 6. Requêtes de vérification après application

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace, aclexplode(p.proacl) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE' and p.prosecdef;
-- doit retourner 0 ligne
select prosecdef, proconfig from pg_proc where proname='is_manager';
-- doit retourner true, {search_path=public}
```

## 7. Tests de non-régression

- Appel `select is_saas_admin()` en tant qu'anon → doit échouer (permission denied) au lieu de retourner false.
- Appel en tant que saas_admin → true.
- Connexion Super Admin (get_my_profile) → inchangée.
- Création abonné via RPC admin_onboard_tenant_v2 (après 0039) → inchangée.


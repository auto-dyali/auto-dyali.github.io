# GV5 §118 — Rapport final de session

Branche : `gv5-107-prod-final`. HEAD initial : `8f8d04e809f34c13bf0623c339e95a8895db2f15`.

## Distinction des états

| Élément | État |
|---|---|
| Migration `20261126040000` (GRANT SELECT service_role) | **Développé / testé localement / commité / poussé** |
| Rollback correspondant | **Développé / testé localement / commité / poussé** |
| Tests §117 renforcés (9 scénarios) | **Exécutés en LOCAL** |
| Complément Pays/Région/Ville | **Développé / testé localement / commité / poussé** |
| Tests géographie (7) | **Exécutés en LOCAL** |
| Suite complète (253), tsc, lint, build | **Exécutés en LOCAL** |
| Edge Function `onboard-tenant` | **Non modifiée** ; contrôles conservés, vérifiés statiquement |
| Validation STAGING | **Non exécutée** (GO et identifiants absents) |
| Application en PRODUCTION | **Non exécutée** (GO absent) |
| Déploiement EF / fusion PR #2 / Pages | **Non exécutés** |

## Cause et correction

Cause : absence de privilège SQL `SELECT` pour `service_role` sur `public.profiles` (ACL `Dxtm`) alors que l'EF lit `role, is_active` avec la clé de service. Correction : migration additive à une seule instruction `GRANT SELECT ON public.profiles TO service_role;`, sans commentaire, sans altération de RLS ni des droits de `anon`/`authenticated`/`PUBLIC`. Rollback explicite `REVOKE SELECT … FROM service_role`, testé.

Complément géographique : le filtre par région n'utilisait que les 142 villes historiques ; les villes GeoNames étaient masquées quand une région était choisie. Une table dédiée par région est générée et utilisée par le composant, avec reset des sélections incompatibles et états de chargement/vide.

## Preuves locales

`test-service-role-profiles-select.mjs` 9/9 ; `test-geographie-form.mjs` 7/7 ; `npm test` 253/253 ; `tsc` OK ; ESLint 0 erreur / 20 warnings préexistants ; `next build` OK ; générateur GeoNames `--check` OK.

## Reste ouvert

GO pour staging, identifiants de test, exécution du plan `§118_STAGING_PLAN.md`, puis GO distinct pour production. Aucune déclaration de réparation en production avant application et vérification réelles.

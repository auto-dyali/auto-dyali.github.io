# GV5 §64 — Plan de préparation du staging Supabase

Date : 17 novembre 2026. Aucun projet de staging créé — autorisation requise.

## Règles

- Ne jamais réutiliser la production comme staging (projet nxmsqqoflskfajqrqddw intact).
- Ne jamais faire pointer le frontend de production vers le staging.
- Ne pas réutiliser les secrets de production.
- Données synthétiques uniquement (pas de données personnelles de production).

## Inventaire nécessaire

| Élément | État | Action requise |
|---|---|---|
| Projet Supabase isolé | ABSENT | Création après autorisation explicite |
| Auth | à configurer | activer, créer 3 comptes de test |
| PostgreSQL | à configurer | schéma de base 0001-0035 ou restauration contrôlée |
| Storage | à configurer | buckets de test si nécessaires |
| Edge Functions | non déployées | déployer EF onboarding après migrations validées |
| Variables d environnement | absentes | secrets de TEST distincts (jamais ceux de prod) |
| 2 établissements synthétiques | à créer | Est A / Est B |
| 1 compte saas_admin de test | à créer | rôle saas_admin |

## Décision

**BLOQUÉ — AUCUN STAGING EXISTANT.** Préparer dossier de création et attendre autorisation du propriétaire. Ne pas créer de projet automatiquement.


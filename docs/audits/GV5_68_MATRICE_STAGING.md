# GV5 §68 — Matrice staging

Date : 18 novembre 2026. Environnement MCP confirmé : PRODUCTION `nxmsqqoflskfajqrqddw` (get_project_url = https://nxmsqqoflskfajqrqddw.supabase.co).

## 1. Recherche d un staging

Outils MCP vérifiés : aucun outil `list_projects` / `create_project` n existe. Les seuls outils Supabase disponibles agissent sur LE projet connecté (production). **Aucun staging accessible ni créable sans intervention externe.**

| Critère | Production (connectée) | Staging requis |
|---|---|---|
| Identifiant | nxmsqqoflskfajqrqddw | à fournir par le propriétaire |
| URL | https://nxmsqqoflskfajqrqddw.supabase.co | URL distincte à confirmer |
| Rôle | PRODUCTION — jamais environnement de test | isolé, données synthétiques |
| Migration 0036-0039 | absentes | à appliquer après PITR vérifié |
| EF v1 déployée | onboard-tenant (v1) | à remplacer par v2 |

## 2. Caractéristiques minimales du staging à créer

- Projet Supabase **distinct** (nouvel ID + nouvelle URL), région proche de la prod.
- PostgreSQL avec extensions `pgcrypto`, `uuid-ossp`.
- Auth activée (confirmation e-mail, fournisseur e-mail de test).
- Storage minimal (buckets de test si nécessaires).
- Aucune donnée de production copiée ; 2 établissements synthétiques + 1 saas_admin de test.
- Secrets de TEST distincts (jamais ceux de la prod).

## 3. Procédure de liaison (à exécuter après création)

1. Le propriétaire fournit URL + ID du projet staging.
2. Vérifier `get_project_url` pointe sur le NOUVEL ID (jamais nxmsqqoflskfajqrqddw).
3. Configurer les secrets de test via l environnement sécurisé Supabase (Dashboard → Edge Functions → Secrets).
4. Vérifier PITR/sauvegarde du staging.
5. Appliquer migrations + déployer EF v2 sur staging uniquement.

Checklist sécurité : ID distinct ✓, URL distincte ✓, secrets distincts ✓, données synthétiques ✓, PITR vérifié ✓, accès restreint ✓. **Aucune de ces cases n est cochée à ce jour** (staging inexistant).


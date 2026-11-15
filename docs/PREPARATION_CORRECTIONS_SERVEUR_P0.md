# Préparation des corrections serveur (gel P0 — NON EXÉCUTÉES)

> **Statut : préparé uniquement.** Aucune migration, RPC de mutation, modification Auth/RLS/permissions/secrets, déploiement d’Edge Function, restauration ou écriture distante n’a été exécutée, conformément au gel P0.

## 1. Migrations en attente / durcissement
- **Fichiers préparés** : `supabase/migrations/0030_harden_is_saas_admin.sql`, `supabase/migrations/0031_secure_audit_and_platform_config.sql`, `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql`, `supabase/apply/GUIDE_EXECUTION_MIGRATIONS_PENDING.md`.
- **Procédure (après autorisation explicite)** : sauvegarde/PITR vérifiée → exécution contrôlée via SQL Editor (ordre validé) → vérification post-migration (fonctions, RLS, accès) → journalisation dans GV5.
- **Dépendances** : accès owner/Dashboard, fenêtre de maintenance, validation des scripts en environnement non-prod si disponible.
- **Tests après déblocage** : guards/RBAC effectifs, isolation tenant, audit_log protégé, non-régression parcours SA/Manager.

## 2. Edge Function `onboard-tenant`
- **Source** : `supabase/functions/onboard-tenant/index.ts` (caller/admin, idempotence, validations).
- **Procédure** : déploiement via Dashboard/CLI autorisé → configuration secrets serveur (sans exposition) → test avec comptes de test isolés → vérification emails/invitations.
- **Dépendances** : accès Supabase Dashboard, service role/config sécurisée, SMTP/Auth configurés.
- **Tests** : création entreprise+manager (test), doublons, idempotence, rollback logique, isolation tenant.

## 3. Auth, invitations, mots de passe
- **À préparer** : domaines `.ma`, SMTP, Redirect URLs, templates invitation/reset, expiration/usage unique.
- **Dépendances** : configuration fournisseur email et Dashboard Auth.
- **Tests** : invitation unique/expirée, reset sécurisé, activation, aucun mot de passe en clair.

## 4. Permissions/RLS côté serveur
- **Objectif** : refus par défaut, contrôle serveur obligatoire, isolation inter-entreprises, traçabilité changements sensibles.
- **Dépendances** : migrations/policies validées et appliquées (gel P0).
- **Tests** : tentatives cross-tenant, rôles non autorisés, élévation de privilèges.

## 5. Sauvegardes, restauration, intégrations
- **Sauvegardes/PITR** : vérifier existence réelle, procédures et restaurabilité prouvée avant toute promesse.
- **Paiements/WhatsApp/IA** : intégrations réelles, webhooks sécurisés/idempotents, quotas/erreurs — **aucune simulation d’encaissement/envoi**.
- **Dépendances** : accès infra/fournisseurs, clés/secrets, autorisations.

Chaque action distante doit être exécutée uniquement après autorisation explicite distincte, avec preuve avant/après consignée en GV5 (append-only).

# GV5 §118 — Plan de validation STAGING (PRÉPARÉ, NON EXÉCUTÉ)

Aucune opération de ce document n'a été lancée. Aucun secret ni identifiant n'est Représenté ici.

## Préconditions

1. GO écrit distinct pour toute écriture sur le projet de staging.
2. Variables locales présentes (noms seulement) : `GV5_STAGING_URL`, `GV5_STAGING_ANON_KEY`, `GV5_STAGING_SERVICE_ROLE_KEY`, `GV5_STAGING_SA_EMAIL`, `GV5_STAGING_SA_PASSWORD`.
3. Vérifier le projet ciblé : ref staging uniquement ; refus immédiat si la cible est la production.
4. Sauvegarde logique compatible Supabase Free (schéma + données utiles, checksums) avant toute application.
5. Rollback disponible : `supabase/rollbacks/gv5108/20261126040000.sql`.

## Ordre opératoire

1. Contrôle avant : rôles et privilèges sur `public.profiles` (`service_role` SELECT attendu `false` avant correction), RLS active, politiques inchangées.
2. Application de `20261126040000` uniquement après GO.
3. Contrôle post-ACL : `service_role SELECT=true`, `anon SELECT=false`, `authenticated` inchangé, RLS active, politiques inchangées, aucune autre table modifiée.
4. Connexion avec le Super Admin de test : session JWT valide, profil `role=saas_admin`, `is_active=true`.
5. Appel `onboard-tenant` avec un garage préfixé `ZZ-TEST-…` et un Manager de test.
6. Vérifications : garage, compte Auth Manager, profil, permissions, abonnement Trial, invitation, audit `onboard_tenant_v2`.
7. Géographie : Pays `MA`, 12 régions, villes filtrées par région (528 au total), reset pays/région/ville, relecture des valeurs.
8. Notification interne Super Admin : ligne dans `super_admin_notifications` **uniquement si** la migration additive correspondante a été appliquée (GO séparé) ; sinon statut `indisponible`.
9. Canaux : distinguer création effective, invitation créée, e-mail accepté par fournisseur, message réellement livré. Sans secrets fournisseur, statut `non_configure` attendu.
10. Nettoyage : uniquement les données `ZZ-TEST-…` créées, après autorisation ; jamais les comptes préexistants.
11. Rapport : résultats par étape, comptages, statuts, captures éventuelles, SHA des scripts appliqués.

## Critères d'acceptation

- Contrôle du profil Super Admin réussi sans `permission denied`.
- Création complète et cohérente, aucune donnée partielle.
- Isolation multi-tenant conservée.
- Aucun secret, jeton ou donnée personnelle dans le rapport.

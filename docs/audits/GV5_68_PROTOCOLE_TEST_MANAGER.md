# GV5 §68 — Protocole de test du premier Manager (STAGING — NON EXÉCUTÉ)

Date : 18 novembre 2026. Aucun compte réel créé. Destinataire de test à autoriser explicitement. Données synthétiques uniquement.

## Préconditions

Migrations 0036-0039 appliquées sur staging, EF v2 déployées, secrets configurés, PITR vérifié, destinataire de test autorisé.

## Étapes et critères

| # | Action | Résultat attendu | Preuve à conserver |
|---|---|---|---|
| 1 | Créer établissement de test depuis le formulaire v2 | id établissement retourné | réponse RPC admin_onboard_tenant_v2 |
| 2 | Vérifier identifiant pro | format ADY-PRO-XXXXXX, unique | SELECT establishments.professional_id (masquer si demandé) |
| 3 | Vérifier identifiant connexion Manager | login_id unique | SELECT profiles.login_id |
| 4 | Création Auth réelle | auth.users contient le Manager (ID UUID) | admin.auth.admin.createUser réussi |
| 5 | Liaison profil/établissement/abonnement/permissions | 1 profil, 1 abonnement, N permissions cohérentes | SELECT_join |
| 6 | Invitation e-mail | statut `accepte_par_fournisseur` + id message Resend | réponse adaptateur |
| 7 | Invitation WhatsApp | statut indépendant + id message Meta | réponse adaptateur |
| 8 | Échec d un canal | l autre canal reste accepté | statuts indépendants |
| 9 | Ouvrir lien d activation | preview sans consommer le jeton | status invitation inchangé |
| 10 | Définir mot de passe | updateUserById, jeton consommé, status=accepted | réponse activate-manager |
| 11 | Première connexion | signInWithPassword réussi (vérification EF 2c) | réponse EF |
| 12 | Accès au bon établissement | current_establishment_id() = établissement A | RPC |
| 13 | Isolation | 0 ticket/donnée de B visibles depuis A | SELECT RLS |

## Règles

- Le mot de passe est choisi par le Manager via le lien ; jamais transmis, journalisé ou stocké en clair.
- Ne jamais annoncer « livré » sans webhook fournisseur signé.
- Si un seul canal fonctionne : conserver le résultat partiel et documenter l autre.

Statut actuel : **BLOQUÉ** (aucun staging, migrations/EF/secrets absents). Critère de réussite NON atteint.


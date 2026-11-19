# GV5 §60 — Analyse détaillée des migrations 0036–0039

Date : 17 novembre 2026. Toutes les migrations sont PRÉPARÉES — NON APPLIQUÉES. Le code source fait foi.

## Ordre d'application confirmé : 0036 → 0037 → 0038 → 0039

Raison : 0039 a un pré-contrôle explicite `ARRÊT 0039: table invitations absente (migration 0036)` (ligne 31). 0036 exige 0028 + is_saas_admin + pgcrypto. 0037/0038 sont indépendantes mais doivent précéder 0039 pour la cohérence des droits.

## 0036 — Invitations Manager sécurisées (485 lignes)

- Objets : fonctions gen_invitation_token, hash_invitation_token ; tables `invitations` (hash du token, statuts par canal email/whatsapp, usage unique, expiration), `invitation_events` (historique, RPC-only write) ; indexes lower(email), status, establishment_id, manager_user_id ; RPC admin_expire_stale_invitations, admin_preview_invitation, admin_accept_invitation, admin_record_delivery, admin_prepare_resend.
- Dépendances : 0028 (onboarding_requests, is_saas_admin), 0001 (establishments), extension pgcrypto.
- Sécurité : token uniquement haché (SHA-256), preview sans consommation, statuts honnêtes.
- Risques : collision de token (aléa cryptographique, faible) ; historique en écriture RPC uniquement. Idempotence : `create table if not exists`, `create index if not exists`. Reprise après échec : pré-contrôles au début.

## 0037 — Durcissement sécurité P0 (177 lignes)

- Objets : is_manager() → SECURITY DEFINER + search_path=public ; revoke PUBLIC sur ~18 fonctions + grant authenticated.
- Décision explicite : FORCE ROW LEVEL SECURITY NON activé (casserait les RPC SECURITY DEFINER). Policies restrictives de rotation de mot de passe dans 0039.
- Risques : casser un appel légitime anon (à tester) ; ne PAS révoquer sans ré-accorder authenticated (la migration le fait).

## 0038 — Sécurité RLS et index (161 lignes)

- Objets : policies restrictives sur audit_log/establishments (remplacement des multiples PERMISSIVES), index sur ~61 clés étrangères non couvertes.
- État distant : 80 FK dont 16 indexées → 64 à couvrir (l'estimation §46 de 61 est proche).
- Risques : changement de comportement RLS (à tester en multi-tenant) ; index = charge d'écriture légère.

## 0039 — Identités/permissions/onboarding v2 (729 lignes)

- Objets : `establishments.professional_id` (text unique index), `profiles.login_id` (text unique index), `profiles.must_change_password`/`temporary_password_expires_at`/`password_changed_at`, `onboarding_requests` extensions ; RPC must_change_password, get_my_security_state, resolve_login_email (anon), my_features/has_feature/my_permissions (intersection forfait∩permissions), admin_check_identity_available, admin_onboard_tenant_v2 ( SECURITY DEFINER + advisory lock idempotence), admin_complete_password_change ; policies permissions_tenant_select / permissions_saas_admin_write / password_rotation_required.
- Dépendances : 0036 (invitations), 0028, 0001, is_saas_admin.
- Données historiques : colonnes ajoutées **nullables** (pas de NOT NULL forcé) → 2 établissements et 1 profil existants conservés, aucun identifiant automatique. Unique index tolère les NULL.
- Risques : collision d'identifiant (gérée par unique index + RPC de contrôle) ; `resolve_login_email` exposé anon (surface d'énumération, hors périmètre SA) ; garde `is_saas_admin()` sur RPC admin.
- Idempotence : `create or replace function`, `alter table add column if not exists` (vérifié dans le SQL), `create unique index if not exists`.

## 7. Données historiques — stratégie

Aucune valeur professional_id/login_id n'existe en distant (colonnes absentes). Les identifiants historiques sont : slug (`garage-atlas`, `auto-dyali-garage`) et UUID. La migration 0039 n'impose pas de valeur : elle ajoute des colonnes nullables avec index unique. Aucune suppression ou réécriture d'identifiant historique. La stratégie à deux niveaux est détaillée dans GV5_60_DECISION_IDENTIFIANTS.md.

## 8. Conditions de retour arrière

Migrations additives : aucun DROP de table/données. Retour arrière = restauration PITR/sauvegarde (pas de script DOWN destructif). Si 0039 échoue en cours : les colonnes déjà ajoutées sont nullables et inoffensives ; ne pas réappliquer tant que l'état réel n'est pas audité. Arrêt immédiat de la séquence dès la première erreur.


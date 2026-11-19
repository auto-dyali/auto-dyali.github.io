# GV5 §68 — Plan de déploiement Supabase contrôlé (NON EXÉCUTÉ)

Date : 18 novembre 2026. Toutes les étapes nécessitent autorisation explicite. Aucune exécution réelle.

## 1. Préconditions

1. Projet staging isolé créé et confirmé (ID + URL distincts de nxmsqqoflskfajqrqddw).
2. PITR/sauvegarde du staging vérifiée restaurable.
3. Secrets de test configurés dans l environnement sécurisé.
4. Autorisation explicite pour migrations + déploiement EF sur staging.

## 2. Ordre d application

1. **0036_invitations_manager** (prérequis : 0028, pgcrypto, is_saas_admin). Objets : invitations, invitation_events, hash token, statuts par canal.
2. **0037_fix_security_p0** (is_manager DEFINER + search_path, revoke PUBLIC sur ~18 fns). ⚠️ NE PAS réappliquer remediation_062/001 (déjà inclus).
3. **0038_security_rls_indexes** (policies restrictives, index FK).
4. **0039_onboarding_identity_v2** (professional_id, login_id, must_change_password, RPC v2, permissions). Prérequis : 0036 (table invitations).
5. **remediation_062/002** (garde establishment de open_ticket_count) — absente de 0037.
6. **Déployer EF v2** : onboard-tenant, activate-manager, send-invitation (code local).

## 3. Contrôles après chaque étape

Rejouer `supabase/security/remediation_063/001_read_only_verification.sql` (SELECT seul). Attendus : 3 colonnes identité, 2 tables invitations, RPC v2 présentes, 0 SECDEF PUBLIC, RLS active. Utiliser `list_migrations` pour confirmer l historique.

## 4. Règles anti-doublon et arrêt

- Ne jamais réappliquer 0037 + 062/001 (même correction is_manager).
- Si une migration échoue : arrêt immédiat, collecter l erreur (sans secret), auditer l état réel, pas d improvisation.
- Rollback : restauration PITR du staging (jamais suppression de données). Ne pas promettre de DOWN destructif.

## 5. Critères d acceptation staging

Tous les contrôles SELECT verts + protocole test Manager (GV5_68_PROTOCOLE_TEST_MANAGER) réussi. Ensuite seulement : décision GO staging, puis **autorisation DISTINCTE** pour la production.


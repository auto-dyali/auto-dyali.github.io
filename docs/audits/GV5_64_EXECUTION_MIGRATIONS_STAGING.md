# GV5 §64 — Exécution du scénario A sur staging (PRÉPARÉE — NON EXÉCUTÉE)

Date : 17 novembre 2026. Aucune migration appliquée, ni sur production ni sur staging.

## Règle anti-doublon

- 0037 contient déjà : is_manager → DEFINER + search_path=public + appel qualifié, et revoke PUBLIC sur open_ticket_count et les admin_*. **Ne pas réappliquer remediation_062/001 après 0037** (redondance ; 0037 search_path=public reste sûr).
- Après 0039, appliquer remediation_062/002 (garde tenant open_ticket_count : establishment dérivé de auth.uid(), paramètre client ignoré) car 0037 ne contient QUE le revoke PUBLIC, pas la garde interne.

## Ordre prévu (scénario A)

1. 0036_invitations_manager (prérequis : 0028, pgcrypto, is_saas_admin).
2. 0037_fix_security_p0 (dépend : is_manager présente).
3. 0038_security_rls_indexes.
4. 0039_onboarding_identity_v2 (dépend : table invitations de 0036).
5. remediation_062/002 (garde open_ticket_count).

## Contrôles avant / après chaque étape

Avant : prérequis, signatures, absence de doublons, historique. Après : code de sortie, schéma, permissions, fonctions, RLS, comparaison aux attendus. Rejouer remediation_063/001_read_only_verification.sql.

## En cas d échec

Arrêt immédiat de la chaîne, collecte de l erreur (sans secret), détermination de l état réel, pas d improvisation distante, documenter le blocage. Rollback = restauration PITR/backup (voir plan rollback).

## Conclusion

**BLOQUÉ — AUCUNE AUTORISATION D APPLICATION SUR STAGING.** Scripts préparés, en attente d autorisation explicite. Aucune migration sur la production.


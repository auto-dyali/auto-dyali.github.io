# GV5 §64 — Restauration et validation du staging

Date : 17 novembre 2026. Aucune restauration effectuée.

## État

Aucun staging autorisé et aucune sauvegarde distante restaurable vérifiée (voir GV5_64_AUDIT_BACKUP.md : BLOQUÉ). La condition de déclenchement de la Phase 4 n est donc pas réunie.

## Procédure reproductible préparée (à exécuter après autorisation)

1. Créer projet Supabase de staging isolé (autorisation requise).
2. Restaurer la sauvegarde/PITR de production dans CE projet uniquement (autorisation requise), sans secrets ni données personnelles non nécessaires ; anonymiser si besoin.
3. Vérifier schéma : tables/colonnes/constraints, fonctions/triggers, politiques RLS, index, dépendances.
4. Vérifier comptes de test et données synthétiques (2 établissements A/B, 1 saas_admin).
5. Documenter les différences production/staging.

## Conclusion

**BLOQUÉ — RESTAURATION NON EFFECTUÉE.** Aucune preuve de staging opérationnel. Ne pas écrire « staging validé » sans tests réels.


# GV5 §62 — Plan d'application contrôlé Supabase (NON EXÉCUTÉ)

Date : 17 novembre 2026. Toutes les étapes ci-dessous nécessitent une autorisation explicite distincte.

## 1. Préconditions

1. Autorisation écrite + sauvegarde/PITR vérifiée.
2. Audit SELECT à jour (rejouer remediation_061/001_inventory.sql).
3. Décision sur l'ordre : appliquer 0036-0039 (qui contiennent déjà les corrections) OU appliquer seulement remediation_062/001+002 si les migrations restent gelées.

## 2. Deux scénarios cohérents (ne pas cumuler aveuglément)

**Scénario A — migrations appliquées** : 0036 → 0037 → 0038 → 0039. 0037 contient déjà le durcissement is_manager (DEFINER + search_path=public + appel qualifié) et le revoke PUBLIC de open_ticket_count. Dans ce scénario, ne PAS réappliquer 062/001 tel quel (search_path pg_catalog,public vs public : préférer la version 0037 pour cohérence) mais appliquer 062/002 (garde tenant de open_ticket_count, absente de 0037).

**Scénario B — migrations gelées** : appliquer 062/001 (is_manager avec search_path=pg_catalog,public — plus strict que 0037) puis 062/002 (open_ticket_count garde), puis 061/002 (revoke PUBLIC des 15). Les trois sont idempotents (create or replace / revoke).

## 3. Contrôles préalables

- Vérifier is_manager() et autoplus_current_role() existent.
- Vérifier aucune dépendance de policy RLS nécessitant l'accès anon à ces fonctions (audité : non).
- Vérifier 0 appel frontend de open_ticket_count (audité : aucun).

## 4. Contrôles après application

Rejouer remediation_061/006_post_remediation_verification.sql : 0 fonction SECURITY DEFINER avec grantee=0, is_manager prosecdef=true, authenticated conserve EXECUTE sur admin_*, RLS active sur toutes les tables.

## 5. Critères d'arrêt

- Erreur SQL à une étape → arrêt immédiat, collecter l'erreur, ne pas appliquer la suite.
- Perte d'accès authenticated aux admin_* → corriger avant de continuer.
- Anomalie de données historiques → arrêt.

## 6. Rollback et reprise

Chaque script 062 contient une section ROLLBACK commentée (retour à la définition d'origine — qui rétablit volontairement la vulnérabilité, à n'utiliser qu'en cas de régression bloquante). Pas de DROP, pas de suppression de données. Reprise = auditer l'état réel puis rejouer le script concerné (idempotent).

## 7. Opérations exigeant autorisation distincte

Toute exécution SQL distante, déploiement EF, modification secrets, push GitHub. Aucune n'a été effectuée dans cette mission.


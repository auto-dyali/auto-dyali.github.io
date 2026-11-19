# GV5 §64 — Plan de retour arrière

Date : 17 novembre 2026. Aucune opération à annuler (rien n a été appliqué). Plan préparé pour le futur.

## Principes

- Ne jamais supprimer de données pour revenir en arrière.
- Ne pas promettre de rollback automatique si une migration est destructive (aucune ne l est : 0036-0039 sont additives).
- Distinguer rollback SQL / restauration complète / PITR / Storage.

| Opération | État initial | Changement | Retour | Risque / critère d arrêt |
|---|---|---|---|---|
| Migrations 0036-0039 | schéma sans colonnes v2 | ajouts uniquement | restauration PITR/backup (pas de DOWN destructif) | si échec : arrêt chaîne, pas de suppression |
| is_manager (0037) | INVOKER, pas de search_path | DEFINER + search_path | script rollback commenté §62/001 | si régression d accès manager |
| open_ticket_count (062/002) | count direct paramètre | garde auth.uid() | script rollback commenté §62/002 | si comptage légitime cassé |
| REVOKE PUBLIC (0037/061/002) | PUBLIC EXECUTE | authenticated seul | GRANT ciblé à authenticated (déjà prévu) | perte d accès authenticated → corriger |
| Policies RLS (0038/0039) | PERMISSIVE | restrictives | restaurer anciennes policies depuis backup | fuite inter-tenant → arrêt |
| Index (0038/005) | FK non indexées | CREATE INDEX CONCURRENTLY | DROP INDEX CONCURRENTLY (non destructif pour données) | charge production |
| Storage / EF | inchangé | hors périmètre §64 | restauration dédiée | — |

Rappel : la restauration PITR efface les données créées APRÈS le point de restauration — à éviter si possible ; préférer la correction en avant.


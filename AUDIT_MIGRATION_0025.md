# AUDIT MIGRATION 0025 — AUTO DYALI

**Date** : 9 novembre 2026 · **Type** : inspection et préparation uniquement.  
**Migration auditée** : `supabase/migrations/0025_pos_core.sql`  
**Décision** : **PRÊTE SOUS RÉSERVE DE CORRECTIONS** (procédure d’exécution — voir §C point 1).  
Aucune migration exécutée, aucune donnée modifiée, aucun push effectué dans cette mission.

---

## A. État de la sauvegarde

| Élément | Résultat |
|---|---|
| Fichier trouvé | `backups/2026-11-09/auto_dyali_avant_migration_0025.dump` |
| Taille | 413 872 octets (408K) |
| Permissions | Fichier `600`, dossier `700` (vérifiés) |
| Format | PostgreSQL CUSTOM `v1.16-0`, magie `PGDMP` (vérifiés par `file` et en-tête binaire) |
| SHA-256 | `96cf1404f0067c790e3781adb16b6837093e950bfcbde4fcf9b15c838a4e72ad` |
| Contenu vérifié | Format et en-tête vérifiés. **Liste TOC (`pg_restore --list`) NON reproductible ici** : l’outil `pg_restore` est absent de cet environnement. Les 684 entrées annoncées ne sont donc **pas confirmées** par cet audit. |
| Limites connues | Un dump PostgreSQL ne sauvegarde **pas** les fichiers binaires de Supabase Storage, ni les paramètres du projet, secrets ou configurations externes. Une liste TOC ne vaut pas une restauration testée. |

## B. État Supabase

- **Connexion vérifiée** : non (accès distant non disponible pour une comparaison de schéma ; seule la clé publique est présente, aucun accès `service_role`).
- **Schéma réel vérifié** : non.
- **Migrations déployées** : non vérifiées (historique Supabase inaccessible ici). Le dépôt contient `0001` → `0025`.
- **Différences identifiées** : non mesurables sans accès. Deux dépendances devront être confirmées avant exécution : la colonne `sales.vehicle_id` (migration `0021`) et les fonctions assistantes `current_establishment_id()` / `autoplus_current_role()` (définies en `0001`, redéfinies en `0002`/`0007` — présentes dans Git).

## C. Audit migration 0025

### Changements prévus (aucun destuctif)
1. `alter type payment_method add value if not exists 'avoir'` (extension d’enum, irréversible en PostgreSQL — noté dans le fichier).
2. `alter table clients add column if not exists consents jsonb not null default '{}'` (remplit les lignes existantes avec `{}` — aucune perte).
3. `create or replace function create_pos_sale_v2(...)` (`security definer`, `search_path = public`) : recalcul serveur des totaux, statut dérivé du solde, prestations sans stock, anti-doublon `(establishment_id, reference)`.
4. `revoke` sur `public, anon` + `grant execute` à `authenticated` uniquement.
5. Aucune table créée, aucun trigger, aucune politique RLS ajoutée, aucune donnée modifiée.

### Dépendances (vérifiées dans Git)
- Enum `payment_method` (`0001`, `0011` mobile) ; table `clients` (`0001`) ; `permissions` (`0001`) ; `sales` unicité `(establishment_id, reference)` (`0001`) ; `sale_items` FK composite (`0001`) ; `stock_movements`, `products.stock` (`0001`) ; `auth.uid()` ; **colonne `sales.vehicle_id` dépendante de `0021`**.

### Risques et problèmes
1. **Ordre d’exécution de l’enum (moyenne)** : `ADD VALUE` + fonction utilisant `avoir` dans la même transaction. PostgreSQL permet `ADD VALUE` en transaction mais la nouvelle valeur n’est utilisable qu’après COMMIT. **Correction de procédure** : exécuter la ligne `alter type ... 'avoir'` séparément, valider, puis exécuter le reste (colonne + fonction).
2. **Dépendance `0021` (moyenne)** : si `sales.vehicle_id` n’existe pas encore (0021 non appliquée), l’INSERT de `create_pos_sale_v2` échouera à l’exécution. Vérifier 0021 avant 0025.
3. **Stock insuffisant non bloquant (faible)** : `create_pos_sale_v2` décrémente avec `greatest(stock − qté, 0)` — aucun refus de vente pour stock insuffisant (même comportement que 0021 ; pas de régression).
4. **Statut affiché (faible)** : le frontend renvoie son propre statut calculé ; le serveur dérive le sien. En cas d’écart d’arrondi d’un centime, l’affichage peut différer d’une ligne. Serveur source de vérité — ne pas corriger côté client.
5. **RLS (faible)** : la fonction est `security definer` ; elle vérifie `current_establishment_id()` et `permissions` avant écriture. Revoke/grant corrects. Aucune politique trop permissive introduite.
6. **Auth/rôles** : aucune modification. Le contrôle `manager`/`saas_admin` ou `pos.can_edit` est repris de 0021 à l’identique.
7. **Compatibilité frontend** : `sales.service.ts` appelle `create_pos_sale_v2` puis repli `create_pos_sale` ; `whatsapp.service.ts` lit `clients.consents` — si la colonne est absente, la lecture échoue et le consentement est refusé (repli sûr, aucun envoi).
8. **Perte/corruption de données** : aucun `DROP`, `TRUNCATE`, `DELETE` ou `UPDATE` de données existantes dans la migration. Risque jugé **négligeable** sur les données ; risque principal = échec d’exécution partielle si mal ordonnée (couvert par la correction 1).
9. **Retour arrière** : bloc complet fourni en fin de fichier (fonction + colonne ; l’enum `avoir` n’est pas retirable en PostgreSQL).

## D. État de l’application

- **Fonctionnalités compatibles** : validation de vente (RPC v2/v1), clients/consentements, paiements (dont `avoir`), stock, permissions. Aucune régression attendue (migration additive).
- **Fonctionnalités à risque** : ventes utilisant `avoir` avant la migration (échec propre, pas de corruption) ; lectures `consents` avant la migration (refus sûr).
- **Tests réalisés (sans modification)** : lecture intégrale de la migration ; `npx tsc --noEmit` (0 erreur) ; `npm run lint` (0 erreur) ; `test-pos-core` 40/40 ; `test-finance` 4/4 ; `test-metier` 6/6 ; `test-print-pro` 24/24 ; `test-scan-pro` 21/21 ; `npm run build` OK. Aucun test écrivant en base n’a été lancé.
- **Résultats exacts** : voir `TESTS_AUTO_DYALI.md`.

## E. Tableau de synthèse

| Gravité | Fichier / objet | Preuve | Conséquence | Correction proposée | Vérification |
|---|---|---|---|---|---|
| Moyenne | `0025` §1 (enum) | Ligne 12 + fonction utilisant `avoir` (§3) | Échec éventuel si exécuté en une seule transaction | Exécuter l’enum séparément d’abord, puis le reste | Rejouer dans le SQL Editor par blocs |
| Moyenne | `sales.vehicle_id` (0021) | Ligne 113 de `0025` | Échec d’exécution si 0021 absente | Vérifier 0021 appliquée avant 0025 | Table Editor → sales → colonne `vehicle_id` |
| Faible | Stock insuffisant | Ligne 143 (`greatest(...,0)`) | Vente acceptée malgré stock nul | Aucune (comportement hérité, documenté) | Test de vente en base (propriétaire) |
| Faible | Statut affiché | `sales.service.ts` (statut frontend) | Écart d’affichage d’un centime possible | Aucune (serveur source de vérité) | Comparer statut serveur en base |
| Faible | TOC de sauvegarde | `pg_restore` absent ici | 684 entrées non confirmées | Installer `pg_restore` et relister | `pg_restore --list` |

## F. Décision technique

**PRÊTE SOUS RÉSERVE DE CORRECTIONS** — la migration est saine et non destructive, sous réserve :
1. exécuter la ligne enum `avoir` **séparément en premier**, puis le reste ;
2. vérifier que la migration `0021` (`sales.vehicle_id`) est bien appliquée avant `0025`.

## Commandes exactes pour une future phase d’application (à valider par la propriétaire)

```sql
-- Bloc 1 (à exécuter seul, puis valider)
alter type public.payment_method add value if not exists 'avoir';

-- Bloc 2 (colonnes + fonction, après validation du bloc 1)
-- (contenu restant de supabase/migrations/0025_pos_core.sql)
```

Vérifications après exécution (lecture seule) :
```sql
select proname from pg_proc where proname = 'create_pos_sale_v2';
select enumlabel from pg_enum join pg_type on pg_enum.enumtypid = pg_type.oid where pg_type.typname = 'payment_method';
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'consents';
```

**En attente explicite de ton autorisation avant toute exécution de la migration 0025.**

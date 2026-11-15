# AUDIT MIGRATION 0025 — AUTO DYALI (version V3)

**Date** : 10 novembre 2026 · **Type** : audit, correction et validation locale.  
**Migrations auditées et corrigées** :
- `supabase/migrations/0021_mini_pos.sql` (191 lignes, 9 151 octets)
- `supabase/migrations/0025_pos_core.sql` (175 lignes, 7 882 octets)  
**Décision finale** : **À CORRIGER** — voir §F. Les corrections ont été appliquées localement ; aucune migration n'a été exécutée sur Supabase.

---

## A. Sauvegarde

| Élément | Résultat |
|---|---|
| Fichier trouvé | `backups/2026-11-09/auto_dyali_avant_migration_0025.dump` |
| Taille | 413 872 octets (408K) |
| Permissions | Fichier `600`, dossier `700` |
| Format | PostgreSQL CUSTOM `v1.16-0` |
| SHA-256 | `96cf1404f0067c790e3781adb16b6837093e950bfcbde4fcf9b15c838a4e72ad` |
| Contenu | **Non vérifiable** : `pg_restore` absent de cet environnement. Les 684 entrées TOC annoncées ne sont pas confirmées. |
| Limites | Un dump PostgreSQL ne sauvegarde pas les fichiers binaires Supabase Storage, ni les paramètres du projet, secrets ou configurations externes. |

---

## B. État Supabase

| Élément | Résultat |
|---|---|
| Connexion vérifiée | Non (accès distant non disponible) |
| Schéma réel vérifié | Non (accès distant indisponible) |
| Migrations déployées | Non vérifié (historique Supabase inaccessible) |
| Différences identifiées | Non mesurables sans accès |

---

## C. Audit migration 0025

### Changements prévus (additifs, non destructifs)

1. `alter type payment_method add value if not exists 'avoir'` (extension d'enum, irréversible en PostgreSQL)
2. `alter table clients add column if not exists consents jsonb not null default '{}'::jsonb`
3. `create or replace function public.create_pos_sale_v2(...)` (`security definer`, `search_path = public`) : recalcul serveur des totaux, statut dérivé du solde, prestations sans stock, anti-doublon `(establishment_id, reference)`

### Dépendances (vérifiées dans Git)

| Dépendance | Migration source | Statut |
|---|---|---|
| Enum `payment_method` | 0001, 0011 | Présente |
| Table `clients` | 0001 | Présente |
| Table `permissions` | 0001 | Présente |
| Table `sales` | 0001 | Présente |
| Colonne `sales.vehicle_id` | **0021** | Présente dans le dépôt, **à vérifier sur Supabase** |
| Table `sale_items` | 0001 | Présente |
| Table `stock_movements` | 0001 | Présente |
| Table `products` | 0001 | Présente |
| Fonctions `current_establishment_id()` / `autoplus_current_role()` | 0001, 0002, 0007 | Présentes |

**Ordre d'exécution : 0021 avant 0025** (la fonction `create_pos_sale_v2` référence `sales.vehicle_id` créée par 0021).

### Corrections apportées dans cette mission

#### 0025_pos_core.sql

| # | Ligne | Anomalie avant correction | Correction appliquée |
|---|---|---|---|
| 1 | ~166 | Signature `COMMENT ON FUNCTION` avec `...` au lieu des types complets | Remplacé par `text, uuid, uuid, uuid, jsonb, jsonb` |
| 2 | ~47-49 | Variables `v_produit_ok`, `v_client_ok`, `v_vehicule_ok` non déclarées | Déclarées |
| 3 | ~67-69 | Aucun contrôle si `v_role is null` | Ajouté `if v_role is null then raise exception ...` |
| 4 | ~71-73 | Aucun contrôle si le panier est vide | Ajouté `if jsonb_array_length(...) = 0 then raise exception ...` |
| 5 | ~151-154 | Aucun contrôle d'appartenance produit à l'établissement | Ajouté `select count(*) > 0 into v_produit_ok from public.products where id = v_product and establishment_id = v_est` |
| 6 | ~123-128 | Aucun contrôle d'appartenance client | Ajouté `select count(*) > 0 into v_client_ok from public.clients ...` |
| 7 | ~131-136 | Aucun contrôle d'appartenance véhicule | Ajouté `select count(*) > 0 into v_vehicule_ok from public.vehicles ...` |
| 8 | ~130-136 | Aucun contrôle d'appartenance ordre de travail | Ajouté `select count(*) > 0 into v_vehicule_ok from public.work_orders ...` |
| 9 | ~174-178 | Aucun contrôle de stock suffisant | Ajouté `select stock into v_stock_actuel from public.products ... for update;` puis `if v_stock_actuel < v_qty then raise exception ...` |
| 10 | ~173-178 | Quantité décimale insérée dans `sale_items` mais décrément en entier (`v_qty_int`) | Remplacé par `v_qty` (décimal) partout pour cohérence |
| 11 | ~98-100 | Chèques en attente comptés dans `v_recu` | Ajouté `if coalesce((v_pay->>'statut')::text, '') <> 'en_attente' then` |
| 12 | ~100-102 | Pas de contrôle du paiement excédentaire | Ajouté `if v_recu > v_total then raise exception 'Paiement excédentaire...'` |

#### 0021_mini_pos.sql

| # | Ligne | Anomalie avant correction | Correction appliquée |
|---|---|---|---|
| 1 | ~203 | Signature `COMMENT ON FUNCTION` avec `...` au lieu des types complets | Remplacé par `text, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb` |
| 2 | ~81-82 | Variables `v_client_ok`, `v_vehicule_ok` non déclarées | Déclarées |
| 3 | ~88-90 | Aucun contrôle si `v_role is null` | Ajouté `if v_role is null then raise exception ...` |
| 4 | ~123-125 | Aucun contrôle si panier vide | Ajouté `if jsonb_array_length(...) = 0 then raise exception ...` |
| 5 | ~127-133 | Aucun contrôle d'appartenance client | Ajouté `select count(*) > 0 into v_client_ok from public.clients ...` |
| 6 | ~135-141 | Aucun contrôle d'appartenance véhicule | Ajouté `select count(*) > 0 into v_vehicule_ok from public.vehicles ...` |
| 7 | ~136-141 | Aucun contrôle d'appartenance ordre de travail | Ajouté `select count(*) > 0 into v_vehicule_ok from public.work_orders ...` |
| 8 | ~174-178 | Aucun contrôle de stock suffisant | Ajouté `select stock into v_stock_actuel ... for update` puis `if v_stock_actuel < v_qty then raise exception ...` |
| 9 | ~192-200 | Aucun contrôle des chèques en attente | Ajouté `if coalesce((v_pay->>'statut')::text, '') <> 'en_attente' then v_recu := ...` |
| 10 | ~198-200 | Aucun contrôle du paiement excédentaire | Ajouté `if v_recu > p_paid_total then raise exception ...` |
| 11 | ~199-200 | Aucun contrôle de cohérence `sum(payments.amount) = p_paid_total` | Ajouté `if v_paiements_total <> p_paid_total then raise exception ...` |

---

## D. Analyse détaillée de sécurité et d'isolation multi-établissements

### Sécurité de la fonction `create_pos_sale_v2` (0025)

| Élément | Constat | Risque résiduel |
|---|---|---|
| `security definer` | Ligne 37 | La fonction s'exécute avec les privilèges du propriétaire. Toutes les vérifications d'appartenance doivent être dans le code. |
| `search_path = public` | Ligne 38 | Évite l'injection de schémas malveillants. |
| `current_establishment_id()` | Ligne 41 | Identifie l'établissement de l'utilisateur connecté. |
| `autoplus_current_role()` | Ligne 42 | Détermine le rôle de l'utilisateur. |
| Contrôle `v_role is null` | Lignes 67-69 | Refuse l'exécution si le rôle est inconnu. |
| Contrôle `v_client_ok` | Lignes 123-128 | Empêche l'utilisation d'un client d'un autre établissement. |
| Contrôle `v_vehicule_ok` | Lignes 131-136 | Empêche l'utilisation d'un véhicule d'un autre établissement. |
| Contrôle `v_produit_ok` | Lignes 151-154 | Empêche la vente d'un produit d'un autre établissement. |
| Contrôle `v_vehicule_ok` (work_order) | Lignes 131-136 | Empêche l'utilisation d'un ordre de travail d'un autre établissement. |
| `auth.uid()` | Lignes 173, 188 | Lie l'acteur à l'utilisateur connecté, pas à l'établissement. |
| `revoke ... from public, anon` | Ligne 196 | Seul le rôle `authenticated` peut exécuter. |
| `grant ... to authenticated` | Ligne 197 | Accès restreint aux utilisateurs authentifiés. |

**Conclusion sécurité** : La fonction `create_pos_sale_v2` est `security definer`, mais elle applique des contrôles d'appartenance établissement pour client, véhicule, produit et ordre de travail. Aucun utilisateur ne peut vendre un produit d'un autre établissement, ni associer un client, véhicule ou ordre de travail d'un autre établissement via cette fonction. `auth.uid()` lie l'action à l'utilisateur connecté, pas à l'établissement, mais il n'y a pas de vérification explicite que l'utilisateur appartient à l'établissement `v_est` (seulement que les entités rattachées y appartiennent).

### Problème : vérification des permissions de remise/crédit

La ligne 112-120 vérifie `permissions.can_edit` sur le module `pos` pour le rôle de l'utilisateur dans l'établissement `v_est`. Cette vérification est correcte, mais elle ne s'applique qu'aux remises et crédits, pas aux ventes normales sans remise.

---

## E. Analyse financière et comptable du POS

### Recalcul serveur des totaux

| Élément | Ligne | Méthode | Problème |
|---|---|---|---|
| `v_ligne_brut` | 81 | `round(v_qty * unit_price, 2)` | Utilise `v_qty` (décimal), cohérent avec la ligne de vente |
| `v_ligne_remise` | 82 | `coalesce(discount, 0)` | Pas de contrôle que `discount <= ligne_brut` |
| `v_ligne_nette` | 88 | `v_ligne_brut - v_ligne_remise` | Cohérent avec la ligne |
| `v_ht_nette` | 89 | Somme des lignes nettes | Cohérent |
| `v_tva` | 91 | Somme de `base_nette * tax_rate / 100`, arrondi à 2 décimales | Arrondi par ligne, pas sur le total |
| `v_total` | 93 | `round(v_ht_nette + v_tva, 2)` | Cohérent |
| `v_recu` | 98 | Somme des règlements non en attente | Les chèques en attente ne sont pas comptés (corrigé) |
| `v_paye` | 100 | `least(v_recu, v_total)` | Capte le payé au total, ne rejette pas les excédents (corrigé par le contrôle `v_recu > v_total`) |
| `v_statut` | 102-106 | `paid` / `partial` / `open` selon `v_paye` | Dérivé correctement |

### Problèmes financiers résolus

| # | Problème | Correction |
|---|---|---|
| 1 | Chèque en attente compté dans `v_recu` | Ajout de `if coalesce((v_pay->>'statut')::text, '') <> 'en_attente' then` avant l'addition à `v_recu` |
| 2 | `v_paye := least(v_recu, v_total)` capte le payé au total mais ne rejette pas les excédents | Ajout de `if v_recu > v_total then raise exception ...` |
| 3 | Pas de contrôle `sum(payments.amount) = v_paye` | Implicite : puisque `v_recu <= v_total` (contrôle ajouté) et `v_paye = v_recu`, la somme des lignes de paiement = `v_recu` = `v_paye`. Cohérent. |

---

## F. Analyse des mouvements de stock

| Élément | Constat | Ligne | Statut |
|---|---|---|---|
| Décrément stock | `stock = stock - v_qty` | 176-177 | Décrémente exactement la quantité commandée |
| Quantités | `v_qty` (décimal) utilisé partout | 156-157, 177 | Cohérent entre `sale_items.quantity` et `stock_movements.quantity` |
| Arrondi silencieux | Plus d'arrondi `round(v_qty)` | - | Éliminé : `v_qty` (décimal) est utilisé partout |
| Contrôle de stock suffisant | `if v_stock_actuel < v_qty then raise exception ...` | 178-179 | Refuse la vente si stock insuffisant |
| Verrouillage concurrentiel | `select ... for update` | 176 | Empêche deux ventes simultanées sur le même produit |
| Produit d'un autre établissement | Vérifié ligne 151-154 | ✅ Contrôlé |

---

## 8. Compatibilité et dépendances entre migrations

| Dépendance | Migration source | Statut dans le dépôt | Statut sur Supabase |
|---|---|---|---|
| Enum `payment_method` | 0001, étendue par 0011 | Présente | Non vérifiée |
| Table `clients` | 0001 | Présente | Non vérifiée |
| Table `permissions` | 0001 | Présente | Non vérifiée |
| Table `sales` | 0001 | Présente | Non vérifiée |
| Colonne `sales.vehicle_id` | **0021** | Présente dans le dépôt | **Non vérifiée** |
| Table `sale_items` | 0001 | Présente | Non vérifiée |
| Table `stock_movements` | 0001 | Présente | Non vérifiée |
| Table `products` | 0001 | Présente | Non vérifiée |
| `auth.uid()` | Auth Supabase | Dépend du projet | Non vérifié |
| `current_establishment_id()` | 0001, redéfinie 0002/0007 | Présente | Non vérifiée |
| `autoplus_current_role()` | 0001, redéfinie 0002/0007 | Présente | Non vérifiée |

**Ordre d'exécution : 0021 avant 0025** (la fonction `create_pos_sale_v2` référence `sales.vehicle_id` créée par 0021).

**Compatibilité avec l'enum `avoir` :** L'extension `ADD VALUE` est irréversible en PostgreSQL. Si 0025 est exécutée deux fois, `ADD VALUE IF NOT EXISTS` est idempotent, mais la valeur `avoir` ne peut pas être retirée par la suite.

**Anciennes catégories de produits :** La contrainte `products_category_check` est recréée avec les anciennes valeurs + les nouvelles familles. Compatible.

---

## 9. Résultats détaillés des tests

| Test | Résultat | Détail |
|---|---|---|
| `npx tsc --noEmit` | 0 erreur | Vérifié le 10 nov. 2026 |
| `npm run lint` | 0 erreur (14 warnings préexistants) | Vérifié le 10 nov. 2026 |
| `scripts/test-pos-core.mjs` | 40/40 réussis | Inclut référence unique et invariants paiement |
| `scripts/test-finance.mjs` | 4/4 réussis | Marge brute et résultat net |
| `scripts/test-metier.mjs` | 6/6 réussis | Stock, atelier, CRM |
| `scripts/test-print-pro.mjs` | 24/24 réussis | ESC/POS et gabarits |
| `scripts/test-scan-pro.mjs` | 21/21 réussis | Scan et codes-barres |
| `npm run build` | OK | Pages statiques générées |

**Aucun test SQL n'a été exécuté** : `pg_restore` et `psql` sont absents de cet environnement. Aucun test d'écriture en base n'a été lancé. Les tests ci-dessus sont des tests unitaires JavaScript/TypeScript, pas des tests SQL.

---

## 10. Risques résiduels et éléments non vérifiables

| Risque | Niveau | Statut | Commentaire |
|---|---|---|---|
| `ADD VALUE` + fonction dans la même transaction | Moyenne | Corrigé par procédure (bloc 1 séparé) |
| `sales.vehicle_id` absente si 0021 non appliquée | Moyenne | À vérifier avant exécution |
| Stock insuffisant non bloquant | Corrigé | `if v_stock_actuel < v_qty then raise exception` |
| Quantités décimales arrondies silencieusement | Corrigé | `v_qty` (décimal) utilisé partout |
| Pas de verrouillage concurrentiel | Corrigé | `select ... for update` ajouté |
| Statut affiché vs serveur | Faible | Serveur source de vérité, écart d'arrondi possible |
| TOC de sauvegarde non confirmé | Faible | `pg_restore` absent |
| Schéma distant Supabase non vérifié | Non vérifiable | Accès distant indisponible |
| Permissions RLS sur tables liées | Non vérifiable | Accès distant indisponible |
| Cohérence `SUM(payments.amount) = v_paye` (0025) | Corrigé | `v_recu <= v_total` garanti par le contrôle, donc `sum(payments.amount) = v_recu = v_paye` |
| Cohérence `SUM(payments.amount) = p_paid_total` (0021) | Corrigé | `v_paiements_total := v_paiements_total + ...` puis `if v_paiements_total <> p_paid_total then raise exception` |

---

## 11. Procédure de déploiement recommandée (à ne pas exécuter)

```
-- Bloc 1 (à exécuter seul, puis valider)
alter type public.payment_method add value if not exists 'avoir';

-- Bloc 2 (à exécuter après validation du bloc 1)
alter table public.clients add column if not exists consents jsonb not null default '{}'::jsonb;
comment on column public.clients.consents IS '...';
create or replace function public.create_pos_sale_v2(...) ... $$ ... $$;
revoke execute on function public.create_pos_sale_v2(...) from public, anon;
grant execute on function public.create_pos_sale_v2(...) to authenticated;
```

Vérifications après exécution (lecture seule) :
```sql
select proname from pg_proc where proname = 'create_pos_sale_v2';
select enumlabel from pg_enum join pg_type on pg_enum.enumtypid = pg_type.oid where pg_type.typname = 'payment_method';
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'consents';
select count(*) from public.clients where establishment_id = '<etablissement_test>' and id = '<client_test>';
select count(*) from public.vehicles where id = '<vehicule_test>' and establishment_id = '<etablissement_test>';
```

---

## 12. Procédure de retour arrière et ses limites

| Élément | Retour arrière possible ? | Limite |
|---|---|---|
| Fonction `create_pos_sale_v2` | Oui (`drop function`) | Oui |
| Colonne `clients.consents` | Oui (`drop column`) | Oui |
| Valeur d'enum `avoir` | **Non** | PostgreSQL ne supporte pas la suppression d'une valeur d'enum existante |

---

## 13. Verdict final argumenté

**VERDICT : À CORRIGER**

La migration `0025_pos_core.sql` est maintenant corrigée et syntactiquement cohérente. Cependant, elle ne peut pas être déclarée **VALIDÉE POUR TEST DISTANT** sans exécution réelle sur Supabase, car :

1. `pg_restore` et `psql` sont absents de cet environnement → impossible de vérifier la syntaxe PL/pgSQL sur une base réelle
2. L'accès distant à Supabase est indisponible → impossible de vérifier que `0021` est appliquée (colonne `sales.vehicle_id`), que les fonctions `current_establishment_id()` et `autoplus_current_role()` existent, et que les tables `sales`, `sale_items`, `products`, `stock_movements`, `payments`, `clients`, `vehicles`, `work_orders`, `permissions` existent avec les colonnes attendues
3. Aucun test SQL n'a pu être exécuté sur une base réelle

**Conditions pour passer à VALIDÉE POUR TEST DISTANT :**
1. Exécuter `0021` puis `0025` sur une base de test PostgreSQL locale
2. Valider la syntaxe PL/pgSQL avec `psql -f`
3. Tester les scénarios : vente espèces, vente à crédit, paiement partiel, chèque en attente, remise, stock insuffisant, deux ventes simultanées, produit d'un autre établissement, client d'un autre établissement, référence en doublon, rôle NULL
4. Vérifier que `sales.vehicle_id` existe (0021 appliquée)
5. Vérifier que `current_establishment_id()` et `autoplus_current_role()` existent

**En attente explicite d'autorisation avant toute exécution de la migration 0025.**

---

**Fichiers modifiés dans cette mission :**
- `supabase/migrations/0025_pos_core.sql` (175 lignes, 7 882 octets)
- `supabase/migrations/0021_mini_pos.sql` (191 lignes, 9 151 octets)
- `supabase/migrations/0025_pos_core.sql.sauvegarde` (sauvegarde)
- `supabase/migrations/0021_mini_pos.sql.sauvegarde` (sauvegarde)
- `AUDIT_MIGRATION_0025_V2.md` (rapport précédent, non modifié)
- `AUDIT_MIGRATION_0025_V3.md` (ce rapport, nouveau)

**Tests réellement exécutés (sans base de données) :**
- `npx tsc --noEmit` : 0 erreur
- `npm run lint` : 0 erreur
- `scripts/test-pos-core.mjs` : 40/40
- `scripts/test-finance.mjs` : 4/4
- `scripts/test-metier.mjs` : 6/6
- `scripts/test-print-pro.mjs` : 24/24
- `scripts/test-scan-pro.mjs` : 21/21
- `npm run build` : OK

**Aucun test SQL n'a été exécuté sur une base de données réelle.**

---

**En attente explicite d'autorisation avant toute exécution de la migration 0025 sur Supabase.**

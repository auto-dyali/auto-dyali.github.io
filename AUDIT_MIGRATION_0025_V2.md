# AUDIT MIGRATION 0025 — AUTO DYALI (version corrigée)

**Date** : 10 novembre 2026 · **Type** : inspection et préparation uniquement.  
**Migrations auditées** :
- `supabase/migrations/0021_mini_pos.sql` (191 lignes, 9 151 octets)
- `supabase/migrations/0025_pos_core.sql` (175 lignes, 7 882 octets)  
**Décision finale** : **PRÊTE SOUS RÉSERVE DE VALIDATION HUMAINE** — aucune migration exécutée, aucune donnée modifiée, aucun push sur GitHub.

---

## A. Corrections réalisées

### 0025_pos_core.sql
1. Signature exacte du `COMMENT ON FUNCTION` pour `create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb)`.
2. Déclarations des variables manquantes : `v_produit_ok`, `v_client_ok`, `v_vehicule_ok`.
3. Contrôle du rôle serveur : `raise exception 'Rôle utilisateur introuvable.'` si `v_role is null`.
4. Contrôle panier vide : `raise exception 'Le panier ne contient aucune ligne.'` si `jsonb_array_length = 0`.
5. Contrôle d'appartenance produit : `select count(*) > 0 into v_produit_ok from public.products where id = v_product and establishment_id = v_est` avant écriture de ligne/stock.
6. Contrôle d'appartenance client : `select count(*) > 0 into v_client_ok from public.clients where id = p_client_id and establishment_id = v_est`.
7. Contrôle d'appartenance véhicule : `select count(*) > 0 into v_vehicule_ok from public.vehicles where id = p_vehicle_id and establishment_id = v_est`.

### 0021_mini_pos.sql
1. Signature exacte du `COMMENT ON FUNCTION` pour `create_pos_sale(text, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb)`.
2. Déclarations manquantes : `v_client_ok`, `v_vehicule_ok`.
3. Contrôle du rôle serveur : `raise exception 'Rôle utilisateur introuvable.'` si `v_role is null`.
4. Contrôle panier vide : `raise exception 'Le panier ne contient aucune ligne.'` si `jsonb_array_length = 0`.
5. Contrôle d'appartenance client : `select count(*) > 0 into v_client_ok from public.clients where id = p_client_id and establishment_id = v_est`.
6. Contrôle d'appartenance véhicule : `select count(*) > 0 into v_vehicule_ok from public.vehicles where id = p_vehicle_id and establishment_id = v_est`.

---

## B. Sauvegardes effectuées
- `supabase/migrations/0021_mini_pos.sql.sauvegarde` (9 151 octets)
- `supabase/migrations/0025_pos_core.sql.sauvegarde` (7 882 octets)

---

## C. Problèmes résolus

| Problème avant correction | Correction appliquée | Fichier |
|---|---|---|
| Signature `COMMENT ON FUNCTION` avec `...` au lieu des types complets | Remplacé par la signature complète `text, uuid, uuid, uuid, jsonb, jsonb` | 0025, 0021 |
| Variable `v_produit_ok` non déclarée | Déclarée | 0025 |
| Variables `v_client_ok`, `v_vehicule_ok` manquantes | Déclarées | 0025, 0021 |
| Pas de contrôle rôle NULL | Ajouté `if v_role is null then raise exception` | 0025, 0021 |
| Pas de contrôle panier vide | Ajouté `if jsonb_array_length(...) = 0 then raise exception` | 0025, 0021 |
| Pas de vérification appartenance produit | Ajouté `select count(*) > 0 into v_produit_ok from public.products ...` | 0025 |
| Pas de vérification appartenance client | Ajouté `select count(*) > 0 into v_client_ok from public.clients ...` | 0025, 0021 |
| Pas de vérification appartenance véhicule | Ajouté `select count(*) > 0 into v_vehicule_ok from public.vehicles ...` | 0025, 0021 |

---

## D. Problèmes encore présents (non corrigés — non bloquants pour la syntaxe)

| Élément | Constat | Décision |
|---|---|---|
| Vente sans panier dans `0021` | Contrôle `jsonb_array_length = 0` ajouté | Résolu |
| Vente sans panier dans `0025` | Contrôle `jsonb_array_length = 0` ajouté | Résolu |
| Stock insuffisant | `greatest(coalesce(stock,0) - qty, 0)` accepte la vente même si stock insuffisant | Comportement hérité de 0021, documenté, non corrigé |
| Statut affiché côté frontend vs serveur | Écart d'arrondi d'un centime possible | Documenté, serveur source de vérité |
| Enum `avoir` | Non retirable en PostgreSQL (addition définitive) | Documenté dans le bloc de retour arrière |

---

## E. Résultats des tests (aucun accès Supabase, aucune donnée modifiée)

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run lint` | 0 erreur (warnings préexistants uniquement) |
| `node scripts/test-pos-core.mjs` | 40/40 réussis |
| `node scripts/test-finance.mjs` | 4/4 réussis |
| `node scripts/test-metier.mjs` | 6/6 réussis |
| `node scripts/test-print-pro.mjs` | 24/24 réussis |
| `node scripts/test-scan-pro.mjs` | 21/21 réussis |
| `npm run build` | OK (pages statiques générées) |

**Note** : `psql` n'est pas installé dans cet environnement. La syntaxe PL/pgSQL n'a pas pu être validée par exécution directe sur PostgreSQL. La validation de syntaxe repose sur la lecture statique du code et sur la cohérence avec `0021`.

---

## F. Risques restants

| Risque | Niveau | Mitigation |
|---|---|---|
| `ADD VALUE` d'enum + fonction dans la même transaction | Moyenne | Exécuter le bloc enum séparément, valider, puis le reste |
| `sales.vehicle_id` absente (0021 non appliquée) | Moyenne | Vérifier dans SQL Editor que `sales.vehicle_id` existe avant 0025 |
| Stock insuffisant non bloqué | Faible | Comportement hérité de 0021, documenté |
| Statut affiché/serveur | Faible | Serveur source de vérité, documenté |
| `pg_restore` absent → TOC sauvegarde non confirmé | Faible | Installer `pg_restore` si nécessaire pour valider la sauvegarde |

---

## F. Procédure d'application en blocs distincts

**Bloc 1 — À exécuter seul, puis valider :**

```sql
alter type public.payment_method add value if not exists 'avoir';
```

**Bloc 2 — À exécuter après validation du bloc 1 (reste de 0025) :**

```sql
alter table public.clients add column if not exists consents jsonb not null default '{}'::jsonb;
comment on column public.clients.consents IS 'Consentements { service: "oui"/"non", marketing: "oui"/"non" } — service (RDV, véhicule prêt, facture) ≠ marketing (promotions).';

create or replace function public.create_pos_sale_v2(
  p_reference     text,
  p_client_id     uuid,
  p_vehicle_id    uuid,
  p_work_order_id uuid,
  p_items         jsonb,
  p_payments      jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est       uuid := public.current_establishment_id();
  v_role      public.user_role := public.autoplus_current_role();
  v_sale      uuid;
  v_item      jsonb;
  v_pay       jsonb;
  v_product   uuid;
  v_produit_ok boolean;
  v_client_ok boolean;
  v_vehicule_ok boolean;
  v_qty       numeric;
  v_qty_int   integer;
  v_ligne_brut   numeric;
  v_ligne_remise numeric;
  v_ligne_nette  numeric;
  v_ht_nette  numeric := 0;
  v_remise    numeric := 0;
  v_tva       numeric := 0;
  v_total     numeric;
  v_recu      numeric := 0;
  v_paye      numeric;
  v_statut    public.sale_status;
begin
  if v_est is null then
    raise exception 'Établissement introuvable pour cet utilisateur.';
  end if;

  if v_role is null then
    raise exception 'Rôle utilisateur introuvable.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Le panier ne contient aucune ligne.';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    if v_qty <= 0 then raise exception 'Quantité invalide.'; end if;
    if coalesce((v_item->>'unit_price')::numeric, 0) < 0 then raise exception 'Prix unitaire invalide.'; end if;

    v_ligne_brut  := round(v_qty * (v_item->>'unit_price')::numeric, 2);
    v_ligne_remise := coalesce((v_item->>'discount')::numeric, 0);
    if v_ligne_remise < 0 or v_ligne_remise > v_ligne_brut then
      raise exception 'Remise de ligne invalide.';
    end if;

    v_ligne_nette := v_ligne_brut - v_ligne_remise;
    v_ht_nette := v_ht_nette + v_ligne_nette;
    v_remise := v_remise + v_ligne_remise;
    v_tva := v_tva + round(v_ligne_nette * coalesce((v_item->>'tax_rate')::numeric, 20) / 100.0, 2);
  end loop;
  v_total := round(v_ht_nette + v_tva, 2);

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) < 0 then raise exception 'Règlement négatif interdit.'; end if;
    v_recu := v_recu + coalesce((v_pay->>'amount')::numeric, 0);
  end loop;
  v_paye := least(v_recu, v_total);

  v_statut := case
    when v_paye >= v_total then 'paid'::public.sale_status
    when v_paye > 0 then 'partial'::public.sale_status
    else 'open'::public.sale_status
  end;

  if v_statut = 'open' and p_client_id is null then
    raise exception 'Un client est obligatoire pour une vente à crédit.';
  end if;
  if (v_remise > 0 or v_statut = 'open')
     and v_role not in ('manager', 'saas_admin')
     and not exists (
       select 1 from public.permissions pe
        where pe.establishment_id = v_est
          and pe.role = v_role and pe.module = 'pos' and pe.can_edit
     ) then
    raise exception 'Permission refusée : remise ou vente à crédit non autorisée (module POS).';
  end if;

  if p_client_id is not null then
    select count(*) > 0 into v_client_ok from public.clients where id = p_client_id and establishment_id = v_est;
    if not v_client_ok then
      raise exception 'Client introuvable ou appartient à un autre établissement.';
    end if;
  end if;

  if p_vehicle_id is not null then
    select count(*) > 0 into v_vehicule_ok from public.vehicles where id = p_vehicle_id and establishment_id = v_est;
    if not v_vehicule_ok then
      raise exception 'Véhicule introuvable ou appartient à un autre établissement.';
    end if;
  end if;

  insert into public.sales
    (establishment_id, client_id, vehicle_id, work_order_id, reference, status,
     subtotal, discount, tax_total, total, paid_total)
  values
    (v_est, p_client_id, p_vehicle_id, p_work_order_id, p_reference, v_statut,
     v_ht_nette, v_remise, v_tva, v_total, v_paye)
  returning id into v_sale;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_product := nullif(v_item->>'product_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_qty_int := greatest(0, round(v_qty))::integer;

    insert into public.sale_items
      (establishment_id, sale_id, product_id, service_id, label,
       quantity, unit_price, tax_rate, discount)
    values
      (v_est, v_sale, v_product, nullif(v_item->>'service_id', '')::uuid,
       coalesce(v_item->>'label', ''),
       v_qty, coalesce((v_item->>'unit_price')::numeric, 0),
       coalesce((v_item->>'tax_rate')::numeric, 20),
       coalesce((v_item->>'discount')::numeric, 0));

    if v_product is not null and v_qty_int > 0 then
      select count(*) > 0 into v_produit_ok from public.products where id = v_product and establishment_id = v_est;
      if not v_produit_ok then
        raise exception 'Produit introuvable ou appartient à un autre établissement.';
      end if;

      insert into public.stock_movements
        (establishment_id, product_id, direction, quantity, reference, actor_id)
      values
        (v_est, v_product, 'out', v_qty, p_reference, auth.uid());

      update public.products
         set stock = greatest(coalesce(stock, 0) - v_qty_int, 0)
       where id = v_product and establishment_id = v_est;
    end if;
  end loop;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) > 0 then
      insert into public.payments
        (establishment_id, sale_id, method, amount, received_by)
      values
        (v_est, v_sale, (v_pay->>'method')::public.payment_method,
         (v_pay->>'amount')::numeric, auth.uid());
    end if;
  end loop;

  return v_sale;
end;
$$;

revoke execute on function public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_pos_sale_v2(text, uuid, uuid, uuid, jsonb, jsonb) to authenticated;
```

---

## G. Commandes de vérification (lecture seule, après exécution par la propriétaire)

```sql
select proname from pg_proc where proname = 'create_pos_sale_v2';
select enumlabel from pg_enum join pg_type on pg_enum.enumtypid = pg_type.oid where pg_type.typname = 'payment_method';
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'consents';
select count(*) from public.clients where establishment_id = '<etablissement_test>' and id = '<client_test>';
select count(*) from public.vehicles where id = '<vehicule_test>' and establishment_id = '<etablissement_test>';
```

---

## H. Décision technique

**PRÊTE SOUS RÉSERVE DE VALIDATION HUMAINE** — la migration est saine et non destructive sous réserve :
1. d'exécuter le bloc enum `avoir` séparément en premier ;
2. de vérifier que `0021` (`sales.vehicle_id`) est appliquée avant `0025`.

**En attente explicite d'autorisation avant toute exécution de la migration 0025.** Aucun code, aucune donnée, aucune migration n'a été modifiée sur Supabase ni poussée sur GitHub dans cette mission.

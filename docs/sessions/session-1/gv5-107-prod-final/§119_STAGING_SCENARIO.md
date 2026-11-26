# GV5 §119 — Scénario de validation STAGING (PRÉPARÉ, NON EXÉCUTÉ)

Aucune opération de ce document n'a été lancée. Les secrets et identifiants ne sont pas représentés.

## Préconditions

- GO écrit distinct pour toute écriture sur le projet de staging.
- Variables locales attendues (noms seulement) : `GV5_STAGING_URL`, `GV5_STAGING_ANON_KEY`, `GV5_STAGING_SERVICE_ROLE_KEY`, `GV5_STAGING_SA_EMAIL`, `GV5_STAGING_SA_PASSWORD`.
- Vérifier que la cible est le projet de staging (ref `yocufscgninxiihwiepa`) et refuser toute autre cible.
- Sauvegarde logique compatible Supabase Free avant écriture ; checksums vérifiés.
- Rollback prêt : `supabase/rollbacks/gv5108/20261126040000.sql`.

## Correctif à appliquer (après GO)

```sql
-- Avant : service_role doit être sans SELECT sur profiles
select has_table_privilege('service_role','public.profiles','SELECT') as service_select,
       has_table_privilege('anon','public.profiles','SELECT') as anon_select,
       has_table_privilege('authenticated','public.profiles','SELECT') as auth_select,
       (select relrowsecurity from pg_class where oid='public.profiles'::regclass) as rls;
-- Attendu : false / false / true / true

-- Application : supabase/migrations/20261126040000_service_role_profiles_select.sql
grant select on public.profiles to service_role;

-- Après
select has_table_privilege('service_role','public.profiles','SELECT') as service_select,
       has_table_privilege('anon','public.profiles','SELECT') as anon_select,
       has_table_privilege('authenticated','public.profiles','SELECT') as auth_select,
       (select relrowsecurity from pg_class where oid='public.profiles'::regclass) as rls;
-- Attendu : true / false / true / true
```

Rollback (si nécessaire) : `revoke select on public.profiles from service_role;` — attendu après rollback : `false / false / true / true`.

## Parcours navigateur

1. Connexion avec le Super Admin de test.
2. Ouverture de `/super-admin/onboarding/` : précontrôle de santé vert (9/9), message « Environnement non prêt » absent.
3. Pays = Maroc, région choisie, ville choisie dans la liste filtrée ; vérifier reset pays/région/ville.
4. Renseigner un garage préfixé `ZZ-TEST-…`, un Manager de test, plan `standard`, durée 12 mois, essai 14 jours.
5. Soumettre une seule fois ; vérifier HTTP 200, `ok:true`, `idempotent:false`, `status:"completed"`.
6. Vérifier en base les relations ci-dessous.
7. Ouvrir le lien d'activation copiable, définir le mot de passe, se connecter comme Manager.
8. Vérifier accès limité au garage de test ; refus d'un appel `admin_*` et d'une écriture inter-garage.
9. Rejouer la même soumission avec le même `requestId` → `idempotent:true`, aucun doublon.
10. Erreurs : doublon d'identifiants, nom de confirmation incorrect, appel non SA → refus explicite, aucune donnée partielle.

## Requêtes de contrôle et résultats attendus

```sql
-- 1. Santé
select public.admin_identity_v2_health()
from (select set_config('request.jwt.claim.sub',
  (select id::text from public.profiles where role='saas_admin'), true)) s;
-- Attendu : 9 clés true.
```

```sql
-- 2. Chaîne garage / abonnement / Manager / permissions
select
  (select count(*)::int from public.establishments where name ilike 'ZZ-TEST-%') as garages_test,
  (select count(*)::int from public.subscriptions s join public.establishments e on e.id=s.establishment_id
    where e.name ilike 'ZZ-TEST-%' and s.plan_code='standard' and s.status='trial') as abonnements_trial,
  (select count(*)::int from public.profiles p join public.establishments e on e.id=p.establishment_id
    where e.name ilike 'ZZ-TEST-%' and p.role='manager' and p.must_change_password) as managers,
  (select count(*)::int from public.permissions pm join public.establishments e on e.id=pm.establishment_id
    where e.name ilike 'ZZ-TEST-%' and pm.role='manager' and pm.can_view) as permissions,
  (select count(*)::int from public.invitations i join public.establishments e on e.id=i.establishment_id
    where e.name ilike 'ZZ-TEST-%' and i.status='prepared') as invitations,
  (select count(*)::int from public.audit_log a join public.establishments e on e.id=a.establishment_id
    where e.name ilike 'ZZ-TEST-%' and a.action='onboard_tenant_v2') as audits;
-- Attendu : 1 / 1 / 1 / >0 / 1 / 1.
```

```sql
-- 3. Dates et formule
select s.status, s.plan_code, s.started_at::date, s.trial_ends_at::date, s.current_period_end::date
from public.subscriptions s join public.establishments e on e.id=s.establishment_id
where e.name ilike 'ZZ-TEST-%';
-- Attendu : trial, standard, début = aujourd'hui, fin essai = début+14j, échéance = début+12 mois.
```

```sql
-- 4. Idempotence / doublons / orphelins
select
  (select count(*)::int from public.onboarding_requests where status='completed') as demandes,
  (select count(*)::int from auth.users u where not exists (select 1 from public.profiles p where p.id=u.id)) as auth_orphelins,
  (select count(*)::int from public.establishments e where not exists (select 1 from public.subscriptions s where s.establishment_id=e.id)) as garages_sans_abo;
-- Attendu : demandes inchangé après rejeu, 0 / 0.
```

```sql
-- 5. Isolation Manager (session Manager)
select count(*)::int as garages_visibles from public.establishments;
-- Attendu : 1 (uniquement le garage ZZ-TEST-… du Manager).
```

```sql
-- 6. Géographie enregistrée
select e.country, e.region, e.city
from public.establishments e where e.name ilike 'ZZ-TEST-%';
-- Attendu : code ISO 'MA', région parmi les 12, ville présente dans la liste de cette région.
```

```sql
-- 7. Refus Manager sur RPC admin_* (à exécuter avec le JWT Manager)
select public.is_saas_admin() as est_sa;
-- Attendu : false.
```

## Nettoyage

Uniquement les objets préfixés `ZZ-TEST-…` créés pendant le test, après GO distinct ; jamais les données préexistantes. Aucun compte de test existant n'est supprimé.

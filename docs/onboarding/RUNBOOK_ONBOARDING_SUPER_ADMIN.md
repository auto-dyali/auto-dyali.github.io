# AUTO DYALI — Runbook de finalisation de la création d'abonné (Super Admin)
**Date** : 2026-11-13 · **Migration 0028 : NON APPLIQUÉE** · **Edge Function `onboard-tenant` : NON DÉPLOYÉE**

Ce document liste, dans l'ordre, les opérations que **vous** (ou une session disposant des droits) devez exécuter pour activer le parcours :
**Entreprise + Manager + Établissement + Abonnement + Droits du forfait**, en protégeant les données existantes.

---

## 0. Préservation (non négociable)
- Ne jamais supprimer/modifier : établissement `00000000-0000-0000-0000-000000000001`, abonnement `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22`, ni les comptes `a.naji@auto-dyali.ma` / `r.bami@auto-dyali.ma`.
- Aucune donnée historique n'est touchée par ce protocole.
- Aucun secret n'est écrit dans le dépôt ni transmis dans une conversation.

## 1. Vérifier la vérité du schéma (SQL Editor — rôle postgres/superadmin)
Exécuter dans le **SQL Editor** de Supabase (ou `psql`) :

```sql
-- Migrations / objets critiques
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('plans','plan_features','subscriptions','establishments','profiles','audit_log','onboarding_requests');

select proname from pg_proc join pg_namespace n on n.oid = pronamespace
 where n.nspname='public'
   and proname in ('is_saas_admin','get_my_profile','has_feature','my_features',
                   'admin_create_establishment','admin_change_plan','admin_set_establishment_status',
                   'admin_save_plan','admin_set_feature','admin_find_user_id_by_email',
                   'admin_find_onboarding_request','admin_onboard_tenant','admin_attach_manager','admin_tenant_integrity')
 order by proname;
```

**Interprétation** :
- Si `admin_*` (0010) est absent : **les migrations n'ont pas toutes été appliquées à distance** — voir §5 (application ordonnée). Le code poussé sur GitHub n'a JAMAIS garanti leur présence.
- Si seulement `0028` est absent : appliquer uniquement 0028 (§4).

## 2. Sauvegarde préalable (obligatoire avant toute écriture)
- **Supabase Dashboard → Backups / PITR** : vérifier que les backups sont actifs et noter un timestamp.
- **Alternative CLI** : `pg_dump "postgresql://postgres:[PASSWORD]@db.nxmsqqoflskfajqrqddw.supabase.co:5432/postgres" > backup_$(date +%F_%H%M).sql`
- **Export logique** (si pg_dump indisponible) : exporter CSV/SQL les tables `establishments`, `profiles`, `subscriptions`, `plans`, `plan_features`, `audit_log`.

## 3. Accès runtime (pour que l'application parle réellement)
- Les RPC sont appelées par le navigateur avec le token de la session saas_admin → appliquer les **migrations ci-dessous** (elles portent tous les `grant execute ... to authenticated`).
- Rôle `anon` lecture seule : aucun `grant` anon n'est nécessaire pour le Super Admin.
- `service_role` : JAMAIS dans le navigateur ; uniquement dans l'Edge Function (secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, fournis automatiquement aux Edge Functions Supabase).

## 4. Appliquer la migration 0028 (après §1 et §2)
**Option A — SQL Editor (recommandé)** : ouvrir `supabase/migrations/0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql`, copier son contenu intégral, exécuter dans le SQL Editor.
**Option B — CLI** :
```bash
brew install supabase/tap/supabase
supabase login                                  # ouvre un navigateur, token personnel
supabase link --project-ref nxmsqqoflskfajqrqddw
supabase db push                                # applique supabase/migrations/* (0026/0027 inclus, tous idempotents)
```
**Option C — psql** : coller le fichier avec `psql` ou le SQL Editor.

Vérification (SQL Editor) :
```sql
select proname from pg_proc where proname like 'admin_%onboard%' or proname like 'admin_attach_%';
select * from public.onboarding_requests limit 1;
```

## 5. Si des migrations 0010-0012 sont absentes (mesures à prendre)
Toutes utilisent `create table/function if not exists` ou `create or replace function` : **ré-exécutables sans perte**.
Ordre suggéré après vérification (§1) : 0008 → 0009 → 0010 → 0011 → 0012 → 0015+ → 0018 → 0028.
**Ne pas** appliquer `0027_mission_2_14_managers_prepared_NOT_APPLIED.sql` sans autorisation (elle est délibérément préparée).

## 6. Déployer l'Edge Function `onboard-tenant`
```bash
supabase functions deploy onboard-tenant --project-ref nxmsqqoflskfajqrqddw
# ou via le Dashboard : Edge Functions → New function → coller supabase/functions/onboard-tenant/index.ts → Deploy
```
Vérifications (logs de la fonction) : `supabase functions logs onboard-tenant`.
- Réponse attendue pour une requête valide avec session saas_admin : `{ ok: true, establishment_id, subscription_id, manager_user_id, request_id }`.
- Sans session : `401`. Sans rôle saas_admin : `403`. Sans migration 0028 : `PGRST202` / erreur RPC explicite.
- Secrets : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement ; aucun secret dans le dépôt.

## 7. Test de bout en bout (compte de test autorisé par vous)
1. Connexion saas_admin → `/super-admin/onboarding/`.
2. Wizard : entreprise (ex. `ZZ TEST onboarding` / slug `zz-test-onboarding`), Manager (email jetable existant ou nouveau), forfait SILVER, 14 j d'essai.
3. « Créer l'abonné » → résultat OK.
4. Vérifications SQL :
```sql
select id, name, slug, plan, is_active from establishments where slug='zz-test-onboarding';
select id, role, establishment_id, is_active from profiles where establishment_id = (select id from establishments where slug='zz-test-onboarding');
select plan_code, status, trial_ends_at from subscriptions where establishment_id = (select id from establishments where slug='zz-test-onboarding');
select action, entity, created_at from audit_log where action='onboard_tenant' order by created_at desc limit 1;
select * from public.admin_tenant_integrity((select id from establishments where slug='zz-test-onboarding'));
```
5. Isolation : se connecter en tant que manager du test (mot de passe défini via l'invitation) → doit atterrir sur `/tableau-de-bord/`, **sans** `/super-admin/` ni données d'un autre établissement.
6. Idempotence : re-cliquer « Créer l'abonné » avec le même onglet (requestId inchangé) → `{ "idempotent": true, ... }`, aucun doublon.
7. Nettoyage du test (après validation, avec votre accord explicite) :
```sql
-- ordre : profil → subscription → establishment → user Auth (via Auth Dashboard/API)
delete from public.profiles where establishment_id = (select id from establishments where slug='zz-test-onboarding');
delete from public.subscriptions where establishment_id = (select id from establishments where slug='zz-test-onboarding');
delete from public.establishments where slug='zz-test-onboarding';
-- supprimer l'utilisateur Auth de test via le Dashboard Auth (email jetable)
```

## 8. Rollback si 0028 doit être retirée
```sql
drop function if exists public.admin_onboard_tenant cascade;
drop function if exists public.admin_attach_manager cascade;
drop function if exists public.admin_tenant_integrity cascade;
drop function if exists public.admin_find_user_id_by_email cascade;
drop function if exists public.admin_find_onboarding_request cascade;
drop table if exists public.onboarding_requests;
```
(Aucun rollback ne touche les données historiques.)

## 9. État connu AVANT exécution de ce runbook (lecture seule, 2026-11-13)
La clé PUBLISHABLE (rôle anon) ne voit PAS les données (RLS) et lève :
`PGRST202` pour toutes les `admin_*` (0010), `decrement_product_stock` (0012), `plans`, `plan_features`, `subscriptions`, `payments`, `products`, `client_notifications`, `audit_log`, `profiles`, `establishments` —
**inconclusif avec cette clé** : soit les migrations ne sont pas appliquées, soit la clé anon n'a aucun `grant` (probable pour tout ce qui est `grant select to authenticated`).
My_features() (0009) et les lectures RLS (crm_leads, support_tickets) répondent.
**À vérifier en priorité en SQL Editor** avant toute écriture : §1 ci-dessus.

## 10. Ce que la mission ne doit JAMAIS faire sans votre accord
- Supprimer un compte, restaurer une sauvegarde, changer un rôle.
- Appliquer 0027 (managers) ou toute migration de suppression.
- Exposer `service_role` dans le navigateur ou dans une conversation.

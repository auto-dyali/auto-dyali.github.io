# AUTO DYALI — PROCÉDURE D'ACTIVATION SUPABASE (ordre strict, conditions STOP)
**Code en production** : commit `f74dea4` (déploiement GitHub Pages OK, run CI `43409761204` success).
**Objectif** : rendre opérationnels la création d'abonné (0028) et le CRM (0018), sous sauvegarde vérifiée.

## Ordre d'exécution et résultats attendus

### Étape 0 — Préservation (STOP si incohérent)
**IMPORTANT** : les comptes `a.naji@auto-dyali.ma` (`31b0ca43-413b-4559-ab93-bc0637e97bde`) et `r.bami@auto-dyali.ma` (`72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2`) ont été supprimés par l'utilisateur et ne doivent **pas** être recréés dans cette procédure. Ne cherchez pas à les restaurer.

Exécuter dans SQL Editor (lecture seule) :
```sql
-- Ressources partagées à PROTÉGER (ne jamais supprimer ni modifier)
select count(*) as etab_partage_present
  from public.establishments where id='00000000-0000-0000-0000-000000000001';
select count(*) as abo_partage_present
  from public.subscriptions where id='47b1c71e-cf73-46a5-b0a4-b3f4ac762e22';
-- Vérifier que les anciens comptes ne sont pas présents (ils doivent être absents)
select id, email, role, is_active
  from public.profiles
  where id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2');
```
- Attendu : `etab_partage_present == 1` et `abo_partage_present == 1`. Les deux anciens profils doivent être absents (comptes supprimés, pas de recréation).
- **STOP** si l'établissement partagé ou l'abonnement partagé est absent, ou si un des deux anciens profils est présent (ne pas les recréer ici).

### Étape 1 — Sauvegarde vérifiée (STOP si absente)
Dashboard → Backups (PITR) : confirmer backup actif + noter l’horodatage,
ou `pg_dump "postgresql://postgres:[PASSWORD]@db.nxmsqqoflskfajqrqddw.supabase.co:5432/postgres" > backup.sql`.
- **STOP sans sauvegarde confirmée.**

### Étape 2 — Vérification read-only complète (read-only)
Coller `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql` intégral dans SQL Editor.
Attendu :
- Tables `plans`, `plan_features`, `subscriptions`, `establishments`, `profiles`, `audit_log` présentes.
- Colonnes `trial_ends_at`, `suspended_at` présentes sur `establishments`.
- `is_saas_admin()`, `current_establishment_id()`, `has_feature()`, `my_features()` présentes.
- `onboarding_requests` == ABSENTE ; RPC 0028 == ABSENTES.
- Forfaits `standard`, `silver`, `gold` présents dans `plans`.
- Comptages des sections 7 ≥ 0.
- **STOP** si une dépendance manquante ou plan manquant.

### Étape 3 — Application de 0028 (via script contrôlé)
Coller `supabase/apply/0028_apply_minimal.sql` (PRÉ-FLIGHT + 0028 + POST-CHECKS).
Attendu : `PRÉ-FLIGHT OK` puis `onboarding_requests : CRÉÉE`, les 5 RPC créées.

### Étape 4 — Vérifications post-0028
```sql
select public.admin_tenant_integrity((select id from establishments where slug='zz-test-onboarding'));
select proname from pg_proc where proname in ('admin_onboard_tenant','admin_tenant_integrity','admin_attach_manager','admin_find_user_id_by_email','admin_find_onboarding_request');
```
- Attendu : fonctions présentes ; si établissement de test créé, `coherent=true`.

### Étape 5 — Déploiement de l'Edge Function `onboard-tenant`
```bash
supabase functions deploy onboard-tenant
```
ou Dashboard → Edge Functions → paste `supabase/functions/onboard-tenant/index.ts` → Deploy.
- Secrets attendus auto-injectés : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **STOP** : ne pas exposer la clé service dans le frontend ni partager par chat.

### Étape 6 — Test de bout en bout
Super Admin → « Nouvel abonné » → créer `zz-test-onboarding` → vérifier :
établissement créé, profil Manager créé avec rôle `manager`, subscription `trial` (14 j),
déclencheur idempotence (cliquer « Créer l’abonné » à nouveau dans le même onglet → `idempotent=true`),
invitation email reçue, Manager peut se connecter et n’accède qu’à son entreprise.

### Étape 7 — CRM (décision séparée)
Coller `supabase/apply/0018_apply_minimal.sql` (PRÉ-FLIGHT + 0018 + POST-CHECKS).
Attendu : tables `crm_leads`, `crm_events` créées, policies en place.
Puis `/super-admin/crm/` charge la liste vide sans erreur (et non plus l'écran d'erreur).

### Étape 8 — Création des deux comptes professionnels (par l'utilisateur, depuis le Super Admin)
Une fois 0028 appliquée et l'Edge Function `onboard-tenant` déployée, l'utilisateur crée lui-même les deux abonnés depuis l'interface :

1. Ouvrir `https://auto-dyali.github.io/super-admin/onboarding/` (bouton « Nouvel abonné » dans la sidebar ou depuis `/super-admin/entreprises/`).
2. Se connecter avec le compte `saas_admin` (Super Admin).
3. Pour chaque abonné (`a.naji@auto-dyali.ma` puis `r.bami@auto-dyali.ma`) :
   - Étape 1 : saisir le nom de l'entreprise, le slug, la ville, le téléphone, l'email de l'entreprise.
   - Étape 2 : saisir le nom complet du Manager et son email professionnel.
   - Étape 3 : choisir le forfait (standard/silver/gold) et la durée d'essai.
   - Cliquer « Créer l'abonné ».
4. Vérifier pour chaque création :
   - établissement créé avec son propre `establishment_id` (chaque abonné a un établissement indépendant),
   - profil Manager créé avec le rôle `manager`,
   - abonnement `trial` créé (14 jours par défaut ou selon le forfait),
   - invitation email reçue par le Manager (pour définir son mot de passe),
   - idempotence : cliquer à nouveau « Créer l'abonné » avec le même `requestId` → aucun doublon,
   - isolation : le Manager ne voit que son propre établissement, pas celui de l'autre abonné.
5. Chaque abonné doit avoir UN établissement propre, UN abonnement propre, UN compte Manager propre — ne jamais réutiliser l'établissement partagé `00000000-0000-0000-0000-000000000001` ni l'abonnement `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22`.

## Conditions STOP permanentes (toutes étapes)
- Ne jamais supprimer ni modifier `a.naji` / `r.bami`.
- Ne jamais supprimer l’établissement `00000000-0000-0000-0000-000000000001` ni l’abonnement `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22`.
- Aucune écriture distante sans sauvegarde vérifiée.
- Aucune clé service dans le navigateur ou un chat.

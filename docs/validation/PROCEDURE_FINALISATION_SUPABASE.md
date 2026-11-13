# AUTO DYALI — PROCÉDURE DE FINALISATION SUPABASE (mise en service de l'onboarding et du CRM)

**Objectif** : activer sur le projet distant `nxmsqqoflskfajqrqddw` les migrations `0028` (onboarding entreprise + Manager + abonnement) et `0018` (CRM), déployer l'Edge Function `onboard-tenant`, et rendre le Super Admin opérationnel pour créer des abonnés.

**Code de référence** : commit `c6cea1a` sur `origin/main` (CI success).

---

## Règles de sécurité (inflexibles)

- Aucun mot de passe, clé `service_role`, token privé ou identifiant sensible n'est demandé ni transmis dans le chat.
- Aucune clé secrète n'est placée dans le frontend, GitHub ou les fichiers publics.
- `service_role` reste exclusivement côté serveur (Edge Function), jamais dans le navigateur.
- Aucune opération distante n'est exécutée depuis cet environnement. Toutes les étapes ci-dessous sont à exécuter par vous dans **Supabase Dashboard → SQL Editor** (ou via CLI authentifiée).
- Avant toute mutation : sauvegarde vérifiée obligatoire.
- Les comptes `a.naji@auto-dyali.ma` et `r.bami@auto-dyali.ma` sont supprimés et ne doivent **pas** être recréés dans cette procédure.
- L'établissement partagé `00000000-0000-0000-0000-000000000001` et l'abonnement `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22` sont préservés et ne doivent pas être réutilisés pour les nouveaux abonnés.

---

## Étape 1 — Vérification de la sauvegarde (STOP si absente)

**Où** : Supabase Dashboard → Backups (ou PITR).

**Action** : confirmer qu'une sauvegarde / PITR est active et noter l'horodatage. Ou exécuter un export logique :
```sql
-- Export logique des tables concernées (lecture seule, dans SQL Editor)
select * from public.establishments;
select * from public.profiles;
select * from public.subscriptions;
select * from public.plans;
select * from public.plan_features;
select * from public.audit_log;
```

**Résultat attendu** : sauvegarde disponible et horodatage noté.

**STOP** si aucune sauvegarde n'est confirmée.

---

## Étape 2 — Précontrôle lecture seule (STOP si échec)

**Fichier** : `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql`

**Où** : Supabase Dashboard → SQL Editor (coller l'intégralité du fichier, exécuter).

**Contenu** : 11 sections (tables/colonnes, fonctions et signatures, politiques RLS, RLS activé + privilèges, contraintes/FK, enum `user_role`, comptages, comptes de test, établissement partagé, abonnement partagé, absence des objets 0028).

**Résultat attendu** :
- Tables `plans`, `plan_features`, `subscriptions`, `establishments`, `profiles`, `audit_log` présentes.
- Colonnes `trial_ends_at`, `suspended_at` sur `establishments`.
- Fonctions `is_saas_admin()`, `current_establishment_id()`, `has_feature()`, `my_features()` présentes.
- Forfaits `standard`, `silver`, `gold` présents dans `plans`.
- `onboarding_requests` ABSENTE ; RPC 0028 ABSENTES (état attendu avant application).
- Comptages des sections 7 ≥ 0.

**STOP** si une dépendance manque ou un plan est absent.

---

## Étape 3 — Décision GO / STOP

**Condition GO** : étape 1 confirmée + étape 2 conforme + comptes `a.naji`/`r.bami` absents (non recréés) + établissement et abonnement partagés intacts.

**Condition STOP** : toute anomalie ci-dessus.

---

## Étape 4 — Application de 0028 (onboarding)

**Fichier** : `supabase/apply/0028_apply_minimal.sql`

**Où** : Supabase Dashboard → SQL Editor (coller l'intégralité, exécuter en une fois).

**Contenu** :
- PRÉ-FLIGHT : avorte automatiquement si une dépendance manque (aucun écrit si échec).
- 0028 : crée `onboarding_requests` + 5 RPC (`admin_find_user_id_by_email`, `admin_find_onboarding_request`, `admin_onboard_tenant`, `admin_attach_manager`, `admin_tenant_integrity`).
- POST-CHECKS : lecture seule, vérifie présence des fonctions et de la table.

**Résultat attendu** :
- Message `PRÉ-FLIGHT OK : dépendances 0028 présentes. Application autorisée.`
- `onboarding_requests : CRÉÉE`
- 5 fonctions RPC présentes (POST-CHECKS).

**STOP** si le PRÉ-FLIGHT lève une exception (aucun écrit n'a eu lieu).

---

## Étape 5 — Vérification des RPC et des tables (lecture seule)

**Où** : Supabase Dashboard → SQL Editor.

**Action** : exécuter les POST-CHECKS déjà inclus dans `0028_apply_minimal.sql`, puis :
```sql
-- Vérifier que les 5 fonctions sont exécutables par authenticated
select proname, pg_get_function_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('admin_onboard_tenant','admin_attach_manager','admin_find_user_id_by_email','admin_find_onboarding_request','admin_tenant_integrity')
order by p.proname;

-- Vérifier que la table existe et est vide
select count(*) as lignes from public.onboarding_requests;
```

**Résultat attendu** : 5 fonctions présentes, `lignes = 0` (table vide, aucune création n'a eu lieu).

---

## Étape 6 — Déploiement de l'Edge Function `onboard-tenant`

**Fichier** : `supabase/functions/onboard-tenant/index.ts`

**Où** : Supabase Dashboard → Edge Functions → `onboard-tenant` → coller le contenu du fichier → Deploy.
Ou en CLI : `supabase functions deploy onboard-tenant`.

**Secrets attendus** (configurés dans les paramètres du projet, non transmis dans le chat) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Résultat attendu** : fonction déployée et joignable. L'appel depuis le Super Admin ne doit plus retourner `503` "migration 0028 non appliquée" si l'étape 4 a réussi.

**STOP** si la clé `service_role` est exposée dans une réponse ou un log métier.

---

## Étape 7 — Vérification de l'Edge Function (test technique)

**Où** : depuis le Super Admin connecté en `saas_admin`, ouvrir `/super-admin/onboarding/`.

**Action** : tenter une création (le formulaire affichera une erreur explicite si la fonction n'est pas joignable, mais ne créera rien tant que vous ne validez pas).

**Résultat attendu** : le formulaire charge, les forfaits sont affichés depuis `plans`/`plan_features`, et l'appel à `onboard-tenant` retourne soit une création réussie, soit une erreur métier explicite (jamais une erreur 503 "fonction non trouvée").

---

## Étape 8 — Application séparée de 0018 (CRM — décision séparée)

**Attention** : cette étape est **indépendante** de 0028. Ne l'appliquez que si vous décidez d'activer le CRM.

**Fichier** : `supabase/apply/0018_apply_minimal.sql`

**Où** : Supabase Dashboard → SQL Editor.

**Contenu** :
- PRÉ-FLIGHT : vérifie `is_saas_admin()` et table `establishments`.
- 0018 : crée `crm_leads`, `crm_events`, index, politiques RLS `is_saas_admin()`, grants.
- POST-CHECKS : lecture seule.

**Résultat attendu** : tables `crm_leads` et `crm_events` présentes, politiques saas_admin en place.

**Puis** : ouvrir `https://auto-dyali.github.io/super-admin/crm/` → doit charger une liste vide sans erreur (plus l'écran "table absente").

**STOP** si sauvegarde non confirmée pour cette opération séparée.

---

## Étape 9 — Tests authentifiés depuis le Super Admin

**Prérequis** : compte `saas_admin` actif, 0028 appliquée, Edge Function déployée.

**Où** : `https://auto-dyali.github.io/super-admin/connexion/` puis `/super-admin/onboarding/`.

**Scénario de test (à répéter pour chaque abonné)** :
1. Cliquer « Créer l'abonné ».
2. Étape 1 : nom entreprise, slug, ville, téléphone, email entreprise.
3. Étape 2 : nom Manager, email Manager.
4. Étape 3 : forfait (standard/silver/gold), durée d'essai.
5. Cliquer « Créer l'abonné ».
6. Vérifier : établissement créé (ID propre), abonnement `trial` créé, invitation email envoyée au Manager (aucun mot de passe en clair).
7. Idempotence : cliquer à nouveau « Créer l'abonné » avec le même `requestId` → aucun doublon, `idempotent = true`.
8. Connexion en tant que Manager : il ne voit que SON établissement, pas celui de l'autre abonné.

**Résultat attendu** : création réussie pour chaque abonné, invitation reçue, isolation multi-entreprise respectée.

---

## Étape 10 — Vérification de l'isolation entre deux entreprises

**Où** : Supabase Dashboard → SQL Editor (lecture seule).

**Action** : après création des deux abonnés,
```sql
-- Chaque établissement a son propre abonnement et son propre manager
select e.id, e.name, e.plan, e.is_active,
       s.status as subscription_status,
       count(p.id) as managers_count
from public.establishments e
left join public.subscriptions s on s.establishment_id = e.id
left join public.profiles p on p.establishment_id = e.id and p.role = 'manager'
where e.name ilike '%test%' or e.name ilike '%onboarding%'
group by e.id, e.name, e.plan, e.is_active, s.status;
```

**Résultat attendu** : chaque établissement a exactement 1 manager et 1 abonnement, IDs distincts.

---

## État final attendu

- `0028` appliquée : onboarding opérationnel.
- Edge Function `onboard-tenant` déployée : création d'abonné fonctionnelle depuis le Super Admin.
- `0018` appliquée (si décision séparée) : CRM opérationnel.
- Deux abonnés créés avec établissements et abonnements indépendants.
- Isolation multi-entreprise vérifiée.
- Comptes `a.naji`/`r.bami` non recréés.
- Établissement et abonnement partagés intacts.

---

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql` | Précontrôle lecture seule (étape 2) |
| `supabase/apply/0028_apply_minimal.sql` | Application 0028 (étape 4) |
| `supabase/apply/0018_apply_minimal.sql` | Application 0018 (étape 8, séparée) |
| `supabase/functions/onboard-tenant/index.ts` | Edge Function (étape 6) |
| `docs/validation/ACTIVATION_SUPABASE.md` | Procédure antérieure (conservée) |
| `GV5_SUIVI_AUTO_DYALI.md` | Registre directeur (mis à jour) |

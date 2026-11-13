# AUTO DYALI — VERDICT FINAL GO / STOP SUR LA MIGRATION 0028
**Date** : 2026-11-13 · Commit local `fd88300` (déployé ✅ success) · Aucun objet distant modifié ou appliqué.

---

## A — AUDIT LOCAL CIBLÉ (résultats)

| Vérification | Résultat (preuve locale) |
|---|---|
| 1. Migrations 0009/0010/0012/0018/0028 relues intégralement | ✅ (contenu connu, idempotence confirmée, aucune destruction) |
| 2. `supabase/apply/0028_apply_minimal.sql` relue intégralement | ✅ 456 lignes |
| 3. PRÉ-FLIGHT du script (tables/colonnes/plans/fonctions) | ✅ présent (`do $$…$$` : is_saas_admin, current_establishment_id, establishments+trial_ends_at/suspended_at, plans, subscriptions, audit_log, profiles, seeds standard/silver/gold) |
   Divergences non détectées par le PRÉ-FLIGHT → couvertes par `FINAL_0028_PREFLIGHT_READONLY.sql` (sections 2, 3, 4, 5). |
| 4. Contenu 0028 présent dans le script d'application | ✅ **identique octet pour octet** (`src in app = True`) |
| 5. Instructions destructives cachées | ✅ **aucune** (seul `drop policy if exists` concernant la NOUVELLE table `onboarding_requests`, et `create policy` correspondant — comportement normal de 0028) |
| 6. Contrôles POST-CHECKS suffisants | ✅ fonctions créées + table présente affichées (voir POST-CHECKS) |

**Conclusion A** : le script d'application est sain et auto-contrôlé ; son exécution reste interdite sans sauvegarde confirmée + passages GO de la vérification distante.

---

## B — CONTRÔLES SQL EN LECTURE SEULE

Fichier livré : `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql` — **strictly read-only** (information_schema, pg_proc, pg_policies, pg_class, aclexplode, pg_enum ; zéro écriture ; chaque section indépendante ; aucune référence à `crm_leads`).

Sections :
1. Tables & colonnes indispensables (`establishments`, `profiles`, `subscriptions`, `plans`, `plan_features`)
2. Fonctions 0009/0010 (+ cibles 0028 attendues absentes) : signatures, `md5(prosrc)`, security_definer
3. Politiques RLS (tables ciblées)
4. RLS activé + privilèges EXECUTE (public/authenticated/anon)
5. Contraintes & clés étrangères (FK `plan_features.plan_code→plans.code`, `subscriptions.plan_code→plans.code`, `profiles.id→auth.users`, `establishments`)
6. Type `user_role` — valeurs réelles (`saas_admin, manager, employee, client`)
7. Comptages (`establishments`, `profiles`, `subscriptions`, `plans`, `plan_features`, `audit_log`, `clients`, `support_tickets`) + seed plans
8. Vérification des 2 comptes de test (profiles + auth)
9. Établissement partagé `00000000-…-000000000001`
10. Abonnement partagé `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22`
11. Absence `onboarding_requests` + RPC 0028

---

## C — VERDICTS PAR MIGRATION

| Migration | Verdict | Preuves / Objets manquants / Risques / Préconditions |
|---|---|---|
| **0009** | **DÉJÀ APPLIQUÉE À CONFIRMER** | Tables `plans/plan_features/subscriptions` et colonnes `trial_ends_at/suspended_at` présentes → présomption d’application (au moins partielle). `has_feature`/`my_features`, policies, seeds à confirmer via sections 2, 4, 7 de la vérification. Risques : aucun si re-exécution (idempotente). Précondition : plans contient `standard/silver/gold` pour 0028. |
| **0010** | **DÉJÀ APPLIQUÉE À CONFIRMER** (hors périmètre 0028) | Inconnu à distance (aucun résultat fourni). PAS un prérequis de 0028. Si absente : à appliquer séparément (autorisation + backup) — actions Super Admin existantes dépendent d’elle. Risques : écrasement silencieux d’une éventuelle définition divergente si présente — section 2 de la vérification donne le `md5(prosrc)` pour comparaison. |
| **0012** | **HORS PÉRIMÈTRE — NE PAS APPLIQUER** | POS uniquement (`decrement_product_stock`). Indépendante de 0028/0009. Ne pas mélanger. |
| **0018 CRM** | **STOP — décision séparée** | `crm_leads`/`crm_events` absentes à distance → le CRM en production échoue. Toute décision d’application exige un backup vérifié + votre autorisation. Aucun lien avec 0028. |
| **0028** | **GO CONDITIONNEL** | Techniques tenues (script propre, idempotent, transaction unique atomique, `is_saas_admin()` partout). **Gates obligatoires avant application :** ① **Sauvegarde/PITR confirmée** (non démontrée aujourd’hui → STOP tant que non prouvée) ; ② vérification distante §1–§11 conforme ; ③ `onboarding_requests` absente ; ④ comptes de test + ressources partagées intacts ; ⑤ section 7 : plans contient `standard/silver/gold`. |

---

## D — SAUVEGARDE & AUTORISATION

`STOP — SAUVEGARDE NON CONFIRMÉE`

Aucune preuve (Dashboard → Backups / PITR actif, horodatage, ou export vérifiable) n’a été fournie. Aucune migration n’a été appliquée. Aucun compte créé ou supprimé. Aucune donnée partagée modifiée.

---

## E — LIVRABLES
1. `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql` — script de contrôle (4-signal).
2. Ce rapport — `FINAL_GO_STOP_0028.md`.
3. GV5_SUIVI_AUTO_DYALI.md — section append (voir fichier).
4. Requêtes à exécuter : **le script §1-§11 intégral** de `FINAL_0028_PREFLIGHT_READONLY.sql`.
5. Conditions qui autoriseraient l’étape suivante :
   - §11 : `onboarding_requests` ABSENTE + RPC 0028 absentes ;
   - §2 : `is_saas_admin`, `current_establishment_id` présentes + forfaits standard/silver/gold en §7 ;
   - §7/§8 : comptages plausibles et comptes de test/ressource partagée intacts (profils `31b0ca43…` et `72b8d0a6…` ≠ supprimés, establishment `000…001`/subscription `47b1c71e…` présents) ;
   - §3/§4 : policies et grants cohérents (sinon 0010/0009 à appliquer avant — au cas où elles manqueraient) ;
   - **backup/PITR confirmé par vous**.

**Décision : STOP (sauvegarde non prouvée) — GO CONDITIONNEL sur 0028 une fois les gates ci-dessus levés, avec votre autorisation explicite.**

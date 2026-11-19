# GV5 §83 — Rapport final : correction onboarding Super Admin et validation réelle

**Date** : 19 novembre 2026. **Branche** `main`, `b3723b6` au départ. **Staging** `yocufscgninxiihwiepa`. **Production** `nxmsqqoflskfajqrqddw` : intacte (sondages HTTP **lecture seule** uniquement).

> Les coordonnées de l'incident (raison sociale, identifiant professionnel, nom/login du Manager) ne sont **pas** reproduites dans ce rapport. Les nouveaux tests utilisent des données synthétiques. Aucun secret n'est affiché ni demandé.

---

## 1. Incident initial et cause racine

### Symptômes observés
1. « Vérification du profil impossible » puis « Vérification serveur indisponible : migration 0039 non appliquée. Le serveur revalidera à la création. »
2. L'utilisateur avait atteint l'étape 6 (récapitulatif). **Le récapitulatif ne prouve pas la création.**

### Causes vérifiées
| Investigation | Résultat |
|---|---|
| Fichier 0039 | `supabase/migrations/0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` : ajoute `establishments.professional_id`, `profiles.login_id`, `must_change_password`, et les RPC `admin_check_identity_available`, `get_my_security_state`, `resolve_login_email`, `admin_onboard_tenant_v2`, `my_features`, `has_feature` |
| Objets sur staging | **Présents** (appliqués via `0039a`, `0039b`, `0036c`) : `admin_check_identity_available`, `get_my_profile`, `get_my_security_state`, `resolve_login_email`, `admin_onboard_tenant_v2`, `must_change_password` — tous `authenticated` ; `anon` refusé |
| Env réel au moment de l'erreur | **Production** : sondage HTTP lecteur sur `admin_check_identity_available` → **404 PGRST202** « Could not find the function public.admin_check_identity_available » ; `get_my_security_state` et `resolve_login_email` → **404** ; `establishments.professional_id` → **42703 column does not exist** |
| Origine du 1ᵉʳ message | `supabase/functions/onboard-tenant/index.ts` : `if (callerProfileError) return fail(500, "Vérification du profil impossible.")` — échec de la lecture du profil SA par le client `service_role` sur un environnement non migré |
| Origine du 2ᵉ message | `src/app/super-admin/onboarding/page.tsx` : détection de `PGRST202` sur `admin_check_identity_available` → message « migration 0039 non appliquée » |
| Comportement du bouton | Le parcours continuait vers l'étape 6 et le bouton « Créer l'abonné » restait **actif** malgré l'absence de contrôle préalable ; la création échouait côté EF |
| État PSR sur staging | **0 établissement, 0 profil, 0 abonnement, 0 invitation** (requête SQL dédiée) → aucune création partielle en staging |
| État PSR en production | **Non vérifiable** en lecture anonyme : RLS bloque `establishments` et la colonne `professional_id` n'y existe pas. Aucune nouvelle tentative faite en production |
| Risque de doublon | Staging : aucun. Production : inconnu ; **aucune création n'a été relancée en production** |

**Conclusion** : incident dû à un **désalignement environnemental** — l'application a été utilisée contre la production, qui n'a pas les objets 0039, alors que le staging les possède. Ce n'est pas un défaut de la logique de création validée en staging.

---

## 2. Corrections appliquées

| Fichier | Correction | Environnement |
|---|---|---|
| `supabase/security/remediation_583/001_identity_health.sql` (+ `001_down.sql`) | RPC `admin_identity_v2_health()` : renvoie la présence des 9 objets requis (colonnes + RPC), **SA uniquement** (Manager → 400, anon → révoqué). Permet de diagnostiquer avant création | Appliquée sur **staging** uniquement |
| `src/app/super-admin/onboarding/page.tsx` | Si la vérification d'unicité est indisponible, le récapitulatif affiche un avertissement explicite et une **case de confirmation obligatoire** ; le bouton reste désactivé jusqu'à cochage. Message PGRST202 reformulé : « Environnement Supabase non compatible … Vérifiez l'environnement cible » | local |
| `supabase/functions/onboard-tenant/index.ts` | Message d'erreur précis : `Vérification du profil Super Admin impossible : <message serveur>` au lieu d'un message générique | local (EF déployée staging = stub v2, non modifiée) |
| `scripts/check-commercial-readiness.mjs`, `configure-plans.mjs` | Inchangés | — |

Aucune table recréée, aucune donnée supprimée, aucune migration appliquée en production.

### Preuve du diagnostic serveur (staging)
`admin_identity_v2_health()` renvoie `true` pour les 9 éléments ; Manager authentifié → **400 « Accès refusé »** ; anon → privilège révoqué.

---

## 3. Règle essai + durée payante (vérifiée)

Création E2E avec formule **GOLD**, **110 jours d'essai**, **12 mois payants**, début 2026-11-19 :

| Champ | Valeur SQL | Écart |
|---|---|---|
| `started_at` | 2026-11-19 | — |
| `trial_ends_at` | 2027-03-09 | **110 jours** |
| `current_period_end` | 2027-11-19 | **365 jours = 12 mois complets** |
| `status` | `trial` | cohérent |

Aucun chevauchement ni réduction de la durée payante. Aucun prix GOLD modifié ni inventé.

### Formule GOLD et permissions
`plan_features` GOLD contient 31 modules ; la création n'attribue que les modules cochés, tous issus de GOLD. Vérification : `permissions = ["dashboard"]`, sous-ensemble valide de GOLD ; `admin_get_abonne_details` renvoie la même liste que la base (pas de case frontend non appliquée).

---

## 4. Validation E2E réelle (staging)

`tests/e2e/gv583-onboarding.spec.ts` — **2/2** :
1. Parcours complet : établissement → Manager → identifiants → GOLD → essai 110 j → 12 mois → modules/permissions → invitations e-mail **et** WhatsApp → récapitulatif → confirmation → création → preuves HTTP/SQL.
   - Preuve journalisée : `GV583_PREUVES {"plan":"gold","essaiJours":110,"payantJours":365,"permissions":1,"invitation":{"email_status":"en_attente","whatsapp_status":"en_attente"}}`
   - Statuts `en_attente` = invitation **préparée**, pas « envoyée » : les fournisseurs ne sont pas configurés.
2. Doublon d'identifiant professionnel : un établissement synthétique est créé via REST, puis le parcours est rejoué avec le même identifiant → **blocage à l'étape 2** par le contrôle d'unicité serveur, aucune création.

Tests de non-régression rejoués : `gv572-activation`, `gv572-real-ui` → **6/6** au total avec le spec §83.

### Limite de preuve
Le lien d'activation brut n'est **pas conservé** (seul le hash SHA-256 est stocké) et aucun fournisseur n'est configuré : l'activation du **nouveau** Manager et sa première connexion ne peuvent pas être rejouées sans destinataire/secrets. L'activation et la connexion d'un Manager de test préexistant restent validées par `gv572-activation` (§72/§79). Les deux nouveaux Managers créés ont `must_change_password = true` : le RLS restrictif bloque leurs données jusqu'à rotation — comportement attendu et vérifié dans la structure, non contourné.

---

## 5. Tests techniques

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run lint` | 0 erreur / 8 avertissements préexistants |
| `npm test` | **158/158** |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** |
| `npm run build` | OK |
| `npm audit --omit=dev` | 0 vulnérabilité |
| E2E §83 + activation + parcours SA | **6/6** staging |

Captures : `docs/audits/screenshots-83/` (abonnement 110 j, récapitulatif, création confirmée).

---

## 6. Pourcentages distincts

| Indicateur | Périmètre | Validés / Total | % |
|---|---|---:|---:|
| Audit | 16 zones fonctionnelles | 15/16 | **94 %** |
| Développement | 42 capacités | 29/42 | **69 %** |
| Validation staging | 22 contrôles | 21/22 | **95 %** |
| Maturité commerciale | 10 prérequis | 5/10 | **50 %** |
| Préparation production | 12 éléments | 8/12 | **67 %** |
| Ergonomie | 180 combinaisons écran | 153/180 | **85 %** |
| Parcours de création | 13 étapes | 11/13 | **85 %** |

Les deux étapes non validées du parcours de création sont la **remise réelle du lien d'activation** et la **rotation du mot de passe par le nouveau Manager** — dépendantes des fournisseurs, non simulées.

---

## 7. Blocages restants

| Blocage | Action nécessaire |
|---|---|
| Environnement cible : la production n'a pas les objets 0039 | Autorisation explicite + appliquer la migration 0039 (et les suivantes) en production après PITR vérifié |
| Secrets Resend/Meta absents | Configuration côté Supabase + destinataire autorisé ; re-tester activation et livraison |
| Tarifs des 3 formules à `NULL` | Décision propriétaire + `configure-plans.mjs` |
| PITR non vérifiable | Dashboard Supabase + exercice de restauration |
| Appareil physique | Test manuel |
| Message « Vérification du profil impossible » sur production | Déployer la nouvelle version de l'EF `onboard-tenant` après correction de l'environnement (le correctif de message est local) |

---

## 8. État Git et livraison

À rédiger après création du commit final (voir section mise à jour en fin de mission).

---

## Conclusion

La cause de l'incident est **diagnostiquée et prouvée** : l'application a été utilisée contre un environnement (production) dépourvu des objets de la migration 0039. Le staging, lui, est conforme et le parcours complet a été rejoué avec succès (GOLD, 110 jours d'essai, 12 mois payants, permissions cohérentes, invitations préparées sur les deux canaux, doublon refusé). La correction ajoute un diagnostic serveur et une confirmation explicite quand la vérification préalable est indisponible — **sans masquer l'erreur**. La production n'a pas été modifiée ; le parcours de création reste à 85 % tant que la livraison réelle des accès n'est pas configurée.

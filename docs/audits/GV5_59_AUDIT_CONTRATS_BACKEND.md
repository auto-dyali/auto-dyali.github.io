# GV5 §59 — Audit des contrats frontend / backend / Supabase

Date : 17 novembre 2026. Aucune opération distante.

## 1. Contrat de création d'abonné (v2)

Source unique : `supabase/functions/_shared/contract.ts` ré-exportée par `src/lib/onboarding-contract.ts`. Version 2, payload imbriqué (establishment/manager/subscription/modules/permissions/delivery). Clés inconnues refusées. Le formulaire `src/app/super-admin/onboarding/page.tsx` construit exactement ce payload (vérifié par 20 tests unitaires + 143 tests globaux). **Conforme localement, non vérifié sur Supabase** (aucune EF déployée).

Champs : `professionalId` (regex large, voir A-08), `loginId` (regex LOGIN), `temporaryPassword` (jamais renvoyé/stocké en clair), `paidDurationMonths` (1-120), `trialDurationDays` (0-365). Essai indépendant de la durée payante (`computeSubscriptionDates`). Idempotence par `requestId` (UUID).

## 2. Flux Edge Functions

- `onboard-tenant` : crée l'utilisateur Auth via `admin.auth.admin.createUser` (service_role), appelle RPC `admin_onboard_tenant_v2`, compense par `deleteUser` si la RPC échoue (lignes 257-285). Génère un token SHA-256 (`sha256Hex`), délivre via adaptateurs Resend/WhatsApp (statuts honnêtes). **BLOQUÉ** : RPC absente en distant, secrets absents.
- `activate-manager` : preview sans consommation, activation consommant le jeton, pas de `signUp`, rotation obligatoire. **BLOQUÉ** : EF non déployée, tables invitations absentes.
- `send-invitation` : renvoi, hash seul stocké. **BLOQUÉ**.

## 3. Comparaison migrations 0036–0039 vs schéma distant

| Migration | Contenu | Prérequis | État distant | Risque |
|---|---|---|---|---|
| 0036 | Invitations (hash, statuts par canal, usage unique, events) | 0028, is_saas_admin, pgcrypto | NON APPLIQUÉE (0 table invitations) | faible si sauvegarde |
| 0037 | revoke PUBLIC sur ~18 fonctions, is_manager SECURITY DEFINER | 0001+ | NON APPLIQUÉE (proacl NULL sur helpers) | faible (revoke+grant) |
| 0038 | RLS restrictive + index FK | 0001+ | NON APPLIQUÉE (force_rls=false) | faible |
| 0039 | professional_id, login_id, must_change_password, RPC v2 | 0036, is_saas_admin | NON APPLIQUÉE (colonnes absentes) | moyen (nouvelles colonnes) |

Ordre d'application obligatoire : 0036 → 0037 → 0038 → 0039. Chaque migration contient des pré-contrôles qui échouent si les dépendances manquent (sécurité). Aucune migration ne supprime de données.

## 4. Incompatibilités identifiées

1. Le前端 appelle `admin_check_identity_available` et `admin_onboard_tenant_v2` (0039) : ces RPC n'existent pas en distant → l'onboarding échouerait avec « function not found » (gestion d'erreur explicite dans le formulaire, lignes ~380). **Cohérent mais bloqué**.
2. `resolve_login_email` est appelé par la page de connexion pour l'identifiant Manager : absent en distant → connexion par identifiant non fonctionnelle. **Bloqué**.
3. `my_features()` existe (déployé) mais `has_feature()` (intersection forfait∩permissions) est absente : les permissions fines retournées par le前端 ne sont pas encore appliquées côté serveur. **Bloqué / partiel**.
4. Artificiel 90 j (A-07) corrigé localement dans plans/page.tsx (max 90→365) pour cohérence avec le contrat (0-365).
5. Regex professionnelle large (A-08) : le format généré `ADY-PRO-XXXXXX` est plus strict que la validation serveur ; décision requise avant renforcement (compatibilité identifiants historiques type RC12345).

## 5. Droits EXECUTE (préparés dans les migrations)

0039 prévoit `revoke ... from public` + `grant execute ... to authenticated` pour chaque nouvelle RPC (9 fonctions), sauf `resolve_login_email` volontairement `anon, authenticated` (connexion pré-auth). Garde interne `is_saas_admin()` sur admin_check_identity_available et admin_onboard_tenant_v2. **Cohérent**.

Conclusion : contrats frontend↔backend cohérents localement ; écart majeur = schéma distant en retard de 4 migrations. Aucune incompatibilité de conception bloquante identifiée dans les contrats eux-mêmes.


# GV5 — §121 — RAPPORT FINAL (MISSION LOCALE : AUDIT ACL EXACTS, SÉCURISATION DES EDGE FUNCTIONS ET VALIDATION DU PARCOURS D'ONBOARDING)

**Date** : 26/11/2026 · **Branche** : `gv5-107-prod-final` · **Mode** : exécution locale uniquement
**Aucune écriture distante, aucun push, aucun déploiement, aucun merge, aucun secret, aucun GO.**

---

## A. Git

| Élément | État |
|---|---|
| Dépôt | `auto-dyali/auto-dyali.github.io` |
| Branche | `gv5-107-prod-final` |
| HEAD initial (fin §120) | `0e8bf500d6ddd84a901be716483d86d0d6ad14dd` |
| HEAD final (fin §121) | `0e8bf500d6ddd84a901be716483d86d0d6ad14dd` (inchangé sur le dépôt distant) |
| Modifications locales §121 | `scripts/test-service-role-profiles-select.mjs` (corrigé), nouveaux fichiers migrations/rollbacks/tests, `docs/RM-GV5_REGISTRE_MAITRE.md`, `docs/sessions/session-1/gv5-107-prod-final/§120_TEST_REEL_CHECKLIST.md` (créé), `§121_RAPPORT_FINAL.md` (ce fichier) |
| `main` | `3a0329baee540935c46adac24933bd16c4deebf1` — **inchangé** |
| PR #2 | **ouverte**, head `0e8bf50…`, base `main`, **non mergée** |
| Push effectué (§121) | **NON** |
| Commit/push/fusion durant §121 | **NON** |

## B. ACL

### B.1 ACL de référence (Production, lecture seule, §117/§120)

```text
public.profiles : {postgres=arwdDxtm, anon=Dxtm, authenticated=arwDxtm, service_role=Dxtm}
has_table_privilege('service_role', 'public.profiles', 'SELECT') → false
has_table_privilege('anon',        'public.profiles', 'SELECT') → false
has_table_privilege('authenticated','public.profiles','SELECT') → true
```

### B.2 Reproduction locale corrigée (§121)

Anomalie corrigée dans `scripts/test-service-role-profiles-select.mjs` : la reproduction
initiale contenait `grant delete, references, trigger, maintain on public.profiles to service_role;`
→ instruction **artificielle** ajoutant `DELETE`, absent de l'ACL de référence.

Reproduction corrigée :
- `service_role` : aucun droit (`revoke all`) → pas de SELECT ;
- `anon` : aucun droit → pas de SELECT ;
- `authenticated` : `INSERT / SELECT / UPDATE` (droits initiaux) ;
- RLS activée ; `service_role` en contexte administratif (`bypassrls`).

Vérifications : `has_table_privilege` (rôles × opérations), `pg_class.relacl`,
RLS, comptage `pg_policies`.

### B.3 Résultat migration / rollback

| Étape | État |
|---|---|
| Avant migration | `service_role` SELECT/INSERT/UPDATE/DELETE = false ; `anon` SELECT = false ; `authenticated` conserve ses droits ; RLS activée ; politiques = état initial |
| Après migration `20261126040000` | `service_role SELECT = true`, `INSERT/UPDATE/DELETE = false` ; `anon` SELECT = false ; `authenticated` conserve ses droits ; RLS/politiques inchangés ; aucune autre table touchée |
| Après rollback | **État complet** (privilèges + RLS + politiques) comparé avant/après → **identique** ; défaut `permission denied` de nouveau reproductible |
| Idempotence | **Double application** du script → `service_role=true`, `anon=false` (idempotent) |

## C. Edge Functions

| Fonction | Version déployée (audit, lecture seule) | Tables lues via `service_role`/`admin` | RPC via `caller` | Statut audit |
|---|---|---|---|---|
| `onboard-tenant` | v2 = `17ac6a8…` | `profiles` (SELECT), `invitations` (readDelivery, SELECT) | `admin_onboard_tenant_v2`, `admin_find_user_id_by_email`, `admin_find_onboarding_request`, `admin_record_delivery` | Identité vérifiée avant toute création ; contrôle avant création |
| `send-invitation` | v1 = `a3a824a…` | `profiles`, `invitations`, `establishments` (SELECT) | `admin_create_invitation_renewal`, `admin_prepare_resend`, `admin_record_delivery` | Contrôles SA |
| `activate-manager` | v1 = `b7c10b1…` | `invitations` (SELECT), `profiles` (finale, SELECT) | `admin_accept_invitation` ; preview `anon.rpc` | Token + statut + expiration ; mot de passe via Auth Admin ; connexion re-vérifiée |
| `stripe-webhook` | v1 | RPC `admin_record_billing_event` (tables `plans`/`plan_features`/`subscriptions`/`subscriptions_audit` disposent des droits) | via `service_role` | OK |
| `purge-establishment` | — | RPC via `appelant` ; Auth Admin | — | OK (aucune lecture/écriture table via `service_role` bloquante) |

→ Après installation du GRANT `profiles`, les lectures `invitations` et `establishments`
via `service_role` nécessiteront les correctifs préparés (§D).

## D. Migrations

### D.1 `20261126040000_service_role_profiles_select.sql` (GV5 §117/§118)

- Contenu : `grant select on public.profiles to service_role;` (+ en-tête documentaire).
- Justification : `service_role` sans SELECT sur `public.profiles` alors que l'EF lit `role, is_active`.
- Test : `scripts/test-service-role-profiles-select.mjs` → **10/10** (§121), suite 254/254.
- Rollback : `supabase/rollbacks/gv5108/20261126040000.sql` (`revoke select on public.profiles from service_role;`).
- Résultat local : GRANT effectif, rollback restauré, idempotence vérifiée.

### D.2 `20261126100000_service_role_select_invitations_establishments.sql` (GV5 §121, préparé)

- Contenu : `grant select on public.invitations to service_role;` + `grant select on public.establishments to service_role;`
- Justification : audit EF déployées → lectures `service_role` sur ces tables sans SELECT (sur le chemin onboarding).
- Rollback : `supabase/rollbacks/gv5108/20261126100000.sql` (deux `revoke select`).
- **Préparé, testé, NON APPLIQUÉ** (§121).

## E. Parcours fonctionnel (Super Admin onboarding)

| Fonctionnalité | Développée | Testée localement | Staging | Production |
|---|---|---|---|---|
| Création garage | oui | RPC contractuelle + PGlite | non | non rejouée |
| Création abonnement | oui | RPC + lifecycle PGlite | non | non rejouée |
| Compte Manager | oui | RPC + activation | non | non rejouée |
| Profil Manager | oui | PGlite | non | non rejouée |
| Permissions | oui | PGlite | non | non rejouée |
| Invitation | oui | PGlite | non | non rejouée |
| Activation | oui | statique + PGlite | non | non rejouée |
| Connexion Manager | oui | tests activation | non | vérifiée historiquement |
| Isolation multi-tenant | oui | PGlite/isolation | non | vérifiée historiquement |

## F. Tests

| Commande | Résultat |
|---|---|
| `node --test scripts/test-service-role-profiles-select.mjs` | **10/10** passés |
| `npm test` | **254/254** passés |
| `npx tsc --noEmit` | **OK** |
| `npm run build` | **OK** |
| SHA migration `20261126040000` | `fd61d8695eab27a4607dadcbfaf5cbeec27ff37e601ce96996516b709b185925` |
| SHA script application (§120) | `0db55c784661dee66e0ec251f3ddddd788589cf960827c7d581684ec6b928835` |

## G. Risques restants

- GRANT Production **non appliqué** → création onboarding non démontrée en Production.
- Redéploiement EF (`onboard-tenant` v3/v4) non effectué → nécessite GO.
- Secrets fournisseur / `ACTIVATION_BASE_URL` / notifications non configurés → nécessitent GO.
- Policy `permissions_tenant_write` (migration `20261126010000`) préparée, non appliquée.
- Limitation d'essais d'activation non corrigée.
- Données : 1 garage sans profil (état analysé §115/§121, aucune correction).

## H. Verdict

**Verdict §121 (mission locale) : OBJECTIF LOCAL ATTEINT — parcours non appliqué en Production.**

- Mission §121 exécutée dans son périmètre local : audit, correction du test, reproductions, rollback, audit EF, préparations de migrations, tests (254/254), build, registre, rapport.
- **Aucun GO accordé** (§121, §120) ; aucune écriture distante.
- Objectif opérationnel final (onboarding Super Admin **opérationnel en Production**) : **EN ATTENTE** du `GO-GRANT`, puis application réelle des migrations préparées, vérifications post-application, test réel (`ZZ-TEST-…`), puis `GO-STAGING` / `GO-PRODUCTION`.

**ARRÊT — nouvelle instruction explicite requise.**

# AUTO DYALI — Checklist de validation production (Super Admin)
**Git work** : branche `main` · dernier commit `f829338` (localement)
**Production** : https://auto-dyali.github.io/
**Aucune action distante n'est exécutée sans confirmation de sauvegarde.**

## A. État (vérifié localement, à consigner dans GV5 après chaque étape)

- [ ] Backup/PITR actif (Dashboard → Backups) + horodatage noté
- [ ] `supabase/verification/FINAL_0028_PREFLIGHT_READONLY.sql` exécuté dans le SQL Editor ; 11 sections conformes
- [ ] `supabase/apply/0028_apply_minimal.sql` appliqué ; PRÉ-FLIGHT OK ; POST-CHECKS OK
- [ ] `supabase/apply/0018_apply_minimal.sql` appliqué (si accord séparé) ; POST-CHECKS OK
- [ ] Edge Function `onboard-tenant` déployée (`supabase functions deploy onboard-tenant`)
- [ ] `select public.admin_tenant_integrity('<etab_id>')` → `coherent = true`

## B. Test de bout en bout (compte Super Admin requis)

- [ ] Connexion → `/super-admin/` → ouvrir le wizard « Nouvel abonné »
- [ ] Créer un abonné test (ex. `zz-test-onboarding`) avec slug unique
- [ ] Vérifier : établissement créé, profile manager lié, subscription `trial`, droit d'accès `plan_features`
- [ ] Vérifier l'email d'invitation reçu (mot de passe jamais transmis en clair)
- [ ] Se connecter en tant que manager → `/tableau-de-bord/` ; isolation (aucun accès à `/super-admin/` ni aux données d'un autre établissement)
- [ ] Re-clic « Créer l'abonné » dans le même onglet → `idempotent = true` (aucun doublon)

## C. CRM (après 0018)

- [ ] `/super-admin/crm/` charge sans erreur ; création/édition/filtres/pagination/export d'un prospect test
- [ ] Vérifier aucune donnée fictive affichée (tout vient de `crm_leads`)

## D. Non-régression

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```
- [ ] CI GitHub Actions : job `build` (TypeScript + tests + lint + build) ✅ et job `deploy` ✅
- [ ] Routes `/super-admin/*` en HTTP 200 (curl)

## E. Protections (inchangées)
- [ ] Comptes `a.naji`, `r.bami`, établissement `00000000-0000-0000-0000-000000000001`, abonnement `47b1c71e-cf73-46a5-b0a4-b3f4ac762e22` : NON modifiés
- [ ] `service_role` absent du navigateur/GitHub/frontend
- [ ] Aucun secret demandé/transmis

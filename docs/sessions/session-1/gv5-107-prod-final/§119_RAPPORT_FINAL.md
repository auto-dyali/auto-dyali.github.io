# GV5 §119 — Rapport final de vérification

Branche `gv5-107-prod-final`. Commit §118 vérifié : `0881b3f35bc18f5371263911b9969fd9bf71643a`. Aucune écriture distante effectuée.

## 1. Création finale

`supabase/migrations/20261125103000_prod_minimal_admin_fields.sql` → `admin_onboard_tenant_v2` crée établissement, abonnement lié, profil Manager, permissions, invitation, audit, demande clôturée, avec contrôles d'unicité et idempotence. `supabase/functions/onboard-tenant/index.ts` valide JWT/SA avant création, compense un compte Auth orphelin si la RPC échoue, renvoie `idempotent:true` si la demande est déjà clôturée. Dates : `trial` si essai > 0, fin d'essai = début + jours, échéance = début + mois payés.

Preuves : `scripts/test-onboarding.mjs`, `test-onboarding-contract.mjs`, `test-contract-rpc-067.mjs`, `test-activation.mjs`, `test-permissions.mjs`, harnais PGlite d'application des 9 migrations (preuve historique), `npm test` 253/253.

Défauts ouverts : limitation d'essais absente, policy `permissions_tenant_write` trop large (correctif `20261126010000` préparé), notifications non configurées, sessions non invalidées cryptographiquement à la suspension.

## 2. Correctif profiles

Commit `0881b3f…` : `supabase/migrations/20261126040000_service_role_profiles_select.sql` contient uniquement `grant select on public.profiles to service_role;` ; rollback `revoke select on public.profiles from service_role;`. Aucune métadonnée, RLS, politique, rôle, privilège `anon`/`authenticated`/`PUBLIC` ou autre table modifié.

`scripts/test-service-role-profiles-select.mjs` : 9/9 — ACL reproduite, GRANT ciblé, SA autorisé, Manager/absent/inactif refusés, ordre des contrôles avant création, JWT contrôlé statiquement, rollback testé. EF inchangée, sans fuite de secret ni JWT.

## 3. Staging

Scénario complet préparé dans `§119_STAGING_SCENARIO.md` : connexion SA, précontrôle, pays/région/ville, création `ZZ-TEST-…`, relations en base, connexion Manager, isolation, idempotence, erreurs, nettoyage. Requêtes SQL et résultats attendus inclus. **Non exécuté** : GO et identifiants `GV5_STAGING_*` absents.

## 4. Tableau de décision

Voir section 22.4 du registre : création/abonnement/Manager/vérification SA/permissions/connexion/isolation/notifications — développé et testé localement ; staging non testé ; production inchangée (sauf écritures historiques sous GO du 25/11).

## 5. Réponses obligatoires

1. **Oui**, la création finale du garage et de son abonnement est terminée dans le code.
2. **Oui**, l'erreur `permission denied for table profiles` est corrigée localement ; le correctif est prêt pour validation Staging (migration + rollback + 9 tests).
3. **Oui**, après Staging resteront : GO production pour le GRANT, redéploiement EF v3/v4/v1, secrets fournisseur, migration `20261126010000`, limitation d'essais.

## Verdict

**PRÊT POUR STAGING** — sous réserve du GO écrit et des identifiants de test. **ARRÊT.**

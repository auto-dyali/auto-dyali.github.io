# GV5 §62 — Registre des corrections

Date : 17 novembre 2026. Branche main @ 64359da.

| ID | Défaut | Section | Priorité | Cause | Correction | Fichier | Test | Statut |
|---|---|---|---|---|---|---|---|---|
| C-01 | is_manager INVOKER, sans search_path, appel non qualifié | Sécurité SQL | P0 | §46 A3 / §61 | SECURITY DEFINER + search_path=pg_catalog,public + public.autoplus_current_role() | supabase/security/remediation_062/001_fix_is_manager.sql | node --test test-security-062.mjs (is_manager) | **CORRIGÉ ET TESTÉ LOCALEMENT (script préparé + logique simulée validée)** |
| C-02 | open_ticket_count sans garde, establishment_id arbitraire | Support/SQL | P1 | §61 | Garde intégrée : establishment dérivé de auth.uid(), paramètre ignoré pour non-admin, exception saas_admin, anonyme->0 | supabase/security/remediation_062/002_fix_open_ticket_count.sql | 7 tests open_ticket_count (simulés) | **CORRIGÉ ET TESTÉ LOCALEMENT (script préparé + logique simulée validée)** |
| C-03 | 15 fonctions EXECUTE PUBLIC | Sécurité SQL | P0 | §60/§61 | revoke PUBLIC + grant authenticated (déjà dans 0037 et 061/002) | 061/002 + 0037 | aclexplode(grantee=0) après application | **PRÉPARÉ, NON APPLIQUÉ (distant requis)** |
| C-04 | Aucun appel frontend open_ticket_count | Vérification | — | analyse §62 | documenté (aucun appel à casser) |baseline/test doc | grep src/ | **VÉRIFIÉ** |

## Statuts

- CORRIGÉ ET TESTÉ LOCALEMENT : C-01, C-02 (logique simulée — pas une preuve Supabase).
- PRÉPARÉ NON APPLIQUÉ : C-03.
- VÉRIFIÉ : C-04.
- Aucune modification distante effectuée.


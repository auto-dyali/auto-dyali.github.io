# GV5 §64 — Baseline

Date : 17 novembre 2026. Branche main @ 64359da. Aucune modification distante.

## État initial

HEAD local = origin/main = 64359da, 0 ahead/0 behind. 63 entrées de travail préexistantes. Sauvegarde locale : /private/var/folders/rc/5y3hwpmx3356vmp7kjm1nnb80000gn/T/opencode/gv564-backup-20261117-231141.

Livrables vérifiés : §61 (7 docs + 6 scripts), §62 (6 docs + 2 scripts + test-security-062.mjs), §63 (6 docs + script SELECT). Scripts SQL relus : remediation_061/001-006, remediation_062/001-002, remediation_063/001. Migrations 0036 (485 L), 0037 (177 L), 0038 (161 L), 0039 (729 L) lues. Registre GV5_SUIVI_AUTO_DYALI.md à jour.

## Vérification production (lecture seule, rejouée §64)

is_manager() = INVOKER, search_path NONE ; 0 RPC v2 ; 0 colonne professional_id → état inchangé depuis §63. Advisor Supabase (observé 2026-11-17T23:28:44Z) : 14 fonctions SECURITY DEFINER exécutables par anon, 21 par authenticated, 1 search_path mutable (is_manager), 1 protection mot de passe fuite désactivée (hors périmètre SA). Liste des migrations via MCP = vide.

## Conclusion baseline

Aucune modification Manager/Garage/POS/Stock. Aucune opération distante de modification. Tous les livrables §61-§63 cohérents avec les fichiers réels.


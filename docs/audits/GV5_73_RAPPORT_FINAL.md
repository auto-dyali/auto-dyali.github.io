# GV5 §73 — Rapport final : unification des formulaires Super Admin

Date : 18 novembre 2026. Branche `main` @ `64359da`. Tests réels sur STAGING `yocufscgninxiihwiepa` (cible MCP confirmée). Production intacte.

## 1. Résultat — CRITÈRE DE LIVRAISON ATTEINT

Un **seul espace Abonnés** avec liste/recherche/filtres, fiche détaillée unifiée à 5 onglets, modification préremplie (sans recréation), et une **ComboBox « Actions » compacte** gérant Consulter/Modifier/Renouveler/Suspendre/Réactiver/Archiver/Restaurer. Le parcours Manager §72 reste fonctionnel (non-régression 4/4).

## 2. Fichiers créés / modifiés

| Fichier | Changement |
|---|---|
| `src/components/super-admin-actions-menu.tsx` | **Nouveau** — ComboBox compacte (32px fermée = 8,5 mm), menu au clic, absolu (n agrandit pas la ligne) |
| `src/components/abonne-detail-modal.tsx` | **Nouveau** — fiche unifiée 5 onglets (Infos/Abonnement/Manager/Invitations/Historique) + formulaire de modification prérempli |
| `src/app/super-admin/entreprises/page.tsx` | Intégration ComboBox + handlers archiver/restaurer/renouveler + dispatcher d actions + modale remplacée |
| `supabase/security/remediation_073/001_archive_logique.sql` | **Nouveau** — script préparé (non exécuté en production) : `archived_at` + RPC `admin_archive_establishment` |
| `tests/e2e/gv573-unified.spec.ts` | **Nouveau** — 4 tests E2E réels (ComboBox, fiche, archivage/restauration, mobile) |

## 3. Opérations réellement validées sur STAGING

- Migration archivage logique appliquée (`archived_at` + RPC). Aucune donnée supprimée.
- ComboBox : hauteur fermée mesurée **32 px = 8,5 mm** (≤ 25 mm), menu fermé au départ, ouvre au clic, actions visibles.
- Fiche : 5 onglets, champs préremplis, modification enregistrée sans doublon.
- Archiver → Restaurer : **2 entrées audit_log** (`archive`, `restore`), 0 établissement archivé après restauration, 6 établissements conservés.
- Responsive mobile 390px : ComboBox visible et compacte.
- Non-régression parcours Manager §72 : 4/4 tests passent.

## 4. Tests (résultats exacts)

| Commande | Résultat | Exit |
|---|---|---|
| npx tsc --noEmit | succès | 0 |
| npm run lint | 0 erreur, 7 avertissements préexistants | 0 |
| npm test | 158/158 pass | 0 |
| npm run build | Compiled successfully | 0 |
| E2E unifié (4 tests) | 4/4 pass | 0 |
| E2E non-régression §72 (4 tests) | 4/4 pass | 0 |
| npm audit --omit=dev | 0 vulnérabilité | 0 |

## 5. Blocages restants

Secrets Resend/Meta absents (invitations non envoyées réellement, statuts honnêtes), destinataire de test réel, retrait EF temporaire `create-test-user`, sécurité SQL 0037 sur staging, autorisation DISTINCTE pour la production. `.env.local` restauré à la production après les tests.

État Git : `main` @ `64359da`, 0 commit, 0 push. Production intacte. AUTO DYALI reste en cours jusqu à validation réelle et confirmation du propriétaire.

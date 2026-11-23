# REGISTRE DES ANOMALIES — MISSION GV5 §95

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `gv5-95-audit-modules-super-admin`  
**HEAD initial** : `3514adf` (GV5 §94 — Géographie Maroc enrichie)  
**HEAD final** : (à compléter au commit final)  
**Périmètre** : Modules Super Admin hors périmètre GV5 §94 (géographie Maroc)  
**Production Supabase** : lecture seule stricte — aucune modification  
**Staging Supabase** : migrations 0036→0043 non appliquées (blocage préexistant)

---

## LÉGENDE

| Champ | Signification |
|---|---|
| ID | Identifiant de l'anomalie (GV5-95-###) |
| Sévérité | Critique / Majeure / Mineure / Observation |
| Statut | Corrigée / Ouverte / Non vérifiable / Bloquée (autorisation) / Bloquée (fournisseur) |
| Module | Module Super Admin concerné |
| Fichier | Fichier source concerné |
| Description | Constat factuel |
| Correction | Action réalisée ou à réaliser |
| Blocage | Si non corrigée : raison (migration, secret fournisseur, autorisation, node_modules absent) |

---

## ANOMALIE CORRIGÉE

### GV5-95-001 — Variable d'environnement incorrecte (Intégrations)

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Corrigée** |
| Module | Intégrations & API |
| Fichier | `src/app/super-admin/integrations/page.tsx` |
| Description | La page testait `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` pour déterminer si Supabase est configuré. Cette variable n'existe pas : le fichier `.env.example` et `src/lib/supabase-browser.ts` utilisent `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Conséquence : l'intégration Supabase était systématiquement affichée comme "non configurée" alors qu'elle l'est. |
| Correction | Remplacement de `NEXT_PUBLIC_SUPABASE_ANON_KEY` par `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (2 occurrences : test + message de détail). |
| Blocage | Aucun. |

---

## ANOMALIES OUVERTES (correction hors périmètre ou bloquée)

### GV5-95-002 — Migrations 0036→0043 non appliquées sur staging

| Champ | Valeur |
|---|---|
| Sévérité | Critique |
| Statut | **Bloquée (autorisation)** |
| Module | Tous (Invitations, Onboarding, Archivage, Rôles écriture, Abonnements modification, Fiche unifiée) |
| Fichier | `supabase/migrations/0036_*.sql` … `0043_*.sql` |
| Description | Les migrations 0036 à 0043 sont préparées et versionnées mais non appliquées sur staging. Plusieurs RPC nécessaires aux modules (admin_check_identity_available, admin_onboard_tenant_v2, admin_record_delivery, admin_prepare_resend, admin_archive_establishment, admin_purge_establissement, etc.) sont absentes de la base distante. |
| Correction | Nécessite une autorisation explicite et distincte du propriétaire pour application sur staging (ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043). Hors périmètre §95 (interdit d'appliquer sans autorisation). |
| Blocage | Règle de protection §95 §8 : "Ne pas appliquer de migration staging sans autorisation distincte." |

### GV5-95-003 — Secrets fournisseurs non configurés

| Champ | Valeur |
|---|---|
| Sévérité | Critique |
| Statut | **Bloquée (fournisseur)** |
| Module | Communications (Resend), WhatsApp (Meta), Paiements (Stripe) |
| Fichier | `supabase/functions/send-invitation/index.ts`, `onboard-tenant/index.ts`, `stripe-webhook/index.ts` |
| Description | Aucun secret fournisseur (RESEND_API_KEY, WHATSAPP_ACCESS_TOKEN, STRIPE_SECRET_KEY, etc.) n'est configuré. Les envois e-mail/WhatsApp sont en statut `non_configure`. Aucun paiement SaaS n'est possible. |
| Correction | Configuration des secrets côté serveur (Supabase Edge Functions secrets). Nécessite des valeurs secrètes fournies par le propriétaire. |
| Blocage | Règle de protection §95 §1 : "Ne jamais modifier la production." §8 : aucun secret ne doit être saisi sans autorisation. |

### GV5-95-004 — Tarifs des forfaits NULL en base

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Bloquée (fournisseur / autorisation)** |
| Module | Plans & tarifs, Souscription, Paiements, Rapports |
| Fichier | `supabase/migrations/0009_plans_features_subscriptions.sql` (table `plans`) |
| Description | Les forfaits STANDARD/SILVER/GOLD existent mais leurs `price_monthly`/`price_yearly` sont NULL. Le MRR estimé et les montants dus sont donc affichés comme "non configuré". Aucun abonnement payant ne peut être créé. |
| Correction | Configuration des tarifs réels en base (autorisation propriétaire requise — ne pas modifier les durées ni les paiements traités par §94). |
| Blocage | Règle §95 §3 : "Ne pas modifier les durées, les tarifs ou les paiements." |

### GV5-95-005 — node_modules absent (impossibilité d'exécuter build/lint/tests)

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Ouverte (environnement)** |
| Module | Tous (qualité du code) |
| Fichier | `package.json`, `eslint.config.mjs`, `tsconfig.json`, `playwright.config.ts` |
| Description | Le répertoire `node_modules` est absent de l'environnement de travail. Il est donc impossible d'exécuter `next build`, `eslint`, `tsc --noEmit`, `npm test` (176 tests unitaires) et `playwright test`. |
| Correction | Installer les dépendances (`npm install`) dans un environnement disposant d'un accès réseau et exécuter les contrôles qualité. |
| Blocage | Contrainte d'environnement : pas de `node_modules`, pas de accès réseau garanti pour l'installation. |

---

## ANOMALIES NON VÉRIFIABLES (accès indisponible)

| ID | Module | Motif |
|---|---|---|
| GV5-95-NV-01 | Journal d'audit | RLS et politiques réelles non constatable sans accès à la base staging/production |
| GV5-95-NV-02 | Isolation multi-tenant | Nécessite un accès base pour vérifier que `current_establishment_id()` filtre correctement |
| GV5-95-NV-03 | Edge Functions déployées | Les fonctions `send-invitation`, `onboard-tenant`, `activate-manager`, `stripe-webhook` sont présentes localement mais leur déploiement effectif sur Supabase n'est pas constatable |
| GV5-95-NV-04 | Comptes Super Admin uniques | Nécessite un accès base pour compter les profils `saas_admin` actifs |
| GV5-95-NV-05 | E2E réels sur base avec données | Les E2E utilisent des mocks réseau (`tests/e2e/mock-supabase.ts`), pas de requête réelle Supabase |

---

## ANOMALIES ANTÉRIEURES (non introduites par §95, documentées pour traçabilité)

| ID | Module | Statut | Note |
|---|---|---|---|
| GV5-95-A-01 | Onboarding | Bloqué | Dépend des migrations 0036/0039 (GV5 §93, §94 n'ont pas résolu) |
| GV5-95-A-02 | Archivage / purge | Bloqué | Dépend de la migration 0043 (créée par §93, non appliquée) |
| GV5-95-A-03 | Paiements Stripe | Bloqué | Fournisseur non configuré |
| GV5-95-A-04 | WhatsApp envoi réel | Bloqué | Meta non configuré, pas de webhook signé |

---

## SOMMAIRE

| Catégorie | Nombre |
|---|---|
| Anomalies corrigées pendant §95 | 1 (GV5-95-001) |
| Anomalies ouvertes (bloquées autorisation/fournisseur) | 4 (GV5-95-002 à 005) |
| Anomalies non vérifiables | 5 (NV-01 à NV-05) |
| Anomalies antérieures documentées | 4 (A-01 à A-04) |
| **Total** | **14** |

---

**Aucune donnée fictive n'est présentée comme réelle.** Les seules données de test figurent dans `src/lib/mock-data.ts` (marquée "DÉMONSTRATION", non utilisée par les pages Super Admin) et dans `src/app/super-admin/communications/page.tsx` (prévisualisation de modèles d'e-mail/WhatsApp, explicitement identifiée comme prévisualisation avec données d'exemple `DONNEES_TEST`).

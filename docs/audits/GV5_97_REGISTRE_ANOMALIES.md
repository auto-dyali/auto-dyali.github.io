# REGISTRE DES ANOMALIES — MISSION GV5 §97

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche de consolidation** : `gv5-97-consolidation-super-admin`  
**HEAD final** : (à renseigner au commit final)  
**Production Supabase** : lecture seule stricte — aucune modification  
**Staging Supabase** : migrations 0036→0043 non appliquées (autorisation requise)

---

## LÉGENDE

| Champ | Signification |
|---|---|
| ID | Identifiant de l'anomalie (GV5-97-###) |
| Sévérité | Critique / Majeure / Mineure / Observation |
| Statut | Corrigée / Ouverte / Non vérifiable / Bloquée (autorisation) / Bloquée (fournisseur) |
| Module | Module Super Admin concerné |
| Fichier | Fichier source concerné |
| Description | Constat factuel |
| Correction | Action réalisée ou à réaliser |
| Preuve | Résultat de vérification (TSC, ESLint, tests, build, E2E) |
| Blocage | Si non corrigée : raison (migration, secret fournisseur, autorisation, node_modules absent) |

---

## ANOMALIES CORRIGÉES PENDANT GV5 §97

### GV5-97-001 — Variable d'environnement Supabase incorrecte (Intégrations)

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Corrigée** |
| Module | Intégrations & API |
| Fichier | `src/app/super-admin/integrations/page.tsx` |
| Description | La page testait `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` pour déterminer si Supabase est configuré. Cette variable n'existe pas : le fichier `.env.example` et `src/lib/supabase-browser.ts` utilisent `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Conséquence : l'intégration Supabase était systématiquement affichée comme "non configurée" alors qu'elle l'est. |
| Correction | Remplacement des 2 occurrences de `NEXT_PUBLIC_SUPABASE_ANON_KEY` par `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (test + message de détail). |
| Preuve | Code corrigé, TSC 0 erreur, ESLint 0 erreur, Build OK |
| Blocage | Aucun. |

### GV5-97-002 — Import inutilisé `useCallback` (Employés)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Employés |
| Fichier | `src/app/super-admin/employes/page.tsx` |
| Description | `useCallback` était importé depuis React mais jamais utilisé dans le composant, générant un warning ESLint `@typescript-eslint/no-unused-vars`. |
| Correction | Suppression de `useCallback` de l'import React. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

### GV5-97-003 — Variable `success` inutilisée (Dashboard)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Dashboard (Vue générale) |
| Fichier | `src/app/super-admin/page.tsx` |
| Description | `success` (du `useNotification()`) était assigné mais jamais utilisé, générant un warning ESLint. |
| Correction | Suppression de `success` de la déstructuration, ne gardant que `error: notifyError`. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

### GV5-97-004 — Variable `santeAuth` inutilisée (Dashboard)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Dashboard (Vue générale) |
| Fichier | `src/app/super-admin/page.tsx` |
| Description | `santeAuth` était assignée à `true` mais jamais utilisée, générant un warning ESLint. |
| Correction | Suppression de la variable `santeAuth`. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

### GV5-97-005 — Variable `data` inutilisée (Pré-achats)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Pré-achats / Demandes de souscription |
| Fichier | `src/app/super-admin/pre-achats/page.tsx` |
| Description | `data` était assigné mais jamais utilisé dans l'appel RPC `admin_set_pre_purchase_status`, générant un warning ESLint. |
| Correction | Suppression de `data` de la déstructuration, ne gardant que `error`. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

### GV5-97-006 — Dépendance inutile `supabase` dans useCallback (Dashboard)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Dashboard (Vue générale) |
| Fichier | `src/app/super-admin/page.tsx` |
| Description | Le hook `useCallback charger` avait `supabase` dans son tableau de dépendances. `supabase` est une constante de module (stable), inutile comme dépendance. Warning `react-hooks/exhaustive-deps`. |
| Correction | Retrait de `supabase` des dépendances du `useCallback charger`. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

### GV5-97-007 — Paramètre `taille` inutilisé dans `IconeNav` (Shell Super Admin)

| Champ | Valeur |
|---|---|
| Sévérité | Mineure |
| Statut | **Corrigée** |
| Module | Navigation / Shell Super Admin |
| Fichier | `src/components/super-admin-shell.tsx` |
| Description | Le paramètre `taille` de `IconeNav` était défini avec une valeur par défaut mais jamais utilisé dans le corps du composant, générant un warning ESLint. Aucun appel ne passait `taille`. |
| Correction | Suppression du paramètre `taille` de la signature et du type de `IconeNav`. |
| Preuve | ESLint : warning supprimé sur ce fichier |
| Blocage | Aucun. |

---

## ANOMALIES RESTANTES — BLOQUÉES (autorisation / fournisseur)

### GV5-97-B-01 — Migrations 0036→0043 non appliquées sur staging

| Champ | Valeur |
|---|---|
| Sévérité | Critique |
| Statut | **Bloquée (autorisation)** |
| Module | Invitations, Onboarding, Archivage/Purge, Rôles écriture, Abonnements modification |
| Fichier | `supabase/migrations/0036_*.sql` … `0043_*.sql` |
| Description | Les migrations 0036 à 0043 sont préparées et versionnées mais non appliquées sur staging. Plusieurs RPC nécessaires aux modules sont absentes de la base distante : `admin_invitation_preview`, `admin_accept_invitation`, `admin_record_delivery`, `admin_prepare_resend` (0036) ; `admin_check_identity_available`, `admin_onboard_tenant_v2` (0039) ; `admin_set_subscription` UPSERT (0040) ; `admin_archive_establishment`, `admin_purge_establissement` (0043). |
| Correction | Nécessite une autorisation explicite et distincte du propriétaire pour application sur staging (ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043). |
| Blocage | Règle de protection §97 §6 : "Application des migrations sur staging : autorisation explicite distincte obligatoire." |

### GV5-97-B-02 — Secrets fournisseurs non configurés

| Champ | Valeur |
|---|---|
| Sévérité | Critique |
| Statut | **Bloquée (fournisseur)** |
| Module | Communications (Resend), WhatsApp (Meta), Paiements (Stripe) |
| Fichier | `supabase/functions/send-invitation/index.ts`, `onboard-tenant/index.ts`, `stripe-webhook/index.ts` |
| Description | Aucun secret fournisseur (RESEND_API_KEY, WHATSAPP_ACCESS_TOKEN, STRIPE_SECRET_KEY, etc.) n'est configuré. Les envois e-mail/WhatsApp sont en statut `non_configure`. Aucun paiement SaaS n'est possible. |
| Correction | Configuration des secrets côté serveur (Supabase Edge Functions secrets). Nécessite des valeurs secrètes fournies par le propriétaire. |
| Blocage | Aucune clé secrète ne doit être saisie dans le chat ou les fichiers Git (§97 §6). |

### GV5-97-B-03 — Tarifs des forfaits NULL en base

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Bloquée (fournisseur / autorisation)** |
| Module | Plans & tarifs, Souscription, Paiements, Rapports |
| Fichier | `supabase/migrations/0009_plans_features_subscriptions.sql` (table `plans`) |
| Description | Les forfaits STANDARD/SILVER/GOLD existent mais leurs `price_monthly`/`price_yearly` sont NULL. Le MRR estimé et les montants dus sont donc affichés comme "non configuré". Aucun abonnement payant ne peut être créé. |
| Correction | Configuration des tarifs réels en base (autorisation propriétaire requise — ne pas modifier les durées ni les paiements traités par §94). |
| Blocage | Règle §97 §3 : pas de modification du périmètre §94 sans comprendre les dépendances. |

### GV5-97-B-04 — Table `crm_leads` peut être absente (CRM)

| Champ | Valeur |
|---|---|
| Sévérité | Majeure |
| Statut | **Bloquée (migration)** |
| Module | CRM commercial |
| Fichier | `src/components/crm-module.tsx` |
| Description | La page CRM interroge la table `crm_leads`. Si la migration correspondante n'est pas appliquée, la table est absente et la page affiche un message d'erreur honnête. |
| Correction | Application de la migration créant `crm_leads` (si non déjà appliquée). |
| Blocage | Dépend des migrations staging (lié à GV5-97-B-01). |

---

## ANOMALIES NON VÉRIFIABLES (accès indisponible)

| ID | Module | Motif |
|---|---|---|
| GV5-97-NV-01 | Journal d'audit | RLS et politiques réelles non constatable sans accès à la base staging/production |
| GV5-97-NV-02 | Isolation multi-tenant | Nécessite un accès base pour vérifier que `current_establishment_id()` filtre correctement |
| GV5-97-NV-03 | Edge Functions déployées | Les fonctions `send-invitation`, `onboard-tenant`, `activate-manager`, `stripe-webhook` sont présentes localement mais leur déploiement effectif sur Supabase n'est pas constatable |
| GV5-97-NV-04 | Comptes Super Admin uniques | Nécessite un accès base pour compter les profils `saas_admin` actifs |
| GV5-97-NV-05 | E2E réels sur base avec données | Les E2E utilisent des mocks réseau (`tests/e2e/mock-supabase.ts`), pas de requête réelle Supabase |

---

## SOMMAIRE

| Catégorie | Nombre |
|---|---|
| Anomalies corrigées pendant §97 | 7 (GV5-97-001 à 007) |
| Anomalies bloquées (autorisation/fournisseur/migration) | 4 (GV5-97-B-01 à B-04) |
| Anomalies non vérifiables | 5 (NV-01 à NV-05) |
| **Total** | **16** |

**Aucune donnée fictive n'est présentée comme réelle.** Les seules données de test figurent dans `src/lib/mock-data.ts` (marquée "DÉMONSTRATION", non utilisée par les pages Super Admin) et dans `src/app/super-admin/communications/page.tsx` (prévisualisation de modèles d'e-mail/WhatsApp, explicitement identifiée comme prévisualisation avec données d'exemple `DONNEES_TEST`).

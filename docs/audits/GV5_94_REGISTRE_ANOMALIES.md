# REGISTRE DES ANOMALIES — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)

---

## LÉGENDE DES STATUTS

| Statut | Signification |
|---|---|
| OUVERTE | Anomalie identifiée, non corrigée |
| CORRIGÉE | Correction appliquée, commise et poussée |
| RÉAPPARUE | Anomalie précédemment corrigée mais présente à nouveau |
| NON VÉRIFIÉE | Anomalie suspectée mais non vérifiable (accès DB indisponible) |
| BLOQUÉE | Anomalie bloquée par manque d'autorisation (migrations, secrets) |

---

## A. ANOMALIES CRITIQUES — BLOQUANTES (Création abonné / Manager / Activation)

| # | Anomalie | Cause racine | Fichiers concernés | Statut | Preuve |
|---|---|---|---|---|---|
| A1 | RPC `admin_identity_v2_health` absente sur staging | Migration 0039 non appliquée | `onboarding/page.tsx`, `0039_*.sql` | BLOQUÉE | Rapport §93 |
| A2 | RPC `admin_check_identity_available` absente sur staging | Migration 0039 non appliquée | `onboarding/page.tsx`, `onboard-tenant/index.ts`, `0039_*.sql` | BLOQUÉE | Rapport §93 |
| A3 | RPC `admin_onboard_tenant_v2` absente sur staging | Migration 0039 non appliquée | `onboard-tenant/index.ts`, `0039_*.sql` | BLOQUÉE | Rapport §93 |
| A4 | RPC `admin_invitation_preview` absente sur staging | Migration 0036 non appliquée | `activate-manager/index.ts`, `0036_*.sql` | BLOQUÉE | Rapport §93 |
| A5 | RPC `admin_accept_invitation` absente sur staging | Migration 0036 non appliquée | `activate-manager/index.ts`, `0036_*.sql` | BLOQUÉE | Rapport §93 |
| A6 | RPC `admin_record_delivery` absente sur staging | Migration 0036 non appliquée | `onboard-tenant/index.ts`, `send-invitation/index.ts`, `0036_*.sql` | BLOQUÉE | Rapport §93 |
| A7 | RLS `saas_admin_insert_profiles` absente sur staging | Migration 0042 non appliquée | `abonne-workspace.tsx`, `0042_*.sql` | BLOQUÉE | Rapport §93 |
| A8 | `admin_set_subscription` en UPDATE pur (pas UPSERT) | Migration 0040 non appliquée | `abonne-workspace.tsx`, `0040_*.sql` | BLOQUÉE | Rapport §93 |
| A9 | Colonne `updated_at` absente sur `subscriptions` et `establishments` | Migration 0041 non appliquée | `0040_*.sql`, `0041_*.sql` | BLOQUÉE | Rapport §93 |
| A10 | Secrets fournisseurs absents (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL) | Non configurés | `onboard-tenant/index.ts`, `send-invitation/index.ts`, `activate-manager/index.ts` | BLOQUÉE | Rapport §93 |
| A11 | Tarifs NULL en base (`price_monthly`, `price_yearly`) | Non configurés | `plans/page.tsx`, `souscription/page.tsx` | BLOQUÉE | Rapport §93 |
| A12 | `.env.local` pointe sur Production (lecture seule) | Configuration verrouillée | `.env.local` | BLOQUÉE | Audit du fichier |

---

## B. ANOMALIES CORRIGÉES PENDANT GV5 §94

| # | Anomalie | Correction | Fichiers modifiés | Commit | Preuve |
|---|---|---|---|---|---|
| B1 | Référentiel géographique Maroc incomplet (41 villes, doublons) | 141 villes uniques, 12 régions officielles, provinces renseignées, 0 doublon | `src/lib/maroc-geographie.ts` | `3514adf` | TSC 0, Lint 0, 18 tests passés |
| B2 | Normalisation géographique incohérente | Fonction `normaliserTexte()` unique et cohérente partout | `src/lib/maroc-geographie.ts` | `3514adf` | 18 tests passés |
| B3 | Test de géographie manquant ou incomplet | 18 tests créés (normalisation, villes composées, accents, recherche partielle, filtrage par région, résolution région, pas de doublon) | `scripts/test-maroc-geographie.mjs` | `3514adf` | 18/18 tests passés |

---

## C. ANOMALIES OUVERTES (non corrigées, dépendent des migrations)

| # | Anomalie | Impact | Fichiers concernés | Action nécessaire |
|---|---|---|---|---|
| C1 | Création d'abonné impossible sur staging (RPC 0039 absentes) | Le parcours de création bout en bout ne peut pas être testé | `onboarding/page.tsx`, `onboard-tenant/index.ts` | Appliquer migrations 0036→0039 sur staging |
| C2 | Activation Manager impossible sur staging (RPC 0036 absentes) | Le parcours d'activation ne peut pas être testé | `activate-manager/index.ts` | Appliquer migrations 0036→0039 sur staging |
| C3 | Modification d'abonnement peut échouer (UPDATE pur, pas UPSERT) | Si l'abonnement n'existe pas, `admin_set_subscription` échoue | `abonne-workspace.tsx` | Appliquer migration 0040 sur staging |
| C4 | Erreur 42703 possible (`updated_at` absente) | `admin_set_subscription` (0040) tente d'utiliser `updated_at` | `0040_*.sql`, `0041_*.sql` | Appliquer migration 0041 sur staging |
| C5 | Super Admin ne peut pas insérer un profil Manager (RLS absente) | Création de profil Manager bloquée | `abonne-workspace.tsx`, `0042_*.sql` | Appliquer migration 0042 sur staging |
| C6 | Invitations non envoyables (fournisseurs non configurés) | Statut `non_configure`, pas d'envoi réel | `onboard-tenant/index.ts`, `send-invitation/index.ts` | Configurer secrets Resend/WhatsApp |
| C7 | Pas de facturation (tarifs NULL) | Aucun abonnement payant possible | `plans/page.tsx` | Configurer tarifs STANDARD/SILVER/GOLD |

---

## D. ANOMALIES NON VÉRIFIABLES (accès DB indisponible)

| # | Anomalie suspectée | Raison de non-vérification |
|---|---|---|
| D1 | Présence réelle des RPC sur staging | Aucun outil d'inspection de base de données disponible |
| D2 | État réel des politiques RLS sur staging | Aucun outil d'inspection de base de données disponible |
| D3 | Présence des tables `invitations`, `onboarding_requests` sur staging | Migration 0028/0036 non vérifiable |
| D4 | PITR production vérifié et restaurable | Aucun accès à la configuration Supabase production |
| D5 | État des Edge Functions déployées sur staging/production | Aucun accès au tableau de bord Supabase |

---

## E. ANOMALIES CORRIGÉES ANTÉRIEUREMENT (GV5 §88 à §93, conservées)

| # | Anomalie | Correction | Commit |
|---|---|---|---|
| E1 | Bouton Finaliser POS hors du div.flex | Déplacé à l'intérieur | `25e28ac` |
| E2 | Lignes vides avant `"use client"` (communication-models) | Supprimées | `cac15be` |
| E3 | Boutons quantité POS trop petits (32px < 44px) | Agrandis à 40px | `53bb6ff` |
| E4 | Scripts temporaires fix*.js (require interdit) | Supprimés | `514e7bb` |
| E5 | Apostrophes non échappées (communications/page.tsx) | Remplacées par `&apos;` | `514e7bb` |
| E6 | Boutons suppression POS trop petits (32-36px < 44px) | Agrandis à 40px | `144bdb3` |
| E7 | Bouton Modifier : mode édition pas activé | Prop `openEditMode` ajouté | `33848cc` |
| E8 | Localisation Maroc : normalisation incohérente | Fonction `normaliserTexte` unique | `0ad1826` |
| E9 | Localisation Maroc : filtrage par région absent | `rechercherVillesMaroc` avec filtre région | `0ad1826` |
| E10 | Migration archive/purge absente des officielles | Migration 0043 créée | `0ad1826` |
| E11 | Référentiel Maroc incomplet (41 villes, doublons) | 141 villes uniques, 12 régions, 0 doublon | `3514adf` |

---

## RÉCAPITULATIF

| Catégorie | Nombre |
|---|---|
| Anomalies critiques bloquantes | 12 |
| Anomalies corrigées pendant GV5 §94 | 3 |
| Anomalies ouvertes (dépendent des migrations) | 7 |
| Anomalies non vérifiables (accès DB) | 5 |
| Anomalies corrigées antérieurement | 11 |
| **Total** | **38** |

---

## BLOQUAGES REQUIRANT UNE AUTORISATION PROPRIÉTAIRE

| # | Blocage | Action | Environnement |
|---|---|---|---|
| 1 | Application migrations 0036→0043 sur staging | Autorisation explicite et distincte | Staging `yocufscgninxiihwiepa` |
| 2 | Configuration secrets fournisseurs | Autorisation + valeurs secrètes | Staging/Production |
| 3 | Configuration tarifs réels | Autorisation + valeurs tarifaires | Staging/Production |
| 4 | Basculement `.env.local` vers staging pour E2E | Autorisation temporaire | Local |
| 5 | Vérification PITR production | Autorisation | Production |

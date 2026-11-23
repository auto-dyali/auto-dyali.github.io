# PLAN DE PRODUCTION — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)  
**Production Supabase** : `nxmsqqoflskfajqrqddw` (LECTURE SEULE STRICTE)

---

## 1. RÈGLE ABSOLUE

**Aucune écriture sur Production Supabase n'est autorisée sans autorisation explicite et distincte du propriétaire.**

Le site publié `https://auto-dyali.github.io/` utilise Supabase Production en lecture seule pour la construction statique (variables d'environnement dans le workflow GitHub Pages).

---

## 2. ÉTAT ACTUEL DE PRODUCTION

| Élément | État | Preuve |
|---|---|---|
| URL Supabase | `https://nxmsqqoflskfajqrqddw.supabase.co` | `.env.local` |
| Clé publishable | `sb_publishable_ugGsts0KUOh1VBmYAla5hA_ZXNjZ4bT` | `.env.local` |
| Migrations 0036→0043 appliquées | NON VÉRIFIABLE (aucun outil d'inspection) | — |
| Objets requis (24) | 0/24 (selon rapport §86) | `scripts/check-production-readiness.mjs` |
| PITR vérifié | NON VÉRIFIABLE | — |
| Sauvegarde restaurable | NON VÉRIFIABLE | — |

---

## 3. PLAN DE MISE À NIVEAU PRODUCTION (À préparer, pas à exécuter)

Ce plan est préparé mais **ne sera exécuté que sur autorisation explicite et distincte du propriétaire**.

### 3.1 Prérequis (avant toute exécution sur Production)

1. Sauvegarde/PITR de production vérifiée et exploitable (test de restauration réussi)
2. Autorisation écrite et explicite du propriétaire
3. Fenêtre de maintenance convenue
4. Plan de rollback testé
5. Vérification que staging a validé les migrations sans régression

### 3.2 Ordre d'application sur Production

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
```

### 3.3 Procédure par migration

Pour chaque migration sur Production :
1. Vérifier que la migration précédente a réussi
2. Exécuter via SQL Editor (rôle owner/service_role)
3. Vérifier les nouvelles fonctions RPC et tables/colonnes
4. Tester un appel simple de chaque nouvelle RPC (si possible)
5. En cas d'échec : arrêter immédiatement, restaurer depuis la sauvegarde

---

## 4. CONFIGURATIONS REQUISES SUR PRODUCTION (Après migrations)

| Configuration | Élément | Statut | Action |
|---|---|---|---|
| Secrets | RESEND_API_KEY, EMAIL_FROM | Absents | Configurer (autorisation requise) |
| Secrets | WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, etc. | Absents | Configurer (autorisation requise) |
| Secrets | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Absents | Configurer (autorisation requise) |
| Secrets | ACTIVATION_BASE_URL | Absent | Configurer (autorisation requise) |
| Tarifs | price_monthly, price_yearly (STANDARD/SILVER/GOLD) | NULL | Renseigner (autorisation requise) |

---

## 5. CRITÈRES DE VALIDATION PRODUCTION (Après autorisation et migrations)

| # | Critère | Méthode de vérification |
|---|---|---|
| P1 | Création d'abonné sur production | Test avec données synthétiques, vérifier persistance |
| P2 | Activation Manager sur production | Test complet du parcours d'activation |
| P3 | Isolation multi-tenant | Vérifier qu'un Manager ne voit pas les données d'un autre établissement |
| P4 | Journal d'audit | Vérifier que les actions sensibles sont journalisées |
| P5 | PITR fonctionnel | Test de restauration depuis la sauvegarde |
| P6 | Aucun mot de passe en clair | Vérifier que `temporaryPassword` n'est jamais stocké |

---

## 6. RISQUES ET MITIGATIONS

| Risque | Niveau | Mitigation |
|---|---|---|
| Perte de données lors de migration | Élevé | Sauvegarde/PITR vérifiée avant application, rollback préparé |
| Régression des fonctionnalités existantes | Moyen | Tests E2E sur staging avant production |
| Exposition de secrets | Élevé | Jamais exposés dans le code, configurés côté serveur uniquement |
| Paiement simulé ou faux | Élevé | Aucun fournisseur intégré sans confirmation réelle |
| Créations en doublon | Moyen | Idempotence par `requestId`, vérification d'unicité côté serveur |

---

## 7. PROCHAINES ÉTAPES (Requièrent autorisation propriétaire)

1. **Obtenir autorisation pour appliquer migrations 0036→0043 sur staging**
2. **Appliquer les migrations sur staging** (avec sauvegarde préalable)
3. **Valider sur staging** (tests E2E complets)
4. **Configurer secrets et tarifs sur staging** puis sur production
5. **Préparer le plan de migration production** (sauvegarde, ordre, rollback)
6. **Obtenir autorisation pour exécution sur production**
7. **Exécuter les migrations sur production** (uniquement avec autorisation distincte)
8. **Valider sur production** (tests E2E avec données synthétiques)

---

## 8. CONFIRMATION

| Élément | Confirmation |
|---|---|
| Aucune écriture sur Production pendant GV5 §94 | ✅ Confirmé |
| Aucune migration appliquée sur Production | ✅ Confirmé |
| Aucun secret exposé | ✅ Confirmé |
| Aucun faux paiement déclaré | ✅ Confirmé |
| Plan de production préparé (non exécuté) | ✅ Confirmé |

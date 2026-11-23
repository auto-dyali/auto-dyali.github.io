# PLAN DE PRODUCTION — SESSION_1 — GV5 §98

**Date** : 23 novembre 2026  
**Session** : SESSION_1  
**Mission** : GV5 §98 — Déblocage staging et validation du parcours d'abonnement  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `6fbd571` (synchronisé avec `origin/main`)

---

## 1. RÈGLE ABSOLUE

**Production Supabase (`nxmsqqoflskfajqrqddw`) reste en lecture seule.** Aucune écriture, aucune migration, aucune modification de données n'est autorisée pendant cette mission.

---

## 2. INVENTAIRE DES MIGRATIONS À APPLIQUER SUR PRODUCTION

| Migration | Fichier présent | Dépendances | Objet principal | Risque |
|---|---|---|---|---|
| 0036 | ✅ | 0028, 0001, pgcrypto, uuid-ossp | Tables `invitations`, `invitation_events` ; RPC invitation | Moyen (création tables) |
| 0037 | ✅ | 0001, 0028 | Durcissement sécurité P0 : fonctions SECURITY DEFINER, politiques RLS | Élevé (modification privilèges) |
| 0038 | ✅ | 0001, 0028 | Consolidation RLS `audit_log` et `establishments` ; index FK | Moyen (modification politiques) |
| 0039 | ✅ | 0001, 0007, 0009, 0028, 0036, 0037/0038 | Colonnes d'identité, onboarding v2, RPC `admin_onboard_tenant_v2` | Élevé (modification schéma) |
| 0040 | ✅ | 0009, fonction admin_set_subscription (remediation_075) | `admin_set_subscription` en UPSERT | Faible |
| 0041 | ✅ | 0009 | Colonne `updated_at` sur `subscriptions` et `establishments` | Faible |
| 0042 | ✅ | 0001, is_saas_admin (0028) | Politiques RLS `saas_admin_insert_profiles` sur `profiles` | Faible |
| 0043 | ✅ | 0001, 0028, 0041 | Colonnes `archived_at`/`updated_at` sur `establishments` ; RPC archive/purge | Faible |

### Ordre d'application obligatoire sur production

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
```

---

## 3. PRÉREQUIS AVANT TOUTE APPLICATION SUR PRODUCTION

| # | Prérequis | Statut | Action requise |
|---|---|---|---|
| 1 | Sauvegarde/PITR de production vérifiée et exploitable | NON VÉRIFIABLE | Vérifier avec le propriétaire |
| 2 | Autorisation propriétaire explicite et distincte | NON OBTENUE | Demander au propriétaire |
| 3 | Fenêtre de maintenance convenue | NON CONVENUE | Coordonner avec l'équipe |
| 4 | Vérification que staging a validé les migrations sans régression | NON FAIT | Exécuter les tests E2E sur staging d'abord |
| 5 | Plan de rollback préparé | À PRÉPARER | Créer les fichiers `*_down.sql` |

---

## 4. PROCÉDURE D'APPLICATION SUR PRODUCTION (UNIQUEMENT AVEC AUTORISATION)

Pour chaque migration, exécuter les étapes suivantes :

### Étape A — Pré-application
1. Vérifier que la migration précédente a été appliquée avec succès
2. Vérifier les précontrôles de la migration (blocs `do $$ ... begin ... raise exception ... end $$`)
3. Exécuter la migration via SQL Editor (rôle owner/service_role)
4. Consigner le résultat (succès/échec, message d'erreur)

### Étape B — Post-application
1. Vérifier que les nouvelles fonctions RPC existent (via `pg_proc`)
2. Vérifier que les nouvelles tables/colonnes existent (via `information_schema`)
3. Vérifier les politiques RLS (via `pg_policies`)
4. Tester un appel simple de chaque nouvelle RPC (si possible avec un compte saas_admin)

### Étape C — En cas d'échec
1. Arrêter immédiatement la séquence
2. Ne pas tenter d'appliquer les migrations suivantes
3. Consulter le message d'erreur
4. Restaurer depuis la sauvegarde/PITR si nécessaire
5. Documenter l'échec précisément

---

## 5. CONFIGURATIONS REQUISES SUR PRODUCTION (APRÈS MIGRATIONS)

| Configuration | Élément | Statut | Action |
|---|---|---|---|
| Secrets | RESEND_API_KEY, EMAIL_FROM | Absents | Configurer (autorisation requise) |
| Secrets | WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, etc. | Absents | Configuration fournisseur WhatsApp |
| Secrets | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Absents | Configuration paiement |
| Secrets | ACTIVATION_BASE_URL | Absent | Configuration URL d'activation |
| Tarifs | price_monthly, price_yearly (STANDARD/SILVER/GOLD) | NULL | Renseigner les tarifs réels |

---

## 6. CRITÈRES DE VALIDATION PRODUCTION (APRÈS AUTORISATION ET MIGRATIONS)

| # | Critère | Méthode de vérification |
|---|---|---|
| P1 | Création d'abonné sur production | Test avec données synthétiques, vérifier persistance |
| P2 | Activation Manager sur production | Test complet du parcours d'activation |
| P3 | Isolation multi-tenant | Vérifier qu'un Manager ne voit pas les données d'un autre établissement |
| P4 | Journal d'audit | Vérifier que les actions sensibles sont journalisées |
| P5 | PITR fonctionnel | Test de restauration depuis la sauvegarde |
| P6 | Aucun mot de passe en clair | Vérifier que `temporaryPassword` n'est jamais stocké |

---

## 7. RISQUES ET MITIGATIONS

| Risque | Niveau | Mitigation |
|---|---|---|
| Perte de données lors de migration | Élevé | Sauvegarde/PITR vérifiée avant application, rollback préparé |
| Régression des fonctionnalités existantes | Moyen | Tests E2E sur staging avant production |
| Exposition de secrets | Élevé | Jamais exposés dans le code, configurés côté serveur uniquement |
| Paiement simulé ou faux | Élevé | Aucun fournisseur intégré sans confirmation réelle |
| Créations en doublon | Moyen | Idempotence par `requestId`, vérification d'unicité côté serveur |

---

## 8. PROCHAINES ÉTAPES (REQUIRENT AUTORISATION PROPRIÉTAIRE)

1. **Obtenir autorisation pour appliquer migrations 0036→0043 sur staging**
2. **Appliquer les migrations sur staging** (avec sauvegarde préalable)
3. **Valider sur staging** (tests E2E complets)
4. **Configurer secrets et tarifs sur staging** puis sur production
5. **Préparer le plan de migration production** (sauvegarde, ordre, rollback)
6. **Obtenir autorisation pour exécution sur production**
7. **Exécuter les migrations sur production** (uniquement avec autorisation distincte)
8. **Valider sur production** (tests E2E avec données synthétiques)

---

## 9. CONCLUSION

Aucune migration n'a été appliquée sur production pendant cette session. Production reste en lecture seule. Toutes les migrations sont préparées dans Git mais non appliquées. Le plan de production est prêt mais ne peut être exécuté sans autorisation propriétaire explicite.

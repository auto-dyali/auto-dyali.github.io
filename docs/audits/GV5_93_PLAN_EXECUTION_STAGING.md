# PLAN D'EXÉCUTION STAGING — MISSION GV5 §93

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `0ad1826` (synchronisé avec `origin/main`)  
**Cible** : Staging Supabase `yocufscgninxiihwiepa`  
**Production Supabase** : `nxmsqqoflskfajqrqddw` (LECTURE SEULE — AUCUNE ÉCRITURE)

---

## 1. PRÉALABLES OBLIGATOIRES (avant toute application)

| # | Prérequis | Responsable | Preuve attendue |
|---|---|---|---|
| 1 | Autorisation explicite et distincte du propriétaire pour appliquer les migrations sur staging | Propriétaire du projet | Écrit (email/ticket) |
| 2 | Sauvegarde/PITR de staging vérifiée et exploitable | Propriétaire + support Supabase | Test de restauration réussi |
| 3 | Audit read-only de l'état réel de staging (définitions, privilèges, RLS, policies) | Opérateur | Rapport d'audit read-only |
| 4 | Vérification que les dépendances antérieures (0001→0028) sont présentes sur staging | Opérateur | Liste des migrations appliquées sur staging |
| 5 | Fenêtre de maintenance convenue (impact utilisateurs) | Propriétaire + équipe | Confirmation de créneau |

---

## 2. ORDRE D'APPLICATION DES MIGRATIONS

| Ordre | Migration | Objet | Risque | Rollback |
|---|---|---|---|---|
| 1 | 0036 | Invitations Manager sécurisées (tables invitations, invitation_events, RPC invitation) | Moyen (création de tables) | 0036_down.sql (à préparer) |
| 2 | 0037 | Durcissement sécurité P0 (fonctions SECURITY DEFINER, politiques RLS, `is_manager()`) | Élevé (modification de privilèges) | 0037_down.sql (à préparer) |
| 3 | 0038 | Sécurité RLS et index (politiques consolidées, index FK) | Moyen (modification de politiques) | 0038_down.sql (à préparer) |
| 4 | 0039 | Identités, onboarding v2, RPC `admin_onboard_tenant_v2` (CRITIQUE) | Élevé (modification de schéma establishments/profiles) | 0039_down.sql (à préparer) |
| 5 | 0040 | `admin_set_subscription` en UPSERT | Faible (modification d'une fonction existante) | 0040_down.sql (à préparer) |
| 6 | 0041 | Colonne `updated_at` sur subscriptions et establishments | Faible (ajout de colonne) | 0041_down.sql (à préparer) |
| 7 | 0042 | RLS profiles — insertion Super Admin | Faible (ajout de politiques RLS) | 0042_down.sql (à préparer) |
| 8 | 0043 | Archivage logique + suppression définitive (`admin_archive_establishment`, `admin_purge_establishment`) | Faible (ajout de colonnes + fonctions) | 0043_down.sql (à préparer) |

### Ordre final

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
```

---

## 3. PROCÉDURE D'APPLICATION (par migration)

Pour chaque migration, exécuter les étapes suivantes :

### Étape A — Pré-application
1. Vérifier que la migration précédente a été appliquée avec succès
2. Vérifier les précontrôles de la migration (fichiers SQL contiennent des blocs `do $$ ... begin ... raise exception ... end $$`)
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

## 4. TESTS APRÈS MIGRATION (sur staging, données synthétiques)

| # | Scénario | Résultat attendu |
|---|---|---|
| T1 | Créer un établissement synthétique via l'interface Super Admin | Établissement créé, `professional_id` enregistré |
| T2 | Créer son Manager synthétique | Compte Auth créé, profil Manager associé, rôle `manager` |
| T3 | Vérifier l'association Manager ↔ établissement | `profiles.establishment_id` = ID de l'établissement |
| T4 | Créer un abonnement GOLD de test | Abonnement créé, statut `trial` ou `active` |
| T5 | Vérifier la durée payante et l'essai indépendant | Dates cohérentes, essai ne réduit pas la durée payante |
| T6 | Vérifier les modules et permissions | Modules du forfait attribués, permissions cohérentes |
| T7 | Créer une invitation durable | Invitation créée, statut `prepared`, token hash stocké |
| T8 | Vérifier le statut de livraison | `non_configure` si Resend/WhatsApp absents (pas de faux envoi) |
| T9 | Activer le compte (parcours sécurisé) | Mot de passe défini, invitation consommée, `must_change_password` = false |
| T10 | Définir le mot de passe | Mot de passe ≥ 10 caractères, lettre + chiffre |
| T11 | Première connexion réelle du Manager | `signInWithPassword` réussi, session valide |
| T12 | Vérifier l'accès à son établissement uniquement | RLS isole, pas d'accès aux autres établissements |
| T13 | Modifier les informations de l'établissement | Sauvegarde RPC réussie, persistance après rechargement |
| T14 | Modifier l'abonnement | Sauvegarde réussie, dates mises à jour |
| T15 | Tester suspension et réactivation | Statut bascule correctement, journalisé |
| T16 | Tester archivage et restauration | `archived_at` bascule, filtre « Archivés » fonctionne |
| T17 | Tester suppression définitive (uniquement synthétique éligible) | Refus si données métier, succès si éligible, audit conservé |
| T18 | Vérifier le journal d'audit | Entrées `onboard_tenant_v2`, `archive`, `restore`, `password_changed` |
| T19 | Vérifier l'isolation entre deux établissements | Manager A ne voit pas les données de l'établissement B |
| T20 | Tester doublons (identifiant pro, email, login_id) | Erreur 409 explicite, pas de création en double |
| T21 | Tester double-clic / double soumission | Idempotence par `requestId`, pas de doublon |
| T22 | Tester interruption réseau | Vente/onboarding en file offline, pas d'écriture partielle |
| T23 | Tester échec d'invitation | Erreur explicite, état récupérable |
| T24 | Tester absence de Resend | Statut `non_configure`, création durable malgré tout |
| T25 | Tester absence de WhatsApp | Statut `non_configure`, création durable malgré tout |

---

## 5. PLAN DE ROLLBACK

| Étape | Action |
|---|---|
| R1 | Avant la migration 0036 : prendre une sauvegarde/PITR de staging |
| R2 | En cas d'échec à l'étape N : restaurer la sauvegarde prise à R1 |
| R3 | Vérifier la restaurabilité (test de restauration sur une base temporaire) |
| R4 | Documenter l'échec et la cause racine |
| R5 | Reprendre la séquence uniquement après résolution de la cause |

### Fichiers de rollback à préparer

Chaque migration 0036→0043 devrait avoir un fichier `*_down.sql` correspondant dans `supabase/migrations/` ou `supabase/security/remediation_*/`. À ce jour, seuls certains fichiers `remediation_*` ont des `001_down.sql`. Les fichiers `down.sql` manquants doivent être créés avant l'application.

---

## 6. BLOQUAGES REQUIRANT UNE AUTORISATION PROPRIÉTAIRE

| # | Blocage | Action requise | Environnement |
|---|---|---|---|
| 1 | Application des migrations 0036→0043 | Autorisation explicite et distincte | Staging `yocufscgninxiihwiepa` |
| 2 | Configuration secrets fournisseurs (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL) | Autorisation + valeurs secrètes | Staging |
| 3 | Configuration tarifs réels STANDARD/SILVER/GOLD | Autorisation + valeurs tarifaires | Staging |
| 4 | Basculement `.env.local` vers staging pour exécuter les E2E | Autorisation temporaire | Local |
| 5 | Vérification PITR production (sauvegarde restaurable) | Autorisation | Production |

---

## 7. CONFIRMATION — AUCUNE ÉCRITURE PENDANT LA PRÉPARATION

| Élément | Confirmation |
|---|---|
| Aucune migration appliquée sur staging | ✅ (interdit sans autorisation) |
| Aucune migration appliquée sur production | ✅ (lecture seule stricte) |
| Aucune donnée Supabase modifiée | ✅ |
| Aucun secret exposé | ✅ |
| Aucune suppression de données réelles | ✅ |

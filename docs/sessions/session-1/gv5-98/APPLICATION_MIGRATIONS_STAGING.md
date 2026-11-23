# APPLICATION DES MIGRATIONS SUPABASE STAGING — AUTO DYALI

**Projet :** AUTO DYALI  
**Mission :** GV5 §98 — Création des abonnés  
**Projet cible :** Staging `yocufscgninxiihwiepa`  
**Date :** 23 novembre 2026

---

## 1. PRÉALABLES

Avant d'exécuter ce script, assurez-vous que :

1. **Supabase CLI est installé** sur votre Mac :
   ```bash
   supabase --version
   ```
   Doit afficher `3.3.0` ou version supérieure.

2. **Vous êtes authentifié** :
   ```bash
   supabase login
   ```
   Si vous n'êtes pas authentifié, exécutez `supabase login` et suivez les instructions.

3. **Vous êtes dans le répertoire racine du dépôt** `auto-dyali/auto-dyali.github.io`.

---

## 2. APPLICATION DES MIGRATIONS

Les 8 migrations 0036 à 0043 doivent être appliquées dans l'ordre suivant :

| Ordre | Migration | Objet |
|-------|-----------|-------|
| 1 | 0036 | Invitations Manager sécurisées (tables invitations, invitation_events, RPC invitation) |
| 0037 | Durcissement sécurité P0 (fonctions SECURITY DEFINER, politiques RLS) |
| 0038 | Sécurité RLS et index (politiques consolidées, index FK) |
| 0039 | Identités Super Admin, onboarding v2, RPC admin_onboard_tenant_v2 |
| 0040 | admin_set_subscription en UPSERT |
| 0041 | Colonne updated_at sur subscriptions et establishments |
| 0042 | RLS profiles — insertion Super Admin |
| 0043 | Archivage logique et suppression définitive (admin_archive_establishment, admin_purge_establishment) |

### Procédure

1. Ouvrez un terminal dans le répertoire racine du dépôt `auto-dyali/auto-dyali.github.io`.

2. Rendez le script exécutable (une seule fois) :
   ```bash
   chmod +x scripts/apply-staging-migrations.sh
   ```

3. Exécutez le script :
   ```bash
   ./scripts/apply-staging-migrations.sh
   ```

4. Le script va :
   - Vérifier votre authentification Supabase
   - Vérifier que le projet cible est bien `yocufscgninxiihwiepa` (staging)
   - Vérifier la présence des 8 fichiers de migration
   - Demander votre confirmation avant d'appliquer
   - Appliquer chaque migration une par une, dans l'ordre
   - Afficher le résultat de chaque migration

5. **Après l'application**, exécutez le script de vérification :
   ```bash
   ./scripts/verify-staging-migrations.sh
   ```

   Ce script vérifiera que toutes les migrations ont été appliquées et que les fonctions RPC sont disponibles.

---

## 3. TESTS E2E (APRÈS APPLICATION DES MIGRATIONS)

Une fois les migrations appliquées, vous pouvez tester le parcours complet de création d'abonné :

1. Ouvrez l'application Super Admin
2. Allez dans "Nouvel abonné"
3. Remplissez le formulaire (établissement, Manager, abonnement, modules, invitations)
4. Validez la création
5. Vérifiez que l'établissement, le Manager, l'abonnement et l'invitation sont créés
6. Le Manager reçoit son invitation
7. Le Manager clique sur le lien d'activation
8. Le Manager définit son mot de passe
9. Le Manager se connecte
10. Le Manager accède uniquement à son établissement

---

## 6. EN CAS D'ÉCHEC

Si une migration échoue :

1. L'application s'arrête automatiquement
2. Notez le message d'erreur
3. Ne réappliquez pas la migration qui a échoué sans comprendre la cause
4. Contactez le support avec le message d'erreur complet

---

## 7. ANNULATION (ROLLBACK)

En cas de problème majeur après application des migrations :

```bash
# Restaurer depuis la sauvegarde PITR prise avant l'application
# Consultez la documentation Supabase pour la procédure de restauration
```

**AUCUNE MODIFICATION DE PRODUCTION.** Ce script ne doit être exécuté QUE sur le projet staging `yocufscgninxiihwiepa`.

---

## 8. CONTACT

En cas de problème, contactez le propriétaire du projet avec le message d'erreur complet.

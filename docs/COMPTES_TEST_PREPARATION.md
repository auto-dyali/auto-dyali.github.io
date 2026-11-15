# AUTO DYALI — Préparation et vérification des comptes de test (P0)

> **Usage interne — livraison demain matin.** Ce document ne contient **aucun mot de passe**.
> Les mots de passe temporaires figurent uniquement dans la fiche confidentielle (fichier LOCAL, jamais commité sur GitHub).

## Contexte
L'environnement d'exécution courant n'a **aucun accès à Supabase** (pas de credentials privilégiés, pas de CLI, réseau vers github.com/supabase.co bloqué). Aucun compte Auth ni aucune donnée n'a donc pu être créé ou testé réellement ici. Ce document prépare tout le nécessaire pour que les comptes soient créés, vérifiés et remis aux testeurs dès qu'un accès Supabase est disponible.

## Comptes de test à créer (domaine @autodyali.test = données de test identifiées)

| # | Compte | Email | Rôle | Établissement | Modules accessibles | Espace après connexion |
|---|--------|-------|------|---------------|---------------------|------------------------|
| 1 | SAAS_ADMIN | admin.saas@autodyali.test | saas_admin | — (plateforme) | Tous (portail Super Admin) | /super-admin/ |
| 2 | MANAGER_GARAGE_1 | manager.garage1@autodyali.test | manager | Garage 1 | Tableau de bord complet Garage 1 | /tableau-de-bord/ |
| 3 | MANAGER_GARAGE_2 | manager.garage2@autodyali.test | manager | Garage 2 | Tableau de bord complet Garage 2 | /tableau-de-bord/ |
| 4 | EMPLOYEE_CAISSE | caisse.garage1@autodyali.test | employee | Garage 1 | Point de vente + Caisse | /employe/ |
| 5 | EMPLOYEE_STOCK | stock.garage1@autodyali.test | employee | Garage 1 | Stock uniquement | /employe/ |
| 6 | EMPLOYEE_CAISSE_STOCK | caisse-stock.garage1@autodyali.test | employee | Garage 1 | Point de vente + Caisse + Stock | /employe/ |

> Les mots de passe temporaires (uniques, sécurisés, renouvelables) sont dans la fiche confidentielle séparée. Chaque compte doit avoir un mot de passe différent.

## Ordre d'exécution (dès accès Supabase disponible)

### Étape A — Créer les 6 comptes Auth
Via **Supabase Dashboard → Authentication → Users** (ou `auth.admin.createUser` côté serveur avec la clé service_role, jamais exposée) :
- Créer chaque utilisateur avec son email et son mot de passe temporaire.
- Ne **pas** cocher "email confirm" si vous voulez tester l'activation, ou cocher si vous voulez un accès immédiat. Préciser dans la fiche.

### Étape B — Appliquer le script de préparation
Exécuter `supabase/00_test_comptes_preparation.sql` dans l'éditeur SQL Supabase (service role). Il crée (idempotent, non destructif) :
- 2 établissements de test (Garage 1, Garage 2)
- 6 profils liés aux comptes Auth (rôle + establishment_id)
- 6 fiches employés
- Les permissions modules (caisse/stock) pour les employés

### Étape C — Vérifier chaque compte (procédure ci-dessous)

## Procédure de vérification par compte (à réaliser réellement)

Pour chaque compte, effectuer et **consigner le résultat réel** :

1. **Authentification réelle** : se connecter sur l'URL de connexion avec l'email + mot de passe temporaire. Vérifier que la session est créée (pas d'erreur "Identifiants incorrects").
2. **Redirection vers le bon espace** :
   - saas_admin → `/super-admin/`
   - manager → `/tableau-de-bord/`
   - employee → `/employe/`
3. **Rôle et permissions corrects** : le rôle affiché correspond au compte attendu ; les modules du sidebar correspondent aux droits (ex. EMPLOYEE_STOCK ne voit pas Caisse).
4. **Modules accessibles conformément aux droits** : ouvrir chaque module autorisé, vérifier qu'il se charge sans erreur de droits.
5. **Opérations interdites effectivement refusées** :
   - EMPLOYEE_CAISSE ne doit pas accéder au module Stock.
   - EMPLOYEE_STOCK ne doit pas accéder au module Caisse / Point de vente.
   - Un manager de Garage 1 ne doit pas voir les données de Garage 2 (isolation inter-tenant).
   - Un employee ne doit pas accéder à `/super-admin/` (refus).
6. **Isolation entre les deux garages** : connecter MANAGER_GARAGE_1, noter les clients/produits/ventes de Garage 1 ; se déconnecter, connecter MANAGER_GARAGE_2, confirmer qu'aucune donnée de Garage 1 n'est visible.
7. **Déconnexion et reconnexion** : se déconnecter, puis se reconnecter avec les mêmes identifiants, vérifier que l'accès est rétabli.

## Données de démonstration (test, clairement identifiées)
À créer dans chaque établissement (ne jamais toucher aux données réelles existantes) :
- Quelques clients (nom, téléphone, véhicule)
- Quelques produits avec stock (référence, quantité, prix)
- Quelques ventes / opérations pour faire vivre les démonstrations
- Quelques interventions d'atelier si le module est activé

Toutes ces données doivent être créées sous l'établissement correspondant (establishment_id) pour garantir l'isolation.

## Fiche confidentielle à remettre aux testeurs (demain matin)
Contenu à préparer (fichier LOCAL, **non commité**) :
- URL de connexion (à confirmer une fois le site déployé)
- Pour chaque compte : rôle, email, mot de passe temporaire, modules accessibles, résultat du test de connexion (rempli après Étape C), limitations connues

## Rappel des règles absolues
- Aucun compte ne doit être déclaré prêt si sa connexion et ses permissions n'ont pas été testées réellement.
- Aucun mot de passe en clair dans GitHub, les logs ou le registre public.
- Aucun paiement déclaré confirmé sans preuve fournisseur.
- Aucune donnée réelle existante modifiée ni supprimée.
- En cas de blocage (accès Supabase indisponible), continuer le travail indépendant et préparer précisément l'étape bloquée pour reprise directe.

## Fichiers associés
- `supabase/00_test_comptes_preparation.sql` — script SQL idempotent (établissements, profils, employés, permissions) ; ne contient pas de mots de passe.
- `GV5_SUIVI_AUTO_DYALI.md` — registre maître (append-only), à mettre à jour avec les résultats réels des tests.

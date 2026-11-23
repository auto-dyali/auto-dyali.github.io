# MATRICE DE TESTS E2E — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf`

---

## CONDITION PRÉALABLE

Aucun test E2E n'a été exécuté sur staging pendant GV5 §94 car les migrations 0036→0043 ne sont pas appliquées sur staging et `.env.local` pointe sur Production (lecture seule). L'exécution des tests E2E nécessite une autorisation propriétaire pour basculer l'environnement et appliquer les migrations.

---

## SCÉNARIOS DE TESTS E2E OBLIGATOIRES (Après autorisation)

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|
| T1 | Création d'un établissement | Saisir nom, raison sociale, slug, identifiant professionnel, adresse, ville, région, pays | Établissement créé, `professional_id` enregistré | 0 % (bloqué) |
| T2 | Création du Manager | Saisir prénom, nom, email, téléphone, login_id, mot de passe temporaire | Compte Auth créé, profil associé, rôle `manager` | 0 % (bloqué) |
| T3 | Vérification Auth + profil | Vérifier `auth.users` et `profiles` | Utilisateur existe, profil lié à l'établissement | 0 % (bloqué) |
| T4 | Vérification rôle Manager | Vérifier `profiles.role` | Rôle = `manager` | 0 % (bloqué) |
| T5 | Vérification association établissement | Vérifier `profiles.establishment_id` | ID correspond à l'établissement créé | 0 % (bloqué) |
| T6 | Création abonnement GOLD | Sélectionner plan GOLD, durée payante, date de début | Abonnement créé, statut `trial` ou `active` | 0 % (bloqué) |
| T7 | Vérification durée payante et essai indépendant | Vérifier dates de début/fin d'essai et de facturation | Essai ne réduit pas la durée payante | 0 % (bloqué) |
| T8 | Vérification modules et permissions | Vérifier `permissions` et `plan_features` | Modules du forfait attribués, permissions cohérentes | 0 % (bloqué) |
| T9 | Création d'invitation | Générer invitation, sélectionner canaux email et/ou WhatsApp | Invitation créée, statut `prepared`, token hash stocké | 0 % (bloqué) |
| T10 | Vérification statut de livraison | Vérifier `email_status`, `whatsapp_status` | `non_configure` si fournisseurs absents (pas de faux envoi) | 0 % (bloqué) |
| T11 | Activation Manager | Cliquer lien d'activation, définir mot de passe | Mot de passe défini, invitation consommée, `must_change_password` = false | 0 % (bloqué) |
| T12 | Première connexion Manager | Se connecter avec email + nouveau mot de passe | `signInWithPassword` réussi, session valide | 0 % (bloqué) |
| T13 | Vérification isolation multi-tenant | Se connecter comme Manager A, essayer d'accéder à l'établissement B | RLS isole, accès refusé | 0 % (bloqué) |
| T14 | Modification de l'établissement | Modifier nom, adresse, téléphone via fiche en mode édition | Sauvegarde RPC réussie, persistance après rechargement | 0 % (bloqué) |
| T15 | Modification de l'abonnement | Changer de plan, modifier durée | Sauvegarde réussie, dates mises à jour | 0 % (bloqué) |
| T16 | Suspension et réactivation | Basculer `is_active` | Statut bascule correctement, journalisé | 0 % (bloqué) |
| T17 | Archivage et restauration | Archiver puis restaurer | `archived_at` bascule, filtre « Archivés » fonctionne | 0 % (bloqué) |
| T18 | Suppression contrôlée | Supprimer un établissement synthétique archivé sans données métier | Succès si éligible, refus si données métier, audit conservé | 0 % (bloqué) |
| T19 | Vérification journal d'audit | Vérifier `audit_log` | Entrées `onboard_tenant_v2`, `archive`, `restore`, `password_changed` | 0 % (bloqué) |
| T20 | Test de doublon (identifiant pro) | Essayer de recréer avec même `professional_id` | Erreur 409 explicite, pas de doublon | 0 % (bloqué) |
| T21 | Test de doublon (email) | Essayer avec même email Manager | Erreur 409 explicite | 0 % (bloqué) |
| T22 | Test de double-clic | Soumettre le formulaire deux fois rapidement | Idempotence par `requestId`, pas de création en double | 0 % (bloqué) |
| T23 | Test d'interruption réseau | Interrompre pendant la création | Vente/onboarding en file offline, pas d'écriture partielle | 0 % (bloqué) |
| T24 | Test d'échec d'invitation | Échec d'envoi d'un canal | Erreur explicite, état récupérable, autre canal intact | 0 % (bloqué) |
| T25 | Test d'absence de Resend | Créer invitation avec canal email seulement | Statut `non_configure`, création durable malgré tout | 0 % (bloqué) |
| T26 | Test d'absence de WhatsApp | Créer invitation avec canal WhatsApp seulement | Statut `non_configure`, création durable malgré tout | 0 % (bloqué) |

---

## TESTS GÉOGRAPHIE MAROC (Exécutés localement, 18/18)

| # | Test | Résultat |
|---|---|---|
| G1 | Normalisation : casse ignorée | ✅ Pass |
| G2 | Normalisation : accents supprimés | ✅ Pass |
| G3 | Normalisation : espaces multiples et tirets | ✅ Pass |
| G4 | Normalisation : apostrophes et caractères spéciaux | ✅ Pass |
| G5 | 12 régions présentes | ✅ Pass |
| G6 | Chaque région a un nomNormalise cohérent | ✅ Pass |
| G7 | Pas de doublon de villes | ✅ Pass |
| G8 | Chaque ville a un nomNormalise cohérent | ✅ Pass |
| G9 | Recherche ville : correspondance exacte | ✅ Pass |
| G10 | Recherche ville : villes composées (Béni Mellal, El Kelaa des Sraghna, Aït Melloul, Al Hoceïma, Sidi Slimane, Oued Ed-Dahab) | ✅ Pass |
| G11 | Recherche ville : absente du référentiel | ✅ Pass |
| G12 | Recherche partielle : avec requête | ✅ Pass |
| G13 | Recherche partielle : filtrée par région | ✅ Pass |
| G14 | Recherche partielle : requête vide + région | ✅ Pass |
| G15 | Résolution région ←→ ville | ✅ Pass |
| G16 | villesParRegion | ✅ Pass |
| G17 | Pays par défaut | ✅ Pass |
| G18 | Pas de doublon de nom de région | ✅ Pass |

---

## DISTINCTION IMPORTANTE

Les tests unitaires réussis (176/176 dont 18 de géographie) ne constituent PAS une preuve E2E. Un test E2E nécessite une base de données avec les migrations 0036→0039 appliquées et un environnement Supabase fonctionnel.

# AUTO DYALI — ACTIONS DE LA PROPRIÉTAIRE AVANT LE PREMIER CLIENT

**Version** : 9 novembre 2026 · **Référence technique** : `VALIDATION_FINALE_PREMIER_CLIENT.md`  
**Production vérifiée** : Actions `12b20cf` success, Dashboard 200, Point de Vente 200.  
**Verdict honnête** : **NON PRÊT** pour le premier client tant que les actions ci-dessous ne sont pas faites.  
Ce document ne modifie aucun code, aucune donnée, aucune migration et aucun design.

Légende : ✅ vérifié · 🧪 testé en local uniquement · ⏳ attend ton intervention · ❌ non testé.

---

## 1. Actions classées par priorité

### Priorité 1 — bloquantes (sans elles, ne pas ouvrir au premier client)
1. Exécuter la migration `0025` (voir §2).
2. Configurer les clés Supabase de production et tester un compte réel.
3. Créer 2 entreprises de test et vérifier l’isolation (voir §3).
4. Exécuter le test métier complet (voir §4).
5. Tester le matériel réel (voir §5).

### Priorité 2 — importantes
6. Configurer WhatsApp Business côté serveur (voir §5).
7. Parcours PC/tablette/smartphone + Lighthouse en production (voir §6).

### Priorité 3 — avant scale-up
8. Vérifier le coût historique des marchandises avant d’afficher toute marge.

---

## 2. Migration Supabase `0025` (procédure détaillée)

**Pourquoi ton intervention est nécessaire** : l’agent ne peut pas exécuter les migrations à ta place (accès SQL Editor réservé à la propriétaire). La migration est **non destructive** : elle ajoute une valeur d’enum, une colonne et une fonction. Aucune donnée n’est supprimée.

1. **Vérifier le projet concerné** : ouvre le Dashboard Supabase et contrôle que le projet ouvert est bien celui d’AUTO DYALI (URL du projet dans Réglages → Général).
2. **Sauvegarde préalable** : dans Supabase → Database → Backups, vérifie qu’une sauvegarde récente existe (ou lance une sauvegarde manuelle selon ton plan).
3. **Ouvrir le SQL Editor** : Database → SQL Editor → New query.
4. **Coller le contenu** de `supabase/migrations/0025_pos_core.sql` (fichier dans le dépôt, branche `main`).
5. **Exécuter** (Run). La migration est conçue pour être rejouée sans erreur (`IF NOT EXISTS`, `CREATE OR REPLACE`).
6. **Vérifier** :
   - la fonction `public.create_pos_sale_v2` apparaît dans Database → Functions ;
   - l’enum `payment_method` contient la valeur `avoir` ;
   - la colonne `clients.consents` existe (Table Editor → clients).
7. **En cas d’erreur** : ne rien effacer. Copie le message d’erreur et arrête-toi avant de continuer. Le fichier contient un bloc de retour arrière commenté en fin de fichier.

**Résultat attendu** : les 3 vérifications ci-dessus sont vertes, sans erreur.  
**Preuves à conserver** : capture ou copier le résultat d’exécution + la liste des fonctions.

---

## 3. Tests des comptes et de la sécurité

**Pourquoi ton intervention est nécessaire** : la création d’entreprises et d’utilisateurs modifie les données réelles ; elle doit se faire avec ton compte Super Admin.

### Comptes de test nécessaires
- 1 compte Super Admin (le tien).
- 1 entreprise de test **A** + 1 utilisateur (manager).
- 1 entreprise de test **B** + 1 utilisateur (manager).
- 1 employé dans A avec permissions limitées (sans remise, sans crédit).

### Scénarios et résultats attendus
1. **Super Admin** : connexion → entreprises → créer A et B → utilisateurs → abonnements/plans → statistiques. Attendu : tout fonctionne, journal d’audit mis à jour.
2. **Isolation** : connecté en A, vérifier que clients, ventes, stock, factures de B sont **invisibles**. Puis l’inverse. Attendu : aucune donnée de l’autre entreprise visible.
3. **Employé limité** : tenter une remise et une vente à crédit. Attendu : **refus côté serveur** (et pas seulement un bouton masqué).
4. **Accès interdit** : taper l’URL d’un module d’une autre entreprise. Attendu : accès refusé.

**Preuves à conserver** : captures des refus et des listes vides (isolation).

---

## 4. Test métier complet (checklist dans l’ordre)

Coche chaque étape et note le résultat (OK / KO + capture) :

1. [ ] Connexion avec le compte manager — Dashboard avec 8 KPI réels.
2. [ ] Ouverture de caisse (fonds initial, responsable).
3. [ ] Création d’une vente (Mini-POS puis POS complet : le panier doit être le même).
4. [ ] Paiement et monnaie (espèces + carte, monnaie rendue, chèque/virement, crédit, avoir).
5. [ ] Facture (numéro unique, TVA, remises, modes de paiement).
6. [ ] Vérification du stock (décrémentation, mouvements).
7. [ ] Achat fournisseur (commande).
8. [ ] Réception (quantités, mise à jour du stock, dette fournisseur).
9. [ ] Intervention atelier (réception véhicule, diagnostic, pièces, main-d’œuvre, contrôle qualité, facture, paiement).
10. [ ] Clôture de caisse (comptage, écarts, rapports, historique).
11. [ ] Vérification des rapports financiers (CA, dépenses, résultat intermédiaire — jamais présenté comme bénéfice net).

**Résultats attendus** : aucune écriture partielle, aucune vente en double, aucun paiement en attente compté comme encaissé, aucune vente « payée » avec solde restant.

---

## 5. Matériel et intégrations (tests réels)

### TPE
- Faire une transaction carte réelle. Attendu : référence TPE enregistrée, confirmation réelle, vente marquée payée **uniquement** après confirmation.

### Imprimante thermique
- Imprimer un ticket (ESC/POS), réimprimer, vérifier le numéro unique et la TVA. Attendu : impression nette, réimpression tracée.

### Douchette HID (USB/Bluetooth)
- Scanner un produit sans cliquer dans un champ. Attendu : produit ajouté au panier (un seul écouteur — pas de double ajout).

### Caméra (smartphone)
- Scanner un code EAN/QR. Attendu : produit trouvé et ajouté.

### WhatsApp Business et webhook
- Pourquoi ton intervention est nécessaire : le jeton Business et le webhook doivent vivre **côté serveur**, jamais dans le navigateur (vérifié : aucun jeton exposé dans le code).
- Où aller : ton fournisseur WhatsApp Business (Meta) + ton hébergeur serveur/webhook.
- Opération : créer l’application Business, connecter le numéro, générer le jeton, brancher le webhook d’envoi/accusés.
- Résultat attendu : un message de test (ex. facture ou rappel) reçu sur un vrai numéro, avec accusé du fournisseur, historique `envoyé/livré/échec`.
- Précautions : ne jamais mettre le jeton dans le frontend ; vérifier les consentements service/marketing avant tout envoi marketing.

---

## 6. Performances (Lighthouse et écrans)

- **Où aller** : ouvre `https://auto-dyali.github.io` (et `/tableau-de-bord`, `/tableau-de-bord/point-de-vente`) dans Chrome, puis DevTools → Lighthouse → Generate report.
- **Résultats attendus** : scores performance/accessibilité corrects, zéro erreur console bloquante.
- **Smartphone/tablette/PC** : teste le POS en tactile (cibles ≥ 48px), la navigation basse smartphone, le Mini-POS et le panier. Sur smartphone, les boutons de paiement et le mode de paiement sont fixes en bas de page.
- **Preuves à conserver** : exports Lighthouse + captures des 3 écrans.

---

## 7. État de vérification (distinction obligatoire)

**Déjà vérifié** ✅
- Moteur POS (40 tests), Scan Pro (21), Print Pro (24), finance/catalogue (4) : verts.
- Rendu Dashboard et POS en navigateur avec session de test (non bloqué, éléments présents).
- Panier partagé Mini-POS → POS complet (vérifié après purge du cache Service Worker).
- Version en production : Actions success, Dashboard/POS 200, chunk POS présent.

**Testé en local uniquement** 🧪
- Interactions avec session de test factice (401 attendus, aucune donnée réelle touchée).
- Catalogue de démo marqué « démo » quand la base est injoignable.

**Attend ton intervention** ⏳
- Migration `0025`, clés Supabase, comptes Super Admin / 2 entreprises / employé limité.
- Scénario métier complet en base, matériel réel, WhatsApp serveur, Lighthouse/écrans réels.

**Totalement non testé** ❌
- Opérations réelles en base (ventes, stock, caisse, factures, WhatsApp).
- Tests RLS par rôle et isolation inter-garages en base.
- Matériel physique (TPE, imprimante, douchette, caméra).

---

## 8. Checklist finale (cases à cocher)

1. [ ] Migration `0025` exécutée et vérifiée (`create_pos_sale_v2`, enum `avoir`, `clients.consents`).
2. [ ] Clés de production configurées, compte Super Admin testé (entreprises, utilisateurs, abonnements, rôles, statistiques).
3. [ ] Deux entreprises de test isolées (RLS) — vérifié dans les deux sens.
4. [ ] Employé limité refusé côté serveur (remise/crédit).
5. [ ] Scénario métier complet exécuté (11 étapes du §4) — tout OK.
6. [ ] TPE, imprimante, douchette et caméra testés avec le matériel réel — tout OK.
7. [ ] WhatsApp Business réel (envoi confirmé, consentements, historique).
8. [ ] Parcours PC/tablette/smartphone + Lighthouse en production — satisfaisants.
9. [ ] Coût historique des marchandises vérifié avant toute marge affichée.
10. [ ] Validation humaine explicite pour autoriser le premier client.

---

## Verdict

**NON PRÊT** pour le premier client tant que les points 1 à 10 ci-dessus ne sont pas cochés et prouvés.  
Lorsque tout est coché, remplacer ce verdict par **PRÊT** avec la date et les preuves conservées.

*Ce document ne modifie aucun code, aucune donnée et aucune migration. Il ne déclare rien de plus que ce qui est prouvé.*

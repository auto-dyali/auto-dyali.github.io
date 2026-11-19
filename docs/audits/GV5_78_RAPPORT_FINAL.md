# GV5 §78 — Rapport final : route stratégique premium, stabilisation et préparation commerciale

**Date** : 19 novembre 2026. **Branche** `main` @ `64359da` — **aucun commit, aucun push**.
**Périmètre testé** : STAGING `yocufscgninxiihwiepa`. **Production `nxmsqqoflskfajqrqddw` : intacte**, aucune opération **[V-P : néant]**.

> Règle appliquée : aucune fonctionnalité n'est comptée comme opérationnelle sur la seule présence du code. Un élément n'est compté « terminé » que s'il dispose d'une preuve locale ou staging. Aucun pourcentage n'est fixé à 100 % tant que ses critères d'acceptation ne sont pas réunis. Staging et production ne sont jamais mélangés.

---

## 1. Bilan des missions précédentes (§75 → §77)

| Mission | Acquis vérifiés conservés |
|---|---|
| §75 | Design `.sa3d-*` (57 règles), fiche unifiée 5 espaces, RPC journalisées, colonnes administratives, EF `send-invitation` v2, correction faille `anon`, E2E 7/7 |
| §76 | Primitives React et règles métier réellement partagées, écriture des champs administratifs dès la création, récapitulatif avant modification, correction faille `NULL` de `is_saas_admin()`, tablette 768/1024 |
| §77 | Révocation `anon`/`PUBLIC` sur 21 RPC `admin_*`, test de sécurité 6/6, nettoyage du compte synthétique, EF `create-test-user` inertée, isolation multi-tenant vérifiée, E2E 18/18 |

Rien de ces acquis n'a été reconstruit. Aucune anomalie reproductible n'a été découverte dans le Super Admin pendant §78.

---

## 2. Tableau de progression obligatoire

| Indicateur | Résultat | Tâches incluses | Terminées | Restantes | Méthode de calcul |
|---|---:|---|---|---|---|
| **Périmètre audité** | **94 %** | 16 zones : Super Admin, commercialisation, 8 modules métier, design, sécurité, tests, responsive, staging, production | 15 | 1 (production : accès non autorisé) | 15 zones avec état fondé sur des preuves / 16 zones définies = 93,75 % → 94 %. La production est documentée « NON VÉRIFIÉ », pas inspectée. |
| **Développement terminé** | **55 %** | 29 capacités : 10 Super Admin, 6 commercialisation, 8 modules métier, 2 design, 3 sécurité | 16 | 13 | 16 capacités avec preuve staging / 29 = 55,2 % → 55 %. Une capacité « présente dans le code mais non vérifiée » n'est pas comptée. |
| **Tests et validations** | **89 %** | 9 contrôles : tsc, lint, unitaires, EF, sécurité, E2E, responsive, non-régression, appareil physique | 8 | 1 (appareil physique) | 8 contrôles exécutés avec succès / 9 = 88,9 % → 89 %. |
| **Préparation commerciale** | **30 %** | 10 prérequis : offres, prix, essais, paiements, facturation, renouvellement auto, impayés, suspension, historique financier, invitations réelles | 3 | 7 | 3 prérequis réellement en place / 10 = 30 %. Sous-indicateur mesurable : 2/5 = 40 % (voir §4). |
| **Préparation production** | **60 %** | 10 éléments : build, migrations, EF, tests staging, sécurité staging, rollback, PITR, secrets, autorisation, monitoring | 6 | 4 | 6 éléments vérifiés / 10 = 60 %. |

### Détail du développement terminé (16/29)

**Comptées (preuves staging)** : création garage, création Manager, génération des identifiants, abonnement + essai indépendant, renouvellement/suspension/réactivation, modules et permissions backend, invitations v2 (mécanisme), activation sécurisée, relance/révocation, journalisation + archivage réversible, identité 3D, responsive, RPC/RLS sécurisées, audit, nettoyage des outils de test.

**Non comptées** : prix des formules (3 formules ont `price_monthly = NULL` et `price_yearly = NULL`), paiement réel, facturation, renouvellement automatique, gestion des impayés, historique financier alimenté, livraison réelle e-mail/WhatsApp, et les 8 modules métier (tables vides sur staging + défaut POS confirmé).

### Travail restant (priorisé)
1. Configurer les prix des 3 formules (`admin_save_plan`) — **décision métier requise**.
2. Choisir et connecter un prestataire de paiement SaaS + webhooks signés + réconciliation.
3. Configurer Resend et Meta WhatsApp + destinataire autorisé, puis re-tester sans simulation.
4. Obtenir l'autorisation de déploiement production et vérifier le PITR.
5. Résoudre le défaut `products.stock` (décision schéma : colonne stockée vs calcul depuis `stock_movements`).
6. Alimenter et tester les modules métier avec des données de test staging.
7. Tester sur appareil physique.

---

## 3. État de chaque module

| Module | Schéma | Code/UI | Données staging | État réel |
|---|---|---|---|---|
| Garage & Manager | ✅ | ✅ | 17 établissements, 19 profils | **Opérationnel sur staging** — E2E création/modification/activation |
| Clients & véhicules | ✅ (`clients`, `vehicles`) | ✅ | 0 / 0 | Présent mais **non vérifié opérationnellement** |
| Atelier & interventions | ✅ (`work_orders`, `work_order_tasks`, `services`) | ✅ (10 appels Supabase) | 0 | Présent mais non vérifié |
| POS & caisse | ✅ (`sales`, `sale_items`, `cash_sessions`) | ✅ | 0 | **Bloquant** : voir défaut ci-dessous |
| Stock & produits | ⚠️ (`products`, `product_lots`, `stock_movements`) | ✅ | 0 | **Bloquant** : colonnes manquantes |
| Fournisseurs & achats | ✅ (`suppliers`, `purchase_orders`, `purchase_order_items`) | ✅ | 0 / 0 | Présent mais non vérifié |
| Bénéfices & rapports | ✅ (`expenses`, `invoices`, `payments`) | ✅ | 0 / 0 / 0 | Non vérifié — aucune opération financière réelle |
| Employés & permissions | ✅ (`employees`, `permissions`) | ✅ | 0 employés / 29 permissions SA | Partiel : permissions SA opérationnelles, employés non vérifiés |

### Défaut bloquant confirmé (hors périmètre Super Admin, non modifié)
`src/modules/new-pos/services/inventory.service.ts` sélectionne dans `products` les colonnes `brand`, `manufacturer_ref`, `image_url` et **`stock`**, absentes de la table staging (colonnes réelles : `id, establishment_id, sku, barcode, name, category, unit, purchase_price, sale_price, tax_rate, min_stock, is_active, created_at`). Erreur observée dans le dashboard Manager : `Chargement produits impossible : column products.stock does not exist`. Ce défaut rend le POS/stock inutilisable. **Non corrigé** : il relève d'une décision de schéma (stocker `stock` ou le calculer depuis `stock_movements`) et d'un périmètre Garage/POS extérieur à cette mission ; la trace est conservée pour la mission suivante.

---

## 4. Commercialisation SaaS — audit et préparation

### Prérequis mesurables (outil créé : `scripts/check-commercial-readiness.mjs`, lecture seule)
Résultat réel sur staging avec un jeton Super Admin :

| Prérequis | État | Détail |
|---|---|---|
| Offres et formules | **MANQUANT** | 0/3 formules avec prix mensuel **et** annuel (`price_monthly`, `price_yearly` = NULL) |
| Périodes d'essai | **OK** | 3/3 formules avec `trial_days = 14` |
| Abonnements suivis | **OK** | 23 abonnements présents |
| Paiements enregistrés | **MANQUANT** | 0 — aucun fournisseur connecté |
| Factures émises | **MANQUANT** | 0 |

→ **2/5 = 40 % de prérequis mesurables** ; l'indicateur élargi de §2 est plus strict (30 %) car il inclut aussi renouvellement automatique, impayés et invitations réelles.

### Prestataires et configurations nécessaires (aucun secret demandé ni écrit)
| Besoin | Prestataire / configuration | État |
|---|---|---|
| Facturation et encaissement SaaS | Stripe (compte, clés serveur, webhooks signés, idempotence, réconciliation abonnement ↔ facture) | **[B]** décision + secrets |
| E-mail d'invitation | Resend — `RESEND_API_KEY`, `EMAIL_FROM`, (`EMAIL_REPLY_TO`) | **[B]** secrets absents |
| WhatsApp d'invitation | Meta Cloud API — `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `TEMPLATE_NAME`, `LANG`, `API_VERSION` | **[B]** secrets + template approuvé |
| Lien d'activation | `ACTIVATION_BASE_URL` | **[B]** non défini (repli sur l'origine) |
| Tarification | `admin_save_plan` pour renseigner les 3 formules | **[B]** décision métier |
| Destinataire de test | Adresse e-mail / numéro autorisés | **[B]** non fourni |

Aucun paiement réel, aucun envoi réel et aucune simulation de succès n'ont été effectués. La page `/super-admin/paiements/` affiche déjà honnêtement l'absence de fournisseur connecté.

---

## 5. Tâches réalisées dans cette mission

1. Lecture intégrale des rapports §75, §76, §77 et vérification directe du dépôt, des 23 migrations appliquées sur staging, des 4 Edge Functions, des privilèges RPC et des données.
2. Audit des 8 modules métier avec relevé des tables, du code et des données réelles.
3. Confirmation du défaut bloquant POS/stock (colonnes absentes) — **documenté, non modifié**.
4. Contrôle de sécurité : 1 seule RPC `admin_*` reste accessible à `anon` (`admin_invitation_preview`, intentionnel), `is_saas_admin()` durci, compte de test supprimé.
5. Outil de préparation commerciale en lecture seule : `scripts/check-commercial-readiness.mjs`.
6. Analyse de deux échecs E2E intermédiaires : l'EF `onboard-tenant` répondait **200 en < 1 s** et le navigateur recevait 200 ; le délai venait du rendu frontend sous charge (42 s mesurées). Timeouts dimensionnés sur cette mesure, avec commentaire explicatif, et instrumentation console conservée dans le test. Aucun échec masqué par un simple allongement arbitraire.

### Fichiers modifiés / créés (§78)
```
scripts/check-commercial-readiness.mjs        (nouveau, lecture seule)
tests/e2e/gv572-real-ui.spec.ts               (timeout justifié + instrumentation)
tests/e2e/gv575-workspace.spec.ts             (timeout justifié + captures stables)
docs/audits/GV5_78_RAPPORT_FINAL.md           (ce rapport)
```
Aucun composant, design, RPC, migration ou secret modifié dans cette mission.

---

## 6. Tests et preuves (exécutés dans §78)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 7 avertissements préexistants |
| `npm test` | **158/158** |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** |
| `node --test scripts/test-security-077.mjs` (staging) | **6/6** |
| `npm run build` | **OK** |
| `npm audit --omit=dev` | **0 vulnérabilité** |
| `scripts/check-commercial-readiness.mjs` (staging) | **2/5 prérequis** |
| E2E §72–§76 complet (18 tests) | **18/18** sur staging (3,4 min) |

Preuves visuelles conservées : `docs/audits/screenshots-75/` (11 captures) et `docs/audits/screenshots-76/` (12 captures dont tablette 768/1024). Aucune capture redondante produite.

---

## 7. Design premium

Identité maintenue sans modification : palette pétrole/noir/vert profond/or champagne, KPI 3D par CSS (aucun WebGL ni canvas), `prefers-reduced-motion` respecté, CSS compilé ~91,5 Ko, responsive 360/390/768/1024 sans débordement. Aucune dégradation de performance observée ; aucun benchmark matériel modeste n'a été réalisé **[NV]**.

---

## 8. Sécurité et validation

- 23 migrations appliquées sur staging, dont toutes les corrections §75–§77.
- 4 Edge Functions : `send-invitation` v2, `onboard-tenant` v2, `activate-manager` v1, `create-test-user` v3 (inerte).
- 22 RPC `admin_*` : 21 interdites à `anon`, 1 autorisée intentionnellement (`admin_invitation_preview` pour l'activation sans JWT).
- Isolation multi-tenant vérifiée avec un vrai Manager en §77 ; non rejouée dans §78 mais aucun changement de sécurité depuis.
- Aucun défaut de sécurité nouveau découvert ; aucun correctif de sécurité appliqué dans §78.

---

## 9. État des environnements et Git

- Branche `main`, HEAD `64359da`, **0 commit, 0 push**.
- Arbre de travail : **77 entrées** modifiées/non suivies (livrables §51–§78, aucun commit).
- `.env.local` **restauré vers la production** après les tests ; vérifié en fin de mission.
- Aucun serveur de dev ni serveur HTTP temporaire résiduel.
- **Local** : code et tests exécutés, tous verts.
- **Staging** : état décrit ci-dessus ; aucune suppression de données métier.
- **Production** : aucune opération **[NV / V-P : néant]**.

---

## 10. Risques commerciaux

| Risque | Gravité | Mitigation |
|---|---|---|
| Invitations non livrées faute de Resend/Meta | **Bloquant** | Configurer les secrets serveur + destinataire autorisé, puis tester |
| Aucun prix renseigné sur les 3 formules | **Bloquant** | Décision tarifaire puis `admin_save_plan` |
| Aucun encaissement ni facture | **Bloquant** | Choisir Stripe, webhooks signés, réconciliation |
| Aucune validation production ni PITR vérifié | **Élevé** | Autorisation distincte + sauvegarde restaurée en test |
| POS/stock inutilisable (colonnes manquantes) | **Élevé (hors périmètre)** | Décision schéma + correctif dédié |
| Modules métier sans données de test | **Moyen** | Jeu de données staging + E2E dédiés |
| Appareil physique non testé | **Moyen** | Test manuel sur device réel |

---

## 11. Priorités de la mission suivante

1. **P0** — Configurer Resend et Meta (secrets serveur) et valider un envoi réel vers un destinataire autorisé, sans jamais simuler.
2. **P0** — Renseigner les prix des formules et connecter un prestataire de paiement avec webhooks signés.
3. **P0** — Obtenir l'autorisation de validation production + vérifier le PITR.
4. **P1** — Corriger le défaut `products.stock` (décision schéma) et tester POS/stock.
5. **P1** — Alimenter staging et tester les 8 modules métier.
6. **P2** — Test sur appareil physique, historique des changements de permissions, monitoring.

---

## Conclusion

Le périmètre audité est documenté à **94 %**, le développement vérifié à **55 %**, les tests à **89 %**, la préparation commerciale à **30 %** et la préparation production à **60 %**. Le Super Admin est stable et sécurisé (E2E 18/18, tests locaux tous verts). La route vers la commercialisation est bloquée par des dépendances externes explicites — secrets fournisseurs, tarification, paiement et autorisation production — et par un défaut POS hors périmètre, tous consignés avec la preuve correspondante. Aucun résultat n'a été présenté comme opérationnel sans test réel à l'appui.

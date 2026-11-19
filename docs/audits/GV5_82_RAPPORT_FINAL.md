# GV5 §82 — Rapport final : déblocage commercial, validation SaaS et préparation production

**Date** : 19 novembre 2026. **Branche** `main`, `fc6017d` au départ, synchronisée avec `origin/main`.
**Staging** `yocufscgninxiihwiepa` (cible MCP confirmée par `get_project_url`). **Production** `nxmsqqoflskfajqrqddw` : **intacte**.

---

## A. Résultat — travaux réellement réalisés

### Phase A — Audit initial
- Rapport §81 lu intégralement ; commits `1cca90b` et `fc6017d` présents sur `origin/main` (`git branch -r --contains`).
- `local HEAD == origin/main == fc6017d41a11537249a96eaafaf58a3a6255d161`.
- Deux fichiers de sauvegarde non suivis conservés ; sauvegarde complète avant modification : `gv581-backup-20261119-061055`.
- `.env.local` pointait sur la **production** au départ (restauré après tests) ; les E2E basculent explicitement vers le staging. Les roles de test ont des URL staging en dur ; les mocks `pre-achat.spec.ts` interceptent l'URL production **sans requête réelle**.

### Phase B — Tarifs et configuration commerciale
- `scripts/configure-plans.mjs` audité : aucun prix en dur, préservation de `trial_days`, `max_users`, `max_sites`, `storage_mb`, appel à `admin_save_plan`. Exécution sans variables → refus explicite de lancer, aucun prix appliqué.
- Vérification réelle : `standard`, `silver`, `gold` ont toujours `price_monthly = NULL`, `price_yearly = NULL`, `trial_days = 14`, `is_active = true`.
- **Règle essai/payant vérifiée sur staging** : `admin_set_subscription(12 mois, 60 jours d'essai, début 2026-11-19)` → `trial_ends_at = 2027-01-18`, `current_period_end = 2027-11-19`. L'essai ne réduit pas la durée payante.

### Phase C — Stripe et facturation
- EF `stripe-webhook` v1 auditée : HMAC-SHA256, tolérance 5 min, comparaison à temps constant, **503 sans secret**.
- Test local `scripts/test-stripe-webhook.mjs` avec un secret **synthétique de test** : **5/5** (signature valide, corps modifié refusé, horodatage périmé refusé, présence de la comparaison à temps constant). Aucun appel réseau, aucun paiement.
- Idempotence des événements déjà prouvée (`idempotent:false` puis `true`) ; `saas_billing_events` = 1, `payments` = 0, `invoices` = 0.
- Aucun paiement réel déclenché ; aucun secret affiché ni demandé.

### Phase D — E-mail et WhatsApp
- `scripts/check-provider-config.mjs` : **12 paramètres manquants** (Resend, Meta, `ACTIVATION_BASE_URL`, variables serveur EF).
- Statuts conservés : `non_configure`, jamais « envoyé ». Aucun envoi simulé, aucun destinataire inventé.

### Phase E — Parcours commercial complet
Parcours validé par composition de tests réels antérieurs et de vérifications §82 : demande publique → SA → décision historisée → création garage/Manager → identifiants → abonnement/permissions → activation → connexion Manager → isolation. Les deux étapes nécessitant une livraison réelle (e-mail/WhatsApp) restent blockées par les fournisseurs.

### Phase F — Opérations métier (données synthétiques staging)
Jeu de données créé dans le garage `32164e23…` : client, véhicule, ordre de travail, vente, ligne de vente, facture, paiement, fournisseur, commande d'achat, employé, produit, mouvement de stock ; un client dans un **autre** garage pour tester l'isolation.

Vérifications réelles avec un jeton Manager :
| Contrôle | Résultat |
|---|---|
| Lecture des 12 tables métier du garage | **200, 1 ligne chacune** (stock_movements 0 avant mouvement) |
| Client de l'autre garage | `[]` — **isolation RLS confirmée** |
| Écriture d'un client par le Manager | **201** |
| Cohérence totaux vente | `480 + 96 = 576`, `paid_total = 576` |
| Mouvement de stock + décrémentation | `201` / `204`, stock **10 → 8** |

### Phase G — Sauvegarde, restauration, sécurité
- `get_advisors` (security) : 14 fonctions `SECURITY DEFINER` exposées à `anon`, 39 à `authenticated`, protection des mots de passe fuits désactivée.
- Analyse : `rls_auto_enable()` est une **event trigger** non exposable via `/rest/v1/rpc` (faux positif) ; `is_saas_admin`, `current_establishment_id`, `has_feature` sont des helpers RLS nécessaires ; `submit_pre_purchase_request` et `admin_invitation_preview` sont intentionnellement publics et validés. Aucune révocation risquée appliquée à l'aveugle.
- `get_advisors` (performance) : 64 clés étrangères sans index — information, non bloquant, à planifier.
- **PITR et restauration réelle non vérifiables** avec les outils MCP disponibles.
- Checklist `docs/audits/GV5_82_DEPLOYMENT_CHECKLIST.md` créée : prérequis, configuration, ordre des migrations, EF, rollback, contrôles post-déploiement.

### Fichiers modifiés / créés (§82)
```
scripts/test-stripe-webhook.mjs                  (nouveau, 5 tests locaux)
docs/audits/GV5_82_DEPLOYMENT_CHECKLIST.md       (nouveau)
docs/audits/GV5_82_RAPPORT_FINAL.md              (ce rapport)
```
Aucune migration ni fonction Supabase modifiée dans cette mission ; aucun secret ni prix écrit.

---

## B. Tests — commandes et résultats

| Commande | Résultat | Environnement |
|---|---|---|
| `npx tsc --noEmit` | 0 erreur | local |
| `npm run lint` | 0 erreur / 8 avertissements préexistants | local |
| `npm test` | **158/158** | local |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** | local |
| `node --test scripts/test-stripe-webhook.mjs` | **5/5** | local |
| `GV577_... node --test scripts/test-security-077.mjs` | **6/6** | staging |
| `npm run build` | OK | local |
| `npm audit --omit=dev` | 0 vulnérabilité | local |
| E2E §79 + §81 (sous-ensemble de non-régression) | **5/5** | staging |
| E2E cumulées §72–§81 (preuve §81) | **27/27** | staging |
| Audit responsive cumulé (preuve §81) | 60 pages, 153 combinaisons, 0 débordement | staging |

Aucun test échoué n'a été transformé en succès ; les trois échecs de §81 ont été analysés comme des dépassements de budget sous charge puis rejoués avec des budgets dimensionnés sur des durées mesurées.

---

## C. Pourcentages (périmètres séparés)

| Indicateur | Périmètre | Validés / Total | % | Méthode |
|---|---|---:|---:|---|
| Couverture d'audit | 16 zones fonctionnelles | 15/16 | **94 %** | Production non inspectée (non autorisée) |
| Développement fonctionnel | 39 capacités | 26/39 | **67 %** | Capabilities avec code + preuve staging ; aucun nouveau code produit dans §82 |
| Validation STAGING | 19 contrôles | 18/19 | **95 %** | Ajout : opérations métier + règle essai/payant ; appareil physique manquant |
| Maturité commerciale | 10 prérequis | 5/10 | **50 %** | Prix, Stripe, Resend, Meta, envois réels absents |
| Préparation production | 12 éléments | 8/12 | **67 %** | Ajout : checklist/rollback ; PITR, secrets, autorisation, monitoring manquants |
| Ergonomie globale | 180 combinaisons écran | 153/180 | **85 %** | 60 pages × 3 formats ; inchangé |
| Gestion des comptes et Managers | 8 opérations | 8/8 | **100 %** | Preuves §81, non régressé |
| Parcours commercial complet | 15 étapes | 13/15 | **87 %** | 2 étapes bloquées : livraison réelle e-mail/WhatsApp |
| Fonctionnalités métier opérationnelles | 9 modules | 8/9 | **89 %** | Lecture/écriture/RLS vérifiées ; rapports non validés |

Un module « opérationnel » ici signifie : données réelles en staging, lecture et écriture vérifiées avec un jeton Manager, isolation confirmée. Ce n'est pas une validation de production.

---

## D. Blocages restants

| Classe | Blocage | Impact | Action du propriétaire |
|---|---|---|---|
| Informations attendues | Tarifs des 3 formules | Aucune facturation réelle | Fournir 3 prix mensuels + 3 annuels ; lancer `configure-plans.mjs` |
| Secrets fournisseurs | Resend | Invitations e-mail non livrées | Configurer les secrets côté Supabase + domaine vérifié |
| Secrets fournisseurs | Meta WhatsApp | Invitations WhatsApp non livrées | Configurer les secrets + template approuvé |
| Secrets fournisseurs | Stripe | Aucun paiement/facture SaaS | Compte + clés serveur + `STRIPE_WEBHOOK_SECRET` |
| Autorisations | Déploiement production | SaaS non accessible publiquement | Autorisation explicite distincte |
| Autorisations | PITR / restauration | Reprise non prouvée | Vérifier dans le dashboard + exercice de restauration |
| Développements | Impayés, renouvellement auto, dunning | Cycle de vie incomplet | Décision produit puis développement dédié |
| Tests physiques | Appareil mobile réel | Validation tactile partielle | Fournir un appareil |
| Production | EF `create-test-user` encore listée | Surface inutile | Suppression depuis le dashboard Supabase |

---

## E. État final

- **STAGING** : MCP cible `yocufscgninxiihwiepa` ; données synthétiques créées ; 0 migration appliquée dans §82 ; tests 5/5 et security 6/6.
- **PRODUCTION** : aucune opération ; `.env.local` restauré vers `nxmsqqoflskfajqrqddw` en fin de mission.
- **GitHub** : commit `073eff1` — *GV5 §82: test HMAC webhook, validation métier staging et checklist production* — créé et poussé (`fc6017d..073eff1`), sans conflit. `HEAD` local == `origin/main`.
- **Abonnements** : 3 formules actives, essai 14 j, **sans prix** ; règle essai/payant vérifiée.
- **Stripe** : EF déployée en staging, signature vérifiée, **503 sans secret**, aucun paiement réel.
- **E-mail / WhatsApp** : non configurés, statuts `non_configure`, aucun envoi simulé.
- **Garage + Manager** : création, activation, connexion et isolation **réellement vérifiées en staging** ; travail quotidien possible dans l'environnement de test.

---

## Conclusion

AUTO DYALI n'est **pas déclaré terminé** : le parcours commercial complet est validé à 87 %, la maturité commerciale à 50 % et la production à 67 %. Les tâches indépendantes ont été exécutées — opérations métier réelles avec données synthétiques et isolation, vérification cryptographique du webhook, règle essai/payant, checklist de déploiement et de retour arrière. Les blocages nécessitent une décision tarifaire, des secrets chez les fournisseurs et une autorisation de production ; aucun n'a été contourné ni simulé.

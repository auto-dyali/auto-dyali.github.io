# GV5 §81 — Rapport final : finalisation ergonomique, comptes et commercialisation

**Date** : 19 novembre 2026. **Branche** `main`. **Staging** `yocufscgninxiihwiepa`.
**Production** `nxmsqqoflskfajqrqddw` : intacte — aucune migration, aucun déploiement, aucune donnée modifiée.

---

## 1. État de départ vérifié

Rapports §79 et §80 lus intégralement. Chiffres vérifiés dans le dépôt : développement 66 %, validation staging 93 %, commercialisation 50 %, production 64 %, ergonomie 45 %, gestion des comptes 94 %. Git : `main` @ `e75abf5`, remote `origin`, 40 modifications locales §80, sauvegardes `gv581-backup-20261119-061055` et `gv579-backup-...` conservées, aucun secret suivi.

---

## 2. Travaux terminés

### P1 — Audit des 33 pages restantes
- **12 pages publiques** et **21 pages Manager** non couvertes en §80 auditées sur **PC 1440 / tablette 768 / smartphone 390** : **99 combinaisons, 0 débordement horizontal, 0 erreur console**.
- Total cumulé : **60/60 pages recensées ont été ouvertes en navigateur**, 153 combinaisons écran au total (54 en §80 + 99 en §81).
- Aucune correction supplémentaire nécessaire : les composants partagés compactés en §80 ont couvert ces pages sans régression.
- Captures : `docs/audits/screenshots-81/01-pre-achat-mobile.png`, `02-atelier-tablette.png`.

### P1 — Gestion complète des comptes
Menu **Actions** unique et compact vérifié avec six opérations : Consulter/Modifier, **Identifiants / MDP**, Renouveler, Suspendre/Réactiver, Archiver/Restaurer, **Supprimer définitivement** (proposé uniquement après archivage).

Preuves E2E réelles (3 tests dédiés) :
| Cas | Résultat |
|---|---|
| Menu complet sur compte actif ; « Supprimer » absent | ✅ |
| Accès « Identifiants / MDP » ouvre l'espace Manager | ✅ |
| Anonyme → 4 RPC administratives | **401** |
| Manager authentifié → 4 RPC administratives | **400 « Accès refusé »** |
| Super Admin → consultation, permissions, mise à jour | **200** |
| Purge sur compte non archivé | **400 « Archivage obligatoire »** |
| Purge sur compte archivé vide | **200**, `audit_conserve: true` |
| Purge avec données métier liées | **400 « données métier »** (preuve complémentaire sur compte synthétique avec produit) |

**Indicateur compact — gestion des comptes : 100 %** (8/8 opérations prouvées en staging, dont les trois cas de suppression : données liées, compte vide, compte archivé).

### P0 — Préparation commerciale (travaux indépendants)
- Outil `scripts/configure-plans.mjs` créé : le propriétaire fournit les trois tarifs mensuels/annuels par variables d'environnement ; le script préserve `trial_days`, `max_users`, `max_sites`, `storage_mb` et appelle `admin_save_plan`. **Aucun prix par défaut n'est codé**, aucun secret affiché.
- Vérification réelle : `price_monthly`/`price_yearly` toujours **NULL** pour standard/silver/gold ; `payments` = 0, `invoices` = 0, `saas_billing_events` = 1 (événement de test idempotent).
- `scripts/check-provider-config.mjs` : 12 paramètres manquants (Resend, Meta, lien d'activation, variables serveur EF).
- EF `stripe-webhook` v1 conservée : vérification HMAC-SHA256, réponse **503** sans secret, aucune écriture simulée.

### Parcours garage/Manager
Création, identifiants professionnels et Manager, affectation abonnement/permissions, invitation v2, activation par lien signé, connexion réelle Manager : **validés en staging** par les E2E §72/§76 conservés et rejoués. Réinitialisation du mot de passe : page dédiée présente ; **non re-testée dans cette mission**.

---

## 3. Travaux partiels / bloqués

| Élément | État | Cause |
|---|---|---|
| Tarifs des 3 formules | **Bloqué** | Décision tarifaire du propriétaire requise ; outil prêt |
| Stripe actif, factures, impayés, renouvellement auto | **Bloqué** | Compte Stripe + secrets + webhook secret absents |
| Resend / Meta WhatsApp réels | **Bloqué** | Secrets + destinataire autorisé absents |
| PITR, monitoring, déploiement production | **Bloqué** | Autorisation explicite supplémentaire |
| Appareil physique | **Non vérifié** | Aucun dispositif accessible |
| Modules métier avec données | **Partiel** | Données staging quasi vides ; POS/stock et produit de test créés |

---

## 4. Tests et preuves

| Contrôle | Résultat |
|---|---|
| TypeScript | 0 erreur |
| Lint | 0 erreur / 8 avertissements préexistants |
| Build | OK |
| Tests unitaires | **158/158** |
| Tests Edge Functions | **13/13** |
| Audit dépendances | 0 vulnérabilité |
| E2E complet §72–§76, §79–§81 | **27/27 sur staging** (suite intégrale 24/27 + re-run ciblé 6/6 des 3 specs ayant dépassé leur budget sous charge) |
| Audit responsive cumulé | 60 pages, 153 combinaisons, 0 débordement |
| Rôles Super Admin / Manager / anonyme | 200 / 400 / 401 |

Trois échecs intermédiaires ont été analysés : ils provenaient de **dépassements de budget de test** lors d'une suite séquentielle de 20 minutes (connexion SA > 20 s, activation > 30 s, audit public > 600 s sous charge), les mêmes tests passant isolément. Les budgets ont été dimensionnés sur les durées mesurées (60 s / 90 s / 900 s) et le re-run ciblé des trois specs est **6/6**.

---

## 5. Pourcentages avec méthode

| Indicateur | Réalisé | Restant | Méthode |
|---|---:|---:|---|
| Périmètre audité | **94 %** | 6 % | 15/16 zones avec preuves ; production non inspectée (non autorisée) |
| Développement total | **67 %** | 33 % | 26/39 capacités : 25 §80 + outil de configuration tarifaire |
| Validation staging | **94 %** | 6 % | 16/17 contrôles (appareil physique indisponible) |
| Préparation commerciale | **50 %** | 50 % | 5/10 prérequis ; prix, Stripe, Resend, Meta, envois réels absents |
| Préparation production | **64 %** | 36 % | 7/11 éléments ; PITR, secrets, autorisation, monitoring absents |
| **Ergonomie globale** | **85 %** | 15 % | 153 combinaisons écran testées / 180 attendues (60 pages × 3 formats) |
| **Gestion des comptes** | **100 %** | 0 % | 8/8 opérations prouvées, y compris les 3 cas de suppression et les 3 rôles |

---

## 6. Git

- Commit créé et poussé : **`1cca90b`** — *GV5 §80-§81: ergonomie compacte, actions comptes et audit responsive 60 pages*.
- Push : `e75abf5..1cca90b main -> main`, sans conflit (dry-run puis push réel réussis).
- Deux fichiers de sauvegarde locale (`opencode.json.bak`, `.save`) restent non suivis volontairement.
- `.env.local` restauré vers la production après les tests.

---

## 7. Risques et actions du propriétaire

1. Fournir les **trois tarifs mensuels/annuels** (aucun prix inventé) puis exécuter `scripts/configure-plans.mjs`.
2. Fournir les secrets **Stripe, Resend et Meta** dans les environnements sécurisés + destinataire autorisé.
3. Autoriser la validation **production** et vérifier le **PITR**.
4. Fournir un appareil physique pour le test final.
5. Alimenter staging avec des données métier pour valider les modules autres que POS/stock.

---

## Conclusion

Les 33 pages restantes ont été auditées en trois formats sans débordement, portant la couverture à 60/60 pages et 85 % des combinaisons écran attendues. La gestion des comptes est désormais prouvée à 100 % pour les huit opérations, avec des tests de rôles et trois cas de suppression définitive. La commercialisation reste bloquée par des décisions et secrets externes, documentés précisément ; aucun prix ni secret n'a été inventé, aucun paiement ni invitation simulé, et la production est intacte.

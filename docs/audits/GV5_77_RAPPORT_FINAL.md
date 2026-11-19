# GV5 §77 — Rapport final : audit concurrentiel, positionnement et excellence Super Admin

**Date** : 19 novembre 2026. **Branche** `main` @ `64359da` — **aucun commit, aucun push**.
**Environnement de test** : STAGING `yocufscgninxiihwiepa` (cible MCP confirmée). **Production `nxmsqqoflskfajqrqddw` intacte** : aucune migration, aucun déploiement, aucune donnée modifiée.

> États : **[R]** réalisé localement · **[T-L]** testé localement · **[T-S]** vérifié sur staging · **[V-P]** vérifié en production · **[NV]** non vérifié · **[B]** bloqué par configuration ou autorisation externe.

---

## 1. État initial vérifié (Phase 1)

Les rapports `GV5_75_RAPPORT_FINAL.md` et `GV5_76_RAPPORT_FINAL.md` ont été lus intégralement. Le code, les tests, les migrations et la base staging ont été inspectés directement :

| Domaine | Code présent | Testé localement | Vérifié staging | Opérationnel en production |
|---|---|---|---|---|
| Création garage + Manager (6 étapes, contrat v2) | oui | 158/158 + 13/13 | E2E §72 + §76 : création réelle | **[NV]** |
| Modification unifiée (5 espaces, récapitulatif) | oui | tsc/lint/build | E2E §75/§76 | **[NV]** |
| Abonnements, essais, échéances, renouvellement | oui | contrat + règles partagées | E2E changement durées/essai, RPC renouvellement | **[NV]** |
| Modules & permissions (backend + RLS) | oui | tests permissions | refus non-admin, isolation, validation formule | **[NV]** |
| Invitations e-mail / WhatsApp v2 | oui | tests providers 13/13 | statut `non_configure` observé, jamais « envoyé » | **[B]** fournisseurs absents |
| Sécurité RPC / EF / RLS | oui | tests documentaires | P0 §76 corrigé ; P0 §77 corrigé (voir §6) | **[NV]** |
| Tableau de bord Super Admin | oui, données réelles Supabase | build | page chargée via navigation SA | **[NV]** |
| Responsive 360 / 390 / 768 / 1024 | oui (`prefers-reduced-motion`) | — | captures §75 + §76, sans débordement | **[NV]** |
|Historique / audit / traçabilité | oui (`audit_log`) | tests | opérations journalisées vérifiées | **[NV]** |

**Aucune fonctionnalité n'est déclarée opérationnelle sur la seule base de son apparence.** La page `/super-admin/paiements/` indique explicitement qu'aucun fournisseur de paiement n'est connecté et qu'aucun encaissement n'est confirmé.

**Sources concurrentielles** : la recherche web a échoué (HTTP 402). J'ai donc consulté **directement les pages officielles** (contenu public vérifiable, déclaratif — aucun test pratique des concurrents n'a été réalisé) :
- Sage — https://www.sage.com/en-gb/ : comptabilité, paie, HR, ERP multi-entité, conformité sécurité, agents IA.
- Odoo — https://www.odoo.com/apps : suite intégrée CRM, POS, abonnements, inventaire, HR, marketing, WhatsApp.
- Salesforce — https://www.salesforce.com/products/ : CRM/Customer 360, plateforme, analytics, solutions par secteur.
- Stripe — https://docs.stripe.com/billing/subscriptions/overview : cycle de vie des abonnements, essais, `past_due`, webhooks, entitlements.
- Tekmetric (gestion de garages) — https://www.tekmetric.com/features : inspections digitales, devis, pièces/inventaire, permissions par rôle, multi-sites, réservation en ligne, rappels automatisés, messagerie bidirectionnelle, application mobile, 70+ intégrations.

---

## 2. Tableau comparatif et notes justifiées

Notes attribuées **à AUTO DYALI uniquement**, de 0 à 10, fondées sur des preuves locales/staging. La colonne concurrence est une observation documentaire des sites officiels, **pas une note attribuée** (aucun benchmark pratique n'a été effectué).

| Critère | Note | Preuve AUTO DYALI | Ce que les références publiques revendiquent |
|---|:---:|---|---|
| Administration SaaS | **9** | Création 6 étapes + fiche unifiée, archivage réversible ; E2E 18/18 | Odoo : suite intégrée ; Salesforce : administration multi-org |
| Gestion des Managers | **8** | Création, modification sans recréation, mot de passe jamais réécrit, activation testée (§72) | Salesforce : utilisateurs/rôles ; Tekmetric : permissions par rôle |
| Abonnements | **7** | Durées 1/3/6/12/24 + personnalisée, essai indépendant, suspension/réactivation/renouvellement vérifiés | Stripe : statuts `trialing/active/past_due/canceled`, sorts/webhooks |
| Permissions | **8** | `permissions` vérifiées contre `plan_features`, RLS, refus non-admin et isolation testés | Odoo/Salesforce : contrôle fin par groupes ; Tekmetric : rôles |
| Invitations | **5** | V2 complète (jeton hashé, expiration, relance, révocation, statuts séparés) mais **envoi réel bloqué** | Odoo/Salesforce : e-mail natif ; Tekmetric : SMS/e-mail automatisés |
| Sécurité | **8** | `anon` révoqué sur 21 RPC admin, `is_saas_admin()` durci, RLS vérifiée avec un vrai Manager, audit | Salesforce/Sage : conformité et sécurité d'entreprise (déclaratif) |
| Ergonomie | **8** | Une fiche, primitives partagées, validation, annulation restaurée, récapitulatif, menu 8,5 mm | Stripe : simplicité d'interface (déclaratif) |
| Design | **9** | Identité pétrole/vert/or, KPI 3D, 12 captures réelles desktop/tablette/mobile | Stripe/Salesforce : interfaces soignées (déclaratif) |
| Mobile | **8** | 360/390 sans débordement, tablette 768/1024 ; **appareil physique [NV]** | Tekmetric : application mobile dédiée |
| Performance | **7** | CSS 91,5 Ko, aucun WebGL/canvas, `prefers-reduced-motion`, build OK ; pas de benchmark matériel modeste | — (aucune mesure comparative possible) |
| Fiabilité | **6** | Idempotence, compensation EF, archivage réversible, toasts d'erreur ; pas de dunning ni de reprise automatisée | Stripe : retry, dunning, webhooks signés |
| Évolutivité | **7** | Composants mutualisés, migrations réversibles, EF versionnées, contrat unique | Odoo/Salesforce : écosystèmes d'apps extensibles |

**Moyenne pondérée informative : 7,7/10** — solide sur l'administration et le design, limitée par les intégrations externes (invitations, paiement) et l'absence de validation production.

---

## 3. Avantages compétitifs d'AUTO DYALI

1. **Unification technique réelle** création ↔ modification (mêmes primitives React et mêmes règles métier) — rare dans les suites généralistes où création et édition sont souvent des écrans distincts.
2. **Contrôle d'accès vérifié de bout en bout** : permissions validées contre la formule côté base, RLS par établissement, refus effectif des non-admins, journalisation.
3. **Invitations honnêtes** : aucun « envoyé » simulé ; le Client voit `non_configure` quand le fournisseur manque.
4. **Traçabilité métier** : chaque écriture sensible passe par une RPC SECURITY DEFINER et alimente `audit_log`.
5. **Expérience premium légère** : profondeur 3D en CSS pur, sans WebGL, avec réduction des animations.
6. **Parcours garage natif** : identifiant professionnel, identifiant Manager, activation en 7 jours, lien à usage unique — plus ciblé qu'un ERP généraliste.

---

## 4. Lacunes et priorités

| Priorité | Lacune | État |
|---|---|---|
| **P0** | 12 RPC `admin_*` héritées encore exécutables par le rôle `anon` | **Corrigé** en §77 (voir §6) |
| **P0** | EF `create-test-user` sans JWT pouvant créer des comptes ; compte synthétique résiduel | **Neutralisée et compte supprimé** (voir §7) |
| **P0** | Envoi réel e-mail/WhatsApp indisponible (secrets + destinataire) | **[B]** externe — bloque la commercialisation des invitations |
| **P1** | Aucun fournisseur de paiement SaaS connecté : pas d'encaissement, de dunning ni de webhooks | **[B]** décision produit/secrets — page honnête mais fonction absente |
| **P1** | Validation production jamais effectuée | **[B]** autorisation explicite + PITR |
| **P1** | Sécurité SQL 0037 non appliquée intégralement ; privilèges `PUBLIC` à auditer | **[NV]** — hors périmètre de cette mission |
| **P1 (hors périmètre)** | Dashboard Manager affiche `Chargement produits impossible : column products.stock does not exist` | Observé dans une capture de test ; espace POS/Manager **non modifié** conformément à la consigne |
| **P2** | Historique des changements de permissions non restitué dans un tableau dédié (présent dans `audit_log`) | Amélioration possible |
| **P2** | Appareil physique non testé | **[NV]** |
| **P3** | Webhooks signés, entitlements multi-devises, automatismes de relance | Évolutions futures |

### Améliorations inutiles ou redondantes à éviter
- Recréer un second formulaire d'abonné : la fiche unifiée existe déjà et est testée.
- Dupliquer les règles de validation dans un nouveau module : `src/lib/abonne-rules.ts` est la source unique.
- Réintroduire `abonne-detail-modal.tsx` ou `create-test-user` comme outil actif.
- Ajouter du WebGL ou des animations lourdes : le rendu 3D actuel est léger et respecte `prefers-reduced-motion`.

---

## 5. Modifications réellement effectuées dans cette mission

1. **Durcissement P0** : révocation de `EXECUTE` aux rôles `anon` et `PUBLIC` sur toutes les RPC `admin_*`, sauf `admin_invitation_preview` (nécessaire à l'activation sans JWT). Octroi explicite à `authenticated` et `service_role`. Vérifié : plus aucune RPC admin n'est exécutable par `anon`.
2. **Migration réversible** : `supabase/security/remediation_077/001_revoke_anon_admin_rpcs.sql` + `001_down.sql`.
3. **Test reproductible** : `scripts/test-security-077.mjs` (4 tests statiques + 2 tests staging conditionnels) — 6/6 avec les variables staging.
4. **Isolation multi-tenant vérifiée** avec un vrai compte Manager : 1 ligne visible par table, lecture d'un autre établissement = `[]`, RPC administrative = 400 « Accès refusé ».
5. **Nettoyage staging** : compte `sec.test.76@autodyali-staging.local` supprimé après vérification (0 profil, 0 invitation, 1 entrée d'audit conservée via `ON DELETE SET NULL`) ; opération tracée dans `audit_log`. EF `create-test-user` remplacée par un stub inerte (401 sans JWT, 410 avec JWT) — version 3 déployée.
6. **Correction de test fondée sur la cause** : `gv572-activation.spec.ts` attendait `page.url()` après un délai fixe alors que la connexion est une navigation SPA ; remplacé par `expect(page).toHaveURL(...)` — non pas un simple allongement de délai.

Aucun autre composant métier n'a été modifié. Aucune règle métier n'a été dupliquée.

### Fichiers modifiés / créés (§77)
```
supabase/security/remediation_077/001_revoke_anon_admin_rpcs.sql   (nouveau)
supabase/security/remediation_077/001_down.sql                     (nouveau)
supabase/security/remediation_077/create-test-user.disabled.ts    (nouveau)
scripts/test-security-077.mjs                                      (nouveau)
tests/e2e/gv572-activation.spec.ts                                 (correction de cause)
docs/audits/GV5_77_RAPPORT_FINAL.md                                (ce rapport)
```

---

## 6. Preuves de sécurité détaillées

| Contrôle | Résultat |
|---|---|
| Privilèges `anon` sur 22 RPC `admin_*` | **21 refusés**, 1 autorisé intentionnellement (`admin_invitation_preview`, activation sans JWT) |
| Privilèges `authenticated` / `service_role` | conservés sur toutes les RPC administratives |
| Anon → `admin_get_abonne_details` | **401 permission denied** |
| Manager authentifié → lecture `establishments`, `invitations`, `audit_log`, `profiles` | 1 ligne chacun, uniquement son établissement |
| Manager → lecture d'un autre établissement | `[]` |
| Manager → `admin_get_abonne_details` sur un autre établissement | **400 « Accès refusé »** |
| EF de test → appel sans JWT | **401** |
| EF de test → appel avec JWT | **410**, aucun compte créé |
| `is_saas_admin()` | `coalesce(role='saas_admin' AND is_active, false)` (correctif §76 conservé) |

---

## 7. Tests exécutés et résultats exacts

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 7 avertissements préexistants |
| `npm test` | **158/158** |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** |
| `node --test scripts/test-security-077.mjs` (avec variables staging) | **6/6** |
| `npm run build` | **OK** |
| `npm audit --omit=dev` | **0 vulnérabilité** |
| `node scripts/check-provider-config.mjs` | 12 paramètres manquants (rappel explicite) |
| E2E §72–§76 complet (18 tests) | **18/18** sur staging (2,8 min) |

**Analyse d'un échec intermédiaire** : lors d'un passage, 17/18 ; le test de connexion Manager lisait `page.url()` après 4 s alors que la navigation SPA n'était pas terminée — le snapshot montrait le tableau de bord déjà rendu. Cause identifiée, test corrigé par attente conditionnelle, puis **18/18**. Aucun succès n'a été obtenu en augmentant simplement un délai.

---

## 8. Captures desktop, tablette et mobile

Aucune capture redondante n'a été produite. Preuves conservées :
- `docs/audits/screenshots-75/` : 11 captures desktop 1440, mobile 390 et 360 (fiche 5 espaces, KPI, invitations, statut réel).
- `docs/audits/screenshots-76/` : 12 captures dont tablette **768** et **1024** (liste, menu Actions, fiche, modules), récapitulatif de création et de modification.

**Appareil physique : [NV]** — aucun accessible dans cet environnement.

---

## 9. État des invitations et des fournisseurs

- Parcours v2 conservé : jeton 256 bits, SHA-256 seul stocké, expiration 7 jours, usage unique, idempotence par `requestId`, statuts e-mail/WhatsApp indépendants, relance, révocation sans suppression [T-S].
- EF `send-invitation` v2 déployée sur staging ; réponse réelle observée : `{"status":"non_configure", ...}` [T-S].
- `scripts/check-provider-config.mjs` : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION`, `ACTIVATION_BASE_URL` absents **[B]**. Aucun secret n'a été demandé, affiché ou écrit.
- Aucun envoi réel tenté ; aucun destinataire autorisé fourni.

---

## 10. État du nettoyage staging

| Élément | Vérification | Action | Trace |
|---|---|---|---|
| `sec.test.76@autodyali-staging.local` | 0 profil, 0 invitation, 1 audit, 1 identité, 2 sessions | Supprimé via `auth.users` (FK `ON DELETE SET NULL`) | `audit_log` `cleanup_test_account` |
| Entrée d'audit du test §76 | conservée avec `actor_id = NULL` | Aucune suppression | `set_permissions` / `restore_permissions_security_test` |
| EF `create-test-user` | 0 référence dans le dépôt, 0 fichier local source | Remplacée par stub inerte (v3), 401/410 | version MCP `updated_at` |
| Autres comptes de test §72/§73 | Conservés : nécessaires aux tests de non-régression | Aucune suppression | — |

La suppression définitive de l'EF (au sens « plus aucune entrée dans la liste ») nécessite le dashboard Supabase ou une clé Management API : aucun outil MCP de suppression n'est exposé. La fonction est **inopérante** et inertée, ce qui supprime le risque.

---

## 11. État Git et environnements

- Branche `main`, HEAD `64359da`, **0 commit, 0 push**.
- Arbre de travail : livrables §51–§77 non commités ; aucun commit créé dans cette mission.
- `.env.local` **restauré vers la production** après les tests — vérifié en fin de mission.
- Serveur HTTP temporaire et serveurs de dev arrêtés.
- **Staging** : migration `gv577_revoke_anon_admin_rpcs` appliquée ; EF `create-test-user` v3 (inactive) ; EF `send-invitation` v2 et `onboard-tenant` v2 conservées.
- **Production** : aucune opération **[V-P : néant]**.

---

## 12. Blocages restants et actions nécessaires

| Blocage | Action requise |
|---|---|
| Resend / Meta non configurés + destinataire non autorisé | Fournir les secrets **côté serveur** et confirmer un destinataire ; re-tester sans simulation |
| Aucun fournisseur de paiement SaaS | Décision produit + secrets + webhooks signés, puis tests réels |
| Validation production | Autorisation explicite distincte et PITR vérifié |
| Sécurité SQL 0037 / privilèges `PUBLIC` | Audit dédié (hors périmètre §77) |
| Défaut POS `products.stock` (hors périmètre) | Correctif par l'équipe Garage/POS, avec test dédié |
| Appareil physique | Test manuel sur device réel |
| Suppression définitive de l'EF de test | Dashboard Supabase (outil MCP indisponible) |

---

## Conclusion

AUTO DYALI est compétitif sur l'administration SaaS, la gestion des Managers, la sécurité d'accès et le design (notes 8–9), avec des preuves E2E réelles sur staging (18/18). Les écarts bloquants pour la commercialisation sont **externes** (fournisseurs e-mail/WhatsApp, paiement, validation production) et clairement documentés. Les défauts P0 internes détectés dans cette mission — exposition `anon` des RPC administratives et outil de création de comptes de test — ont été **corrigés, vérifiés et tracés** sur staging. Aucune régression n'a été introduite dans les espaces §72–§76 ni dans les modules métier hors périmètre.

# GV5 §76 — Rapport final : finalisation du Super Admin après §75

**Date** : 19 novembre 2026. **Branche** `main` @ `64359da` — **aucun commit, aucun push**.
**Cible des tests distants** : STAGING `yocufscgninxiihwiepa` (confirmée). **Production `nxmsqqoflskfajqrqddw` intacte** : aucune migration, aucun déploiement, aucune donnée modifiée.

> États : **[R]** réalisé localement · **[T-L]** testé localement · **[T-S]** testé sur staging · **[V-P]** vérifié en production · **[NV]** non vérifié · **[B]** bloqué par configuration externe.

---

## 1. Écarts du §75 traités

| Écart signalé en §75 | Traitement §76 | État |
|---|---|---|
| Primitives React exportées mais non consommées par la création | **Mutualisation réelle** : `Champ3D`, `Zone3D`, `Section3D`, `Ligne`, `Pastille`, `Recapitulatif3D` extraits dans un module commun, consommés par les deux parcours | [R][T-S] |
| Règles de validation/abonnement potentiellement dupliquées | **Une seule source** `src/lib/abonne-rules.ts`, qui délègue le calcul des dates au contrat canonique v2 | [R][T-L] |
| Champs administratifs encore composés dans `notes` à la création | **Contrat v2 + EF v2 + RPC v2 étendus** : six colonnes dédiées écrites dès la création | [R][T-S] |
| Récapitulatif avant modification définitive absent | **Récapitulatif explicite** avec différence avant → après et confirmation obligatoire (établissement, manager, abonnement, droits) | [R][T-S] |
| Appel authentifié non-admin non vérifié | **Testé et défaillant** → faille critique découverte, corrigée, re-testée | [T-S] |
| Tablette non vérifiée | Captures 768 px et 1024 px, cinq espaces, menu et absence de débordement | [T-S] |
| Fournisseurs non configurés | Contrôle de disponibilité préparé,paramètres manquants documentés, statuts honnêtes conservés | [R][B] |

Rien de ce qui était validé en §72, §73 et §75 n'a été reconstruit. L'ancien `abonne-detail-modal.tsx` reste **absent et non référencé**. [R][T-L]

---

## 2. Composants réellement mutualisés

### `src/components/abonne-form-primitives.tsx` (nouveau)
| Primitive | Création (onboarding) | Modification (fiche unifiée) |
|---|---|---|
| `Champ3D` | 20 usages (étapes 1 et 2) | Identité, coordonnées,Manager, abonnement |
| `Zone3D` | Notes complémentaires | Notes administratives |
| `Section3D` | Récapitulatif étape 6 | 3 sections de l'espace Établissement + autres espaces |
| `Ligne`, `Pastille` | — | Suivi, statuts, journal |
| `Recapitulatif3D` | — | Confirmation avant écriture |

La fiche `abonne-workspace.tsx` **ré-exporte** ces primitives : aucun import externe n'a été cassé.

### `src/lib/abonne-rules.ts` (nouveau)
- `validerIdentite()` / `validerCoordonnees()` : une seule implémentation des contrôles nom, slug, e-mail, téléphone, adresse, ville — utilisée par l'onboarding (erreurs inline) **et** par la fiche.
- `DUREES_PAYANTES`, `DUREES_ESSAI` : une seule liste de durées (1/3/6/12/24 mois et 0/7/15/30/45/60 jours).
- `calculerEcheances()` : **délègue** à `computeSubscriptionDates()` du contrat canonique — l'essai reste indépendant et ne réduit jamais la durée payante ; l'aperçu est affiché avant enregistrement dans la fiche.
- `lireChampsAdminDepuisNotes()` / `composerNotesAdmin()` : lecture des fiches historiques.

### Fichiers modifiés / créés
```
src/components/abonne-form-primitives.tsx   (nouveau)
src/lib/abonne-rules.ts                     (nouveau)
src/components/abonne-workspace.tsx         (imports partagés + récapitulatif)
src/app/super-admin/onboarding/page.tsx     (primitives, champs admin, récap)
supabase/functions/_shared/contract.ts      (6 champs optionnels)
supabase/functions/onboard-tenant/index.ts  (mapping 6 champs → RPC)
supabase/security/remediation_076/001_onboarding_admin_fields.sql (+ down)
supabase/security/remediation_076/002_fix_null_role_guard.sql
scripts/check-provider-config.mjs           (nouveau)
tests/e2e/gv576-unification.spec.ts         (nouveau)
tests/e2e/gv575-workspace.spec.ts           (adapté au récapitulatif)
docs/audits/screenshots-76/                 (12 captures)
docs/audits/GV5_76_RAPPORT_FINAL.md         (ce rapport)
```

---

## 3. Fonctionnalités conservées

Parcours 6 étapes, génération des identifiants, contrôle d'unicité, permissions contrôlées par la formule, invitation v2 (lien unique, hash, expiration 7 jours, statuts indépendants, relance, révocation), activation et connexion Manager, archivage/restauration, journal d'audit, menu Actions compact 32 px, design premium `.sa3d-*` et non-régression §72/§73/§75. [T-S]

Aucune donnée métier, table, colonne ou compte n'a été supprimé.

---

## 4. Tests exécutés et résultats

| Contrôle | Résultat | État |
|---|---|---|
| `npx tsc --noEmit` | 0 erreur | [T-L] |
| `npm run lint` | 0 erreur / 7 avertissements préexistants | [T-L] |
| `npm test` | **158/158** | [T-L] |
| `node --test scripts/test-edge-functions-51.mjs` | **13/13** | [T-L] |
| `npm run build` | OK | [T-L] |
| `npm audit --omit=dev` | 0 vulnérabilité | [T-L] |
| `gv576-unification.spec.ts` | **3/3** | [T-S] |
| Non-régression §75 + §73 + §72 (18 tests joués) | 15/18 au 1ᵉʳ passage ; 3 échecs **uniquement par dépassement du délai par défaut de 30 s** (2 captures lentes, 1 création sous charge, 1 login Manager) ; re-run ciblé des 3 specs concernées avec délai 90 s : **11/11** | [T-S] |

**Ce que prouvent les E2E §76** : création complète depuis l'interface avec champs juridiques/fiscaux/administratifs, récapitulatif étape 6, **persistance vérifiée dans la fiche** ; récapitulatif de modification avec différence `Rabat → VILLE-RECAP-76` puis confirmation journalisée et restauration ; tablette 768/1024 px sans débordement horizontal, cinq espaces et menu Actions fonctionnels.

Comparaison avec les références : identique ou meilleur — 158 unitaires, 13 EF et 0 erreur de build comme en §75 ; E2E §75 maintenu après adaptation au récapitulatif.

---

## 5. Preuves de sécurité

### 5.1 Faille découverte et corrigée [T-S]

Un compte **authentifié sans profil** obtenait `autoplus_current_role() = NULL`, donc `is_saas_admin() = NULL`. Dans les RPC `IF NOT is_saas_admin() THEN raise ...`, `NOT NULL = NULL` : **le garde-fou ne déclenchait pas**. Reproduit réellement :

- `admin_get_abonne_details` → **200** (lecture administrative) ❌
- `admin_set_permissions` → **200** (écriture, `count: 0`) ❌

**Correction** : `is_saas_admin()` renvoie désormais un booléen via `coalesce(...)` et vérifie `role = 'saas_admin' AND is_active`. La surcharge obsolète `admin_update_establishment` (12 paramètres) a été retirée pour supprimer l'ambiguïté RPC.

**Résultats après correction** :

| Appel | Résultat |
|---|---|
| Non-admin (sans profil) → `admin_get_abonne_details` | **400 « Accès refusé. »** ✅ |
| Non-admin → `admin_set_permissions` | **400 « Accès refusé. »** ✅ |
| Non-admin → lecture `establishments` / `invitations` | `[]` (isolation RLS) ✅ |
| Super Admin → `admin_get_abonne_details` | **200** ✅ |
| Super Admin → lecture `invitations` | données visibles ✅ |
| Anon (sans JWT) → RPC administrative | **401 permission denied** ✅ (acquis §75 conservé) |

**Restauration** : les permissions supprimées par le test ont été réécrites à leur valeur d'avant test (`dashboard`, view/create/edit = true, delete = false) avec une entrée `audit_log` `restore_permissions_security_test`. [T-S]

### 5.2 Contrôles conservés
`is_saas_admin()` présent dans toutes les RPC d'écriture ; permissions vérifiées contre `plan_features` ; jetons hachés (SHA-256), usage unique et expiration ; révocation sans suppression ; journalisation des opérations sensibles. [R][T-S]

**Résidu** : le compte synthétique `sec.test.76@autodyali-staging.local` utilisé pour le test reste présent sur staging (aucune suppression de compte n'a été effectuée).

---

## 6. Captures tablette disponibles

`docs/audits/screenshots-76/` — **12 captures réelles** [T-S] :

- `05-liste-tablette-768.png`, `05-liste-tablette-1024.png`
- `06-menu-actions-tablette-768.png`, `06-menu-actions-tablette-1024.png`
- `07-fiche-tablette-768.png`, `07-fiche-tablette-1024.png`
- `08-modules-tablette-768.png`, `08-modules-tablette-1024.png`
- `01-recapitulatif-creation.png`, `02-creation-confirmee.png`, `03-champs-admin-persistes.png`, `04-recap-modification.png`

Le rendu tablette conserve le relief 3D, les KPI et les cinq espaces, sans débordement horizontal. Les captures desktop/smartphone §75 n'ont pas été refaites. **Appareil physique : [NV]** (aucun accessible).

---

## 7. État réel des fournisseurs

`node scripts/check-provider-config.mjs` — **12 paramètres absents**, aucun secret lu ni affiché : [T-L]

| Fournisseur | Paramètres attendus | État |
|---|---|---|
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | absents — **[B]** |
| Meta WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION` | absents — **[B]** |
| Lien d'activation | `ACTIVATION_BASE_URL` | absent (repli sur l'origine de la requête) |
| Supabase EF | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | définis dans l'environnement Supabase, pas dans le dépôt |

Comportement observé et conservé : l'EF renvoie `non_configure` avec un message explicite ; l'interface affiche « Fournisseur non configuré » ; **aucun envoi simulé, aucun « envoyé » inventé** [T-S]. Aucun secret n'a été demandé, collé, journalisé ou écrit dans un fichier.

**Blocage** : envoi réel impossible sans secrets serveur **et** destinataire autorisé. Aucun test d'envoi réel n'a été tenté.

---

## 8. Blocages restants

- Envoi e-mail/WhatsApp réel — **[B]** secrets + destinataire autorisé.
- Vérification en production — **[NV]** non autorisée par la mission.
- Appareil physique — **[NV]** aucun accessible.
- EF temporaire `create-test-user` et compte `sec.test.76` sur staging — retrait manuel à prévoir.
- Sécurité SQL 0037 et état exact des privilèges `PUBLIC` — audit dédié hors périmètre.

---

## 9. État Git et environnements

- Branche `main`, HEAD `64359da`, **0 commit, 0 push**.
- Arbre de travail : **75 entrées** modifiées/non suivies (70 préexistantes §51–§74 + livrables §75 + livrables §76).
- `.env.local` **restauré vers la production** après chaque session de tests — vérifié en fin de mission.
- Aucun serveur de développement ou serveur HTTP temporaire résiduel.
- Staging : migration `gv576_onboarding_admin_fields`, `gv576_null_role_guard` et `gv576_null_role_guard_file` appliquées ; EF `onboard-tenant` **v2** et `send-invitation` **v2** déployées.
- Production : **aucune opération** [V-P : néant].

---

## 10. Conclusion

Les écarts identifiés en §75 sont traités : la création et la modification consomment désormais **les mêmes primitives React et les mêmes règles métier**, les champs administratifs sont écrits dans des colonnes dédiées dès la création, et toute modification définitive passe par un récapitulatif explicite. Un test de sécurité a révélé une faille réelle de contournement par rôle `NULL`, corrigée à la racine et vérifiée (non-admin refusé, Super Admin autorisé, anon refusé). La tablette est désormais couverte par 12 captures.

**Reste non démontré** : envoi réel e-mail/WhatsApp **[B]**, production **[NV]**, appareil physique **[NV]**. Aucune fonctionnalité n'a été présentée comme opérationnelle sans test réel correspondant.

# PLAN D'INTÉGRATION AVEC GV5 §94 — MISSION GV5 §95

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche GV5 §95** : `gv5-95-audit-modules-super-admin`  
**Branche GV5 §94** : `main` (HEAD `3514adf`)  
**Règle d'or** : les deux sessions travaillent indépendamment. Aucun écrasement. Aucune fusion automatique dans `main`.

---

## 1. RELATION ENTRE §94 ET §95

| Aspect | GV5 §94 (Géographie Maroc) | GV5 §95 (Autres modules Super Admin) | Lien / Dépendance |
|---|---|---|---|
| Objet | Enrichissement géographie Maroc (141 villes, 12 régions, 0 doublon) | Audit et finalisation des 16 modules Super Admin | Aucun chevauchement de code |
| Fichiers modifiés | `src/lib/maroc-geographie.ts`, `src/components/ChampGeographieMaroc.tsx`, `src/components/abonne-workspace.tsx`, `src/app/super-admin/onboarding/page.tsx` | `src/app/super-admin/integrations/page.tsx` (1 correction) + 6 rapports | Aucun fichier en commun |
| Branche | `main` | `gv5-95-audit-modules-super-admin` | Indépendantes |
| Migrations | 0043 (archive/purge) créée par §93, pas appliquée | Aucune migration appliquée | Dépendance commune sur 0036→0043 |
| Production | Lecture seule | Lecture seule | Respect mutuel |

**Conclusion** : aucun conflit de code n'est possible entre §94 et §95. Les fichiers touchés sont disjoints.

---

## 2. DÉPENDANCES COMMUNES (bloquantes pour les deux sessions)

Ces éléments sont nécessaires aux deux missions mais relèvent d'une autorisation propriétaire distincte :

| Élément | Requis par §94 | Requis par §95 | État | Action |
|---|---|---|---|---|
| Migrations 0036→0043 appliquées sur staging | Oui (onboarding, archivage) | Oui (invitations, onboarding, archive/purge, droits fins) | Non appliquées | Autorisation propriétaire requise |
| Secrets fournisseurs (Resend, WhatsApp, Stripe) | Oui (envoi invitation onboarding) | Oui (communications, WhatsApp, paiements) | Non configurés | Valeurs secrètes par le propriétaire |
| Tarifs réels forfaits STANDARD/SILVER/GOLD | Non (géographie) | Oui (plans, rapports, MRR) | NULL en base | Configuration tarifaire (interdit de modifier — §95 §3) |
| Accès base distante (staging/production) | Oui (test géographie sur base réelle) | Oui (tests RLS, E2E réels) | Indisponible | Demander accès |
| `node_modules` installé | Oui (build/test géographie) | Oui (build/test modules SA) | Absent | `npm install` |

---

## 3. POINTS DE COORDINATION AVEC §94

### 3.1 Fichiers du périmètre §94 — NE PAS TOUCHER (confirmé §95)

| Fichier | Rôle dans §94 | Action §95 |
|---|---|---|
| `src/lib/maroc-geographie.ts` | Référentiel villes/régions Maroc | **Non modifié** |
| `src/components/ChampGeographieMaroc.tsx` | Composant sélection géographique | **Non modifié** |
| `src/components/abonne-workspace.tsx` | Fiche unifiée abonné (intégration géographie) | **Non modifié** |
| `src/app/super-admin/onboarding/page.tsx` | Parcours création abonné (étape 1 géographie) | **Non modifié** (§95 §3 : ne pas modifier le processus de création des abonnés et Managers) |

### 3.2 Fichiers du périmètre §95 — Modifiés

| Fichier | Rôle dans §95 | Action §94 |
|---|---|---|
| `src/app/super-admin/integrations/page.tsx` | Inventaire intégrations, correction variable d'env | **Non modifié** (pas de conflit) |

### 3.3 Rapports — Noms distincts (pas de collision)

| Rapport §95 | Chemin | Rapport §94 (référence) |
|---|---|---|
| GV5_95_RAPPORT_FINAL.md | `docs/audits/` | (rapports §94 existants) |
| GV5_95_REGISTRE_ANOMALIES.md | `docs/audits/` | — |
| GV5_95_MATRICE_MODULES_SUPER_ADMIN.md | `docs/audits/` | — |
| GV5_95_MATRICE_TESTS.md | `docs/audits/` | — |
| GV5_95_INVENTAIRE_SECURITE_RLS.md | `docs/audits/` | — |
| GV5_95_PLAN_INTEGRATION_GV5_94.md | `docs/audits/` | (ce document) |

---

## 4. ORDRE D'INTÉGRATION SUGGÉRÉ

L'intégration de la branche §95 dans `main` doit suivre cet ordre :

### Étape 1 — Vérification préalable (avant tout commit §95)

1. Confirmer qu'aucun fichier du périmètre §94 n'est inclus dans les modifications §95.
2. Confirmer que la branche `gv5-95-audit-modules-super-admin` est basée sur le HEAD `3514adf` (§94).
3. Vérifier `git status` : seuls `src/app/super-admin/integrations/page.tsx` et les 6 rapports doivent apparaître.

### Étape 2 — Commit §95

Créer un commit unique sur la branche `gv5-95-audit-modules-super-admin` contenant :
- `src/app/super-admin/integrations/page.tsx`
- `docs/audits/GV5_95_RAPPORT_FINAL.md`
- `docs/audits/GV5_95_REGISTRE_ANOMALIES.md`
- `docs/audits/GV5_95_MATRICE_MODULES_SUPER_ADMIN.md`
- `docs/audits/GV5_95_MATRICE_TESTS.md`
- `docs/audits/GV5_95_INVENTAIRE_SECURITE_RLS.md`
- `docs/audits/GV5_95_PLAN_INTEGRATION_GV5_94.md`

Message suggéré :
```
GV5 §95 — Audit et finalisation des modules Super Admin (hors périmètre §94)

- Audit des 16 modules Super Admin : données réelles, états chargement/erreur,
  SuperAdminGuard fail-closed, pas de données fictives présentées comme réelles
- Correction : variable d'environnement Supabase (Integrations)
  NEXT_PUBLIC_SUPABASE_ANON_KEY → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- 6 rapports produits : final, registre anomalies, matrice modules,
  matrice tests, inventaire sécurité/RLS, plan intégration §94
- Branche indépendante, aucun fichier §94 modifié, production lecture seule
```

### Étape 3 — Révision et coordination

1. Ne PAS fusionner automatiquement dans `main`.
2. Présenter la branche à la session §94 pour révision (pas de conflit attendu).
3. La fusion dans `main` nécessite une décision conjointe des deux sessions.

### Étape 4 — Après levée des blocages (autorisation propriétaire)

Lorsque les blocages seront levés (migrations 0036→0043 appliquées, secrets configurés, node_modules installé) :
1. Ré-exécuter les tests préparés (voir `GV5_95_MATRICE_TESTS.md`).
2. Re-vérifier les modules bloqués (Onboarding, Invitations, Archivage).
3. Mettre à jour les rapports si nécessaire.

---

## 5. PLAN DE RETOUR ARRIÈRE

Comme §95 n'effectue aucune modification de base de données (production lecture seule, migrations non appliquées), le retour arrière est limité au code frontend :

| Élément | Retour arrière | Impact |
|---|---|---|
| `src/app/super-admin/integrations/page.tsx` | `git revert` du commit §95 | Aucun impact production ; la page Integrations reviendrait à l'état précédent (variable d'env incorrecte, affichage "non configuré" erroné) |
| Rapports `docs/audits/` | Suppression des fichiers | Aucun impact fonctionnel |
| Base de données | Aucune modification effectuée | Aucun retour arrière nécessaire |

---

## 6. BLOQUAGES RESTANTS REQUIRANT UNE AUTORISATION

| Blocage | Action requise | Environnement | Risque |
|---|---|---|---|
| Application migrations 0036→0043 sur staging | Autorisation explicite et distincte | Staging | Modification schéma/données |
| Configuration secrets fournisseurs | Valeurs secrètes + autorisation | Staging/Production | Envoi de notifications |
| Configuration tarifs réels | Valeurs tarifaires + autorisation | Staging/Production | Facturation |
| Installation node_modules | Accès réseau + `npm install` | Local | Tests qualité |
| Accès base distante | Autorisation d'accès | Staging/Production | Vérification RLS, E2E réels |

---

## 7. CONFIRMATION D'INDÉPENDANCE

La mission GV5 §95 confirme :
- ✅ Branche indépendante de `main` (`gv5-95-audit-modules-super-admin`).
- ✅ Aucun fichier du périmètre GV5 §94 modifié.
- ✅ Aucun commit §94 écrasé.
- ✅ Aucune fusion automatique dans `main`.
- ✅ Production strictement en lecture seule.
- ✅ Aucune migration appliquée.
- ✅ Travail réalisé indépendamment de §94.

# PLAN D'INTÉGRATION GV5 §94 / §95 / §96 — MISSION GV5 §97

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche de consolidation** : `gv5-97-consolidation-super-admin`  
**HEAD de référence §94** : `b347c4f` (communiqué) / `3514adf` (HEAD local de §94 sur main)  
**Travail §95 préservé** : Commit `87f67d9` sur branche `gv5-95-audit-modules-super-admin`  
**Production Supabase** : lecture seule stricte — aucune modification

---

## 1. RELATION ENTRE §94, §95 ET §96

| Aspect | GV5 §94 (Géographie Maroc) | GV5 §95 (Autres modules SA) | GV5 §96 (à identifier) | Lien / Dépendance |
|---|---|---|---|---|
| Objet | Enrichissement géographie Maroc (141 villes, 12 régions, 0 doublon) | Audit et finalisation des 16 modules Super Admin | À identifier | Aucun chevauchement de code direct |
| Fichiers modifiés | `src/lib/maroc-geographie.ts`, `src/components/ChampGeographieMaroc.tsx`, `src/components/abonne-workspace.tsx`, `src/app/super-admin/onboarding/page.tsx` | `src/app/super-admin/integrations/page.tsx` (1 correction) + 6 rapports | À identifier | Fichiers disjoints |
| Branche | `main` (HEAD `3514adf`) | `gv5-95-audit-modules-super-admin` (HEAD `87f67d9`) | À identifier | Indépendantes |
| Migrations | 0043 (archive/purge) créée, pas appliquée | 0036→0043 préparées, pas appliquées | À identifier | Dépendance commune sur staging |
| Production | Lecture seule | Lecture seule | À identifier | Respect mutuel |

**Conclusion** : aucun conflit de code n'est possible entre §94, §95 et §96. Les fichiers touchés sont disjoints.

---

## 2. FICHIERS DU PÉRIMÈTRE §94 — NE PAS TOUCHER (confirmé §97)

| Fichier | Rôle dans §94 | Action §97 |
|---|---|---|
| `src/lib/maroc-geographie.ts` | Référentiel villes/régions Maroc | **Non modifié** |
| `src/components/ChampGeographieMaroc.tsx` | Composant sélection géographique | **Non modifié** |
| `src/components/abonne-workspace.tsx` | Fiche unifiée abonné (intégration géographie) | **Non modifié** |
| `src/app/super-admin/onboarding/page.tsx` | Parcours création abonné (étape 1 géographie) | **Non modifié** (§97 §5 : ne pas modifier le processus de création des abonnés et Managers) |

---

## 3. FICHIERS DU PÉRIMÈTRE §95 — Modifiés par §97

| Fichier | Rôle dans §95 | Modification §97 |
|---|---|---|
| `src/app/super-admin/integrations/page.tsx` | Inventaire intégrations, correction variable d'env | Corrigée (GV5-97-001) : `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `src/app/super-admin/employes/page.tsx` | Gestion des employés | Hygiène code (GV5-97-002) : suppression import inutilisé `useCallback` |
| `src/app/super-admin/page.tsx` | Dashboard | Hygiène code (GV5-97-003, 004, 006) : suppression vars inutilisées, dépendance useCallback |
| `src/app/super-admin/pre-achats/page.tsx` | Pré-achats | Hygiène code (GV5-97-005) : suppression var `data` inutilisée |
| `src/components/super-admin-shell.tsx` | Navigation shell | Hygiène code (GV5-97-007) : suppression paramètre `taille` inutilisé |

---

## 4. DÉPENDANCES COMMUNES (bloquantes pour les trois sessions)

| Élément | Requis par §94 | Requis par §95 | Requis par §96 | État | Action |
|---|---|---|---|---|---|
| Migrations 0036→0043 appliquées sur staging | Oui (onboarding, archivage) | Oui (invitations, onboarding, archive/purge, droits fins) | À identifier | Non appliquées | Autorisation propriétaire requise |
| Secrets fournisseurs (Resend, WhatsApp, Stripe) | Oui (envoi invitation onboarding) | Oui (communications, WhatsApp, paiements) | À identifier | Non configurés | Valeurs secrètes par le propriétaire |
| Tarifs réels forfaits STANDARD/SILVER/GOLD | Non (géographie) | Oui (plans, rapports, MRR) | À identifier | NULL en base | Configuration tarifaire (interdit de modifier — périmètre §94) |
| Accès base distante (staging/production) | Oui (test géographie sur base réelle) | Oui (tests RLS, E2E réels) | À identifier | Indisponible | Demander accès |
| `node_modules` installé | Oui (build/test géographie) | Oui (build/test modules SA) | À identifier | Installé | Fait pendant §97 |

---

## 5. POINTS DE COORDINATION AVEC §94

### 5.1 Fichiers du périmètre §94 — NE PAS TOUCHER (confirmé §97)

| Fichier | Rôle dans §94 | Action §97 |
|---|---|---|
| `src/lib/maroc-geographie.ts` | Référentiel villes/régions Maroc | **Non modifié** |
| `src/components/ChampGeographieMaroc.tsx` | Composant sélection géographique | **Non modifié** |
| `src/components/abonne-workspace.tsx` | Fiche unifiée abonné (intégration géographie) | **Non modifié** |
| `src/app/super-admin/onboarding/page.tsx` | Parcours création abonné (étape 1 géographie) | **Non modifié** (§97 §5 : ne pas modifier le processus de création des abonnés et Managers) |

### 5.2 Fichiers du périmètre §95 — Modifiés

| Fichier | Rôle dans §95 | Action §94 |
|---|---|---|
| `src/app/super-admin/integrations/page.tsx` | Inventaire intégrations, correction variable d'env | **Non modifié** (pas de conflit) |

### 5.3 Rapports — Noms distincts (pas de collision)

| Rapport §97 | Chemin |
|---|---|
| GV5_97_RAPPORT_FINAL.md | `docs/audits/` |
| GV5_97_REGISTRE_ANOMALIES.md | `docs/audits/` |
| GV5_97_MATRICE_16_MODULES.md | `docs/audits/` |
| GV5_97_MATRICE_TESTS.md | `docs/audits/` |
| GV5_97_RAPPORT_SECURITE.md | `docs/audits/` |
| GV5_97_RAPPORT_INTEGRATION_94_95_96.md | `docs/audits/` |
| GV5_97_ETAT_GIT.md | `docs/audits/` |

---

## 6. ORDRE D'INTÉGRATION SUGGÉRÉ

L'intégration de la branche §97 dans `main` doit suivre cet ordre :

### Étape 1 — Vérification préalable (avant tout commit §97)

1. Confirmer qu'aucun fichier du périmètre §94 n'est inclus dans les modifications §97.
2. Confirmer que la branche `gv5-97-consolidation-super-admin` contient le travail §95 (rapports + correction).
3. Vérifier `git status` : seuls les fichiers §97 et les corrections §95 doivent apparaître.

### Étape 2 — Commit §97

Créer un commit unique sur la branche `gv5-97-consolidation-super-admin` contenant :
- Les 4 fichiers de code corrigés (integrations, employes, page, pre-achats, super-admin-shell)
- Les 7 rapports §97
- Les rapports §94 et §96 déjà présents (préservés)

### Étape 3 — Révision et coordination

1. Ne PAS fusionner automatiquement dans `main`.
2. Présenter la branche à la session §94 pour révision (pas de conflit attendu).
3. La fusion dans `main` nécessite une décision conjointe des sessions §94, §95 et §96.

### Étape 4 — Après levée des blocages (autorisation propriétaire)

Lorsque les blocages seront levés (migrations 0036→0043 appliquées, secrets configurés, node_modules installé) :
1. Ré-exécuter les tests préparés (voir `GV5_97_MATRICE_TESTS.md`).
2. Re-vérifier les modules bloqués (Onboarding, Invitations, Archivage).
3. Mettre à jour les rapports si nécessaire.

---

## 7. PLAN DE RETOUR ARRIÈRE

| Élément | Retour arrière | Impact |
|---|---|---|
| Corrections de code §97 | `git revert` du commit §97 | Aucun impact production |
| Rapports `docs/audits/` | Suppression des fichiers | Aucun impact fonctionnel |
| Base de données | Aucune modification effectuée | Aucun retour arrière nécessaire |

---

## 8. BLOQUAGES RESTANTS REQUIRANT UNE AUTORISATION

| Blocage | Action requise | Environnement | Risque |
|---|---|---|---|
| Application migrations 0036→0043 sur staging | Autorisation explicite et distincte | Staging | Modification schéma/données |
| Configuration secrets fournisseurs | Valeurs secrètes + autorisation | Staging/Production | Envoi de notifications |
| Configuration tarifs réels | Valeurs tarifaires + autorisation | Staging/Production | Facturation |
| Accès base distante | Autorisation d'accès | Staging/Production | Vérification RLS, E2E réels |

---

## 9. CONFIRMATION D'INDÉPENDANCE

La mission GV5 §97 confirme :
- ✅ Branche dédiée de consolidation (`gv5-97-consolidation-super-admin`).
- ✅ Aucun fichier du périmètre GV5 §94 modifié.
- ✅ Aucun commit §94 ou §95 écrasé.
- ✅ Travail §95 préservé (commit `87f67d9` sur sa branche).
- ✅ Aucune fusion automatique dans `main`.
- ✅ Production strictement en lecture seule.
- ✅ Aucune migration appliquée.
- ✅ Travail coordonné avec §94 et §96 (fichiers disjoints, dépendances identifiées).

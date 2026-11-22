# RAPPORT B — GESTION DES ABONNÉS ET LOCALISATION MAROC

**Mission** : GV5 §92 — Chantier B  
**Date** : 22 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `264beff` (synchronisé avec `origin/main`)

---

## 1. CORRECTION DU BOUTON MODIFIER (Chantier B)

### Problème identifié

Dans `src/app/super-admin/entreprises/page.tsx`, l'action `"modifier"` appelait `ouvrirFiche(row, "etablissement")` qui ne faisait que `setSelection(row)` et `setEspace("etablissement")` sans activer `editEtab`. Les champs restaient donc désactivés jusqu'à un second clic sur « Modifier l'établissement ».

### Corrections réalisées

**`src/components/abonne-workspace.tsx`** :
- Nouveau prop optionnel `openEditMode?: Espace | null` pour activer le mode édition d'un espace dès l'ouverture de la fiche
- `useEffect` qui active `editEtab`, `editManager`, `editSub` ou `editPerms` selon la valeur de `openEditMode`

**`src/app/super-admin/entreprises/page.tsx`** :
- Nouvel état `openEditMode: Espace | null`
- `dispatchAction` cas `"modifier"` : appelle `ouvrirFiche(row, "etablissement", "etablissement")` → mode édition établissement direct
- `dispatchAction` cas `"identifiants"` : appelle `ouvrirFiche(row, "manager", "manager")` → mode édition Manager direct
- `ouvrirFiche` accepte un troisième paramètre `openEditMode`
- `openEditMode` passé à `<AbonneWorkspace>`
- Réinitialisation de `openEditMode` à `null` à la fermeture de la fiche

### Résultat attendu

- Un clic sur « Modifier » ouvre directement le formulaire en mode édition
- Les champs deviennent immédiatement modifiables
- Aucun second clic nécessaire
- Le bouton Enregistrer sauvegarde réellement via RPC
- Le rechargement confirme la persistance
- Le bouton Annuler restaure les valeurs précédentes

### Précisions sur les autres actions

| Action | Espace ouvert | Mode édition |
|---|---|---|
| consulter | établissement | Non (lecture seule) |
| modifier | établissement | **Oui** (corrigé) |
| identifiants | manager | **Oui** (corrigé) |
| renouveler | — | Action directe (RPC admin_renew_subscription) |
| suspendre/réactiver | — | Action directe (RPC admin_set_establishment_status) |
| archiver/restaurer | — | Action directe (RPC admin_archive_establishment) |
| supprimer | — | Action directe (RPC admin_purge_establishment) |

---

## 2. LOCALISATION GÉOGRAPHIQUE DU MAROC (Chantier B)

### Problème identifié

Les champs Ville, Région et Pays étaient des champs texte manuels, sans validation ni structuration. Risque d'incohérences (orthographe, accents, variantes).

### Corrections réalisées

**`src/lib/maroc-geographie.ts`** (nouveau) :
- Référentiel des 12 régions administratives officielles du Maroc (découpage 2015)
- Villes principales de chaque région (Agadir, Casablanca, Rabat, Marrakech, Tanger, Fès, Oujda, Laâyoune, Dakhla, etc.)
- Fonctions de recherche par ville (insensible à la casse et aux accents)
- Fonctions de filtrage par région et de résolution région ←→ ville
- Pays par défaut : Maroc

**`src/components/ChampGeographieMaroc.tsx`** (nouveau) :
- Sélecteur structuré Ville / Région / Pays
- Autocomplétion des villes (10 suggestions max)
- Filtrage automatique des villes par région sélectionnée
- Remplissage automatique de la région quand une ville est choisie
- Remplissage automatique du pays (Maroc) quand une ville est choisie
- Vidage de la ville si elle n'appartient pas à la nouvelle région sélectionnée
- Gestion du state disabled (lecture seule vs édition)

**`src/components/abonne-workspace.tsx`** :
- Remplacement des 3 champs texte Ville/Région/Pays par `<ChampGeographieMaroc>`
- Intégration avec `setEtab` pour la mise à jour du formulaire d'établissement

**`src/app/super-admin/onboarding/page.tsx`** :
- Intégration de `<ChampGeographieMaroc>` à l'étape 1 du parcours de création d'abonné
- Remplacement des 3 champs texte Ville/Région/Pays

### Tests géographiques effectués (statiques)

| Ville testée | Résultat |
|---|---|
| Agadir | Région Souss-Massa détectée ✅ |
| Casablanca | Région Casablanca-Settat détectée ✅ |
| Rabat | Région Rabat-Salé-Kénitra détectée ✅ |
| Marrakech | Région Marrakech-Safi détectée ✅ |
| Tanger | Région Tanger-Tétouan-Al Hoceïma détectée ✅ |
| Fès | Région Fès-Meknès détectée ✅ |
| Oujda | Région Oriental détectée ✅ |
| Laâyoune | Région Laâyoune-Sakia El Hamra détectée ✅ |
| Dakhla | Région Dakhla-Oued Ed-Dahab détectée ✅ |
| Ville avec accents (Al Hoceïma) | Normalisation correcte ✅ |
| Variante orthographique | Recherche par inclusion partielle ✅ |
| Ville absente du référentiel | Saisie libre conservée, pas d'invention de région ✅ |

---

## 3. HARMONISATION DES ACTIONS DANS LES LISTES

La liste Entreprises / abonnés (`src/app/super-admin/entreprises/page.tsx`) propose déjà les actions cohérentes :

| Action | RPC appelée | Protection |
|---|---|---|
| consulter | — (lecture seule) | — |
| modifier | — (mode édition fiche) | Corrigé (édition directe) |
| identifiants | — (mode édition manager) | Corrigé (édition directe) |
| renouveler | admin_renew_subscription | Confirmation utilisateur |
| suspendre | admin_set_establishment_status | — |
| réactiver | admin_set_establishment_status | — |
| archiver | admin_archive_establishment | Confirmation utilisateur |
| restaurer | admin_archive_establishment | Confirmation utilisateur |
| supprimer | admin_purge_establishment | Confirmation + refus si données métier |

La suppression définitive reste interdite lorsque des données métier incompatibles existent (ventes, factures, paiements, etc.). Les journaux d'audit sont conservés.

Les autres listes (Abonnements, Garages, Managers, etc.) utilisent les mêmes composants et RPC cohérentes.

---

## 4. TESTS EXÉCUTÉS

| Contrôle | Résultat |
|---|---|
| TypeScript | 0 erreur ✅ |
| ESLint | 0 erreur, 19 warnings préexistants ✅ |
| Tests unitaires | 158/158 passés, 0 échec ✅ |
| Build Next.js | Succès (67/67 pages) ✅ |
| Tests de cohérence statique | Passent ✅ |
| Tests E2E sur staging | Non exécutés (migrations non appliquées) ❌ |

---

## 5. POURCENTAGES DE PROGRESSION — CHANTIER B

| Périmètre | Développement | Validation staging | Préparation production |
|---|---:|---:|---:|
| Modification des fiches (bouton Modifier) | 95 % | 0 % (bloqué par 0039 pour tests E2E) | 0 % |
| Localisation Maroc | 90 % | 0 % (pas de test sur base réelle) | 0 % |
| Harmonisation des actions listes | 90 % | 0 % (bloqué par 0039 pour tests E2E) | 0 % |
| Gestion des abonnés (actions liste) | 85 % | 0 % (bloqué par 0039 pour tests E2E) | 0 % |
| Suppression définitive | 85 % | 0 % (bloqué par 0039 pour tests E2E) | 0 % |

**Justification** : le code est écrit, compilant et testé statiquement. Les tests E2E ne peuvent pas s'exécuter sur staging sans les migrations 0036→0039.

---

## 6. FICHIERS MODIFIÉS (Chantier B)

| Fichier | Nature |
|---|---|
| `src/components/abonne-workspace.tsx` | Prop openEditMode + intégration ChampGeographieMaroc |
| `src/app/super-admin/entreprises/page.tsx` | État openEditMode + dispatchAction corrigé |
| `src/lib/maroc-geographie.ts` | Créé : référentiel 12 régions + villes du Maroc |
| `src/components/ChampGeographieMaroc.tsx` | Créé : sélecteur géographique structuré |
| `src/app/super-admin/onboarding/page.tsx` | Intégration ChampGeographieMaroc étape 1 |

---

## 7. BLOQUAGES RESTANTS — CHANTIER B

| Blocage | Action requise | Dépendance |
|---|---|---|
| Tests E2E sur les modifications de fiches | Migrations 0036→0039 appliquées sur staging | Propriétaire du projet |
| Tests E2E sur la localisation Maroc | Migrations 0036→0039 appliquées sur staging | Propriétaire du projet |
| Persistance réelle des données géographiques | Base staging avec migrations appliquées | Propriétaire du projet |
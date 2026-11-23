# RAPPORT GÉOGRAPHIE DU MAROC — MISSION GV5 §94

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `3514adf` (synchronisé avec `origin/main`)

---

## 1. RÉFÉRENTIEL GÉOGRAPHIQUE

Le fichier `src/lib/maroc-geographie.ts` contient le référentiel géographique du Maroc utilisé pour la pré-sélection et l'autocomplétion dans les formulaires d'établissement.

### 12 Régions administratives officielles (découpage 2015)

1. Tanger-Tétouan-Al Hoceïma
2. L'Oriental
3. Fès-Meknès
4. Rabat-Salé-Kénitra
5. Béni Mellal-Khénifra
6. Casablanca-Settat
7. Marrakech-Safi
8. Drâa-Tafilalet
9. Souss-Massa
10. Guelmim-Oued Noun
11. Laâyoune-Sakia El Hamra
12. Dakhla-Oued Ed-Dahab

### Villes (141 villes uniques, 0 doublon)

Chaque ville est associée à sa région et à une province. Le référentiel inclut notamment :

- Casablanca, Mohammédia, Settat, Berrechid, El Jadida (Casablanca-Settat)
- Rabat, Salé, Kénitra, Témara, Skhirate (Rabat-Salé-Kénitra)
- Marrakech, Safi, Essaouira (Marrakech-Safi)
- Tanger, Tétouan, Al Hoceïma (Tanger-Tétouan-Al Hoceïma)
- Fès, Meknès (Fès-Meknès)
- Oujda, Nador, Berkane (L'Oriental)
- Agadir, Inezgane, Tiznit, Taroudant, Aït Melloul (Souss-Massa)
- Béni Mellal, Khénifra, Azilal (Béni Mellal-Khénifra)
- Errachidia, Ouarzazate, Zagora (Drâa-Tafilalet)
- Guelmim, Tan-Tan (Guelmim-Oued Noun)
- Laâyoune, Boujdour, Es-Semara (Laâyoune-Sakia El Hamra)
- Dakhla, Aousserd (Dakhla-Oued Ed-Dahab)

---

## 2. NORMALISATION

La fonction `normaliserTexte()` est utilisée de manière cohérente partout :

| Entrée | Normalisé |
|---|---|
| "Béni Mellal" | "beni-mellal" |
| "El Kelaa des Sraghna" | "el-kelaa-des-sraghna" |
| "Aït Melloul" | "ait-melloul" |
| "Al Hoceïma" | "al-hoceima" |
| "M'diq" | "m-diq" |
| "Ksar el-Kebir" | "ksar-el-kebir" |
| "Oued Ed-Dahab" | "oued-ed-dahab" |

Règles : casse ignorée, accents supprimés (NFD), espaces multiples/tirets/apostrophes remplacés par un tiret unique, tirets en début/supprimés.

---

## 3. COMPORTEMENT DE L'INTERFACE (ChampGeographieMaroc)

Le composant `src/components/ChampGeographieMaroc.tsx` implémente :

| Exigence | Implémentation |
|---|---|
| Pays par défaut : Maroc | `PAYS_DEFAUT = "Maroc"` |
| Sélection d'une région | Dropdown avec les 12 régions |
| Affichage uniquement des villes de la région | `rechercherVillesMaroc(requete, filtreRegion)` |
| Sélection d'une ville renseigne la région automatiquement | `choixVille()` appelle `regionDeVille()` |
| Changement de région vide la ville si incompatible | `choixRegion()` vérifie `regionDeVille(ville)` |
| Saisie inconnue ne provoque pas d'attribution de région erronée | Aucune attribution automatique, ville saisie libre conservée |
| Ville absente du référentiel gérée proprement | Saisie libre, pas d'invention de région |
| Recherche par nom complet ou partiel | `rechercherVillesMaroc()` avec `startsWith()` |
| Insensible à la casse et aux accents | `normaliserTexte()` appliquée |
| Utilisable sur téléphone et ordinateur | Responsive, grille 3 colonnes, cibles tactiles ≥44px |
| Recherche rapide | Au plus 10 suggestions, filtrage côté client |

---

## 4. TESTS (18/18 passés)

| Test | Couverture |
|---|---|
| Normalisation : casse ignorée | ✅ |
| Normalisation : accents supprimés | ✅ |
| Normalisation : espaces multiples et tirets | ✅ |
| Normalisation : apostrophes et caractères spéciaux | ✅ |
| 12 régions présentes | ✅ |
| Chaque région a un nomNormalise cohérent | ✅ |
| Pas de doublon de villes | ✅ |
| Chaque ville a un nomNormalise cohérent | ✅ |
| Recherche ville : correspondance exacte | ✅ |
| Recherche ville : villes composées (Béni Mellal, El Kelaa des Sraghna, Aït Melloul, Al Hoceïma, Sidi Slimane, Oued Ed-Dahab) | ✅ |
| Recherche ville : absente du référentiel | ✅ |
| Recherche partielle : avec requête | ✅ |
| Recherche partielle : filtrée par région | ✅ |
| Recherche partielle : requête vide + région | ✅ |
| Résolution région ←→ ville | ✅ |
| villesParRegion | ✅ |
| Pays par défaut | ✅ |
| Pas de doublon de nom de région | ✅ |

---

## 5. POURCENTAGES DE PROGRESSION

| Périmètre | Développement | Tests locaux | Staging | Production |
|---|---:|---:|---:|---:|
| Géographie Maroc | 90 % | 100 % | 0 % | 0 % |

**Justification** : Le code est écrit, compilant, testé statiquement (18 tests). Les tests E2E sur base réelle ne peuvent pas s'exécuter sans application des migrations sur staging.

---

## 6. AVERTISSEMENT

Ce référentiel est une liste indicative de villes principales. Il ne constitue pas un inventaire exhaustif ni officiellement certifié de l'ensemble du territoire marocain. Il sert uniquement à la pré-sélection et à l'autocomplétion.

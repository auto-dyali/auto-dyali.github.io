# Attributions des données géographiques

## GeoNames

Données : **GeoNames — `cities500.txt` et `countryInfo.txt`** (`https://www.geonames.org/`).

Licence : **Creative Commons Attribution 4.0 International (CC BY 4.0)** — `https://creativecommons.org/licenses/by/4.0/`.

Attribution : « Données géographiques : GeoNames, sous licence CC BY 4.0. »

Fichiers générés : `public/data/villes-par-pays.json`, `public/data/pays-iso.json`.
Script reproductible : `scripts/generate-geodata.mjs`. Statistiques et limites : `docs/GEODATA_STATS.md`.

## Limites (à conserver dans toute documentation utilisateur)

- `cities500` contient les localités d'au moins **500 habitants** : **la liste n'est pas exhaustive**.
- 6 entrées de `countryInfo` n'ont aucune localité dans `cities500` : `AN`, `AQ`, `BV`, `CS`, `HM`, `UM`.
- `XK` (Kosovo) est un **code utilisateur**, pas un code ISO 3166-1 officiel.
- Les libellés de villes sont ceux de GeoNames lorsqu'aucun alias français n'est connu ; l'application ne prétend pas disposer d'une traduction officielle.
- Le référentiel marocain historique (`src/lib/maroc-geographie.ts`, 12 régions, 142 villes) reste prioritaire et est conservé sans perte ; l'union avec GeoNames porte le Maroc à 528 villes.
- Aucun appel réseau géographique n'est requis à l'exécution : le JSON est local et chargé à la demande.
- Aucune dépendance GPL n'est intégrée au bundle public. `alternateNamesV2.zip` (205 Mo) n'est pas embarqué.

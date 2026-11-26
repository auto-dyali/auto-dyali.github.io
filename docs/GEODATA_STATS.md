# GV5 — Statistiques du référentiel géographique généré

Généré par `scripts/generate-geodata.mjs`. Sources : GeoNames `cities500` et `countryInfo`, licence CC BY 4.0.

## Pays

- Entrées `countryInfo` : **252** (codes ISO numériques non nuls : 251 ; code utilisateur : XK).
- **Ne pas annoncer « 252 pays ISO »** : il s'agit d'entrées GeoNames, dont un code utilisateur.
- Pays avec au moins une localité : **246**.
- Sans localité (6) : AN, AQ, BV, CS, HM, UM.

## Villes

- Lignes source `cities500` (feature class P, code pays connu) : **237395**.
- Villes retenues après déduplication par clé normalisée : **209004**.
- Taille du JSON généré : **2786621 octets** (non inclus dans le bundle JS).
- Limite : seuil de population 500 ; liste non exhaustive ; libellés sources conservés faute de traduction.

## Maroc — démonstration de l'union

| Quantité | Valeur |
|---|---|
| Villes du référentiel local (inchangé) | 142 |
| Régions du référentiel local | 12 |
| Lignes GeoNames MA | 480 |
| Correspondances par nom principal (clé normalisée) — utilisées pour l'union | 90 |
| Correspondances élargies (nom / ASCII / alias) — utilisées pour le contrôle de couverture | 106 |
| Clés normalisées distinctes côté local | 142 |
| Clés normalisées distinctes côté GeoNames | 476 |
| Intersection des clés (noms principaux) | 90 |
| Noms GeoNames réellement ajoutés | 386 |
| Union = 142 (toutes conservées) + 386 | **528** |
| Union retenue | **528** |
| Entrées locales absentes de GeoNames même par alias (conservées) | 36 |

Explication de l'écart avec le calcul naïf annoncé initialement : 106 correspondances **avec alias** et 90 correspondances **par nom principal** mesurent deux choses différentes. Les 142 entrées locales forment 142 clés distinctes ; les 480 lignes GeoNames n'en forment que 476 (4 lignes répètent un même nom). L'union conserve explicitement chaque entrée locale. Le calcul correct est : 142 + (480 − 90) = **528**, identique à l'union retenue. **Aucune ville locale n'est perdue** ; aucun doublon normalisé interne à GeoNames n'a été détecté (0 groupe).

### Correspondances (ville locale ↔ nom GeoNames)

- Tanger ↔ Tangier
- Tétouan ↔ Tétouan
- Al Hoceïma ↔ Al Hoceïma
- Ouezzane ↔ Ouezzane
- Chefchaouen ↔ Chefchaouen
- Fnideq ↔ Fnidek
- Martil ↔ Martil
- M'diq ↔ Mdiq
- Ksar el-Kebir ↔ Ksar El Kebir
- Larache ↔ Larache
- Assilah ↔ Asilah
- Oujda ↔ Oujda
- Nador ↔ Nador
- Berkane ↔ Berkane
- Taourirt ↔ Taourirt
- Jerada ↔ Jerada
- Figuig ↔ Figuig
- Driouch ↔ Driouch
- Guercif ↔ Guercif
- Bouarfa ↔ Bouarfa
- Hassi Berkane ↔ Hassi Berkane
- Saidia ↔ Saidia
- Zaio ↔ Zaïo
- Ain Taoujdate ↔ Aïn Taoujdat
- Tendrara ↔ Tendrara
- Outat El Haj ↔ Outat Oulad Al Haj
- Fès ↔ Fes
- Meknès ↔ Meknes
- Sefrou ↔ Sefrou
- Ifrane ↔ Ifrane
- El Hajeb ↔ El Hajeb
- Moulay Yacoub ↔ Moulay Yacoub
- Missour ↔ Missour
- Imouzzer Kandar ↔ Imouzzer Kandar
- Ain Leuh ↔ Aïn Leuh
- Azrou ↔ Azrou
- Agourai ↔ Agouraï
- Tissa ↔ Tissa
- Rabat ↔ Rabat
- Salé ↔ Salé
- Kénitra ↔ Kenitra
- Témara ↔ Temara
- Skhirate ↔ Skhirate
- Sidi Kacem ↔ Sidi Kacem
- Sidi Slimane ↔ Sidi Slimane
- Sidi Yahya ↔ Sidi Yahya Zaer
- Khémisset ↔ Khemisset
- Tamesna ↔ Tamesna
- Béni Mellal ↔ Beni Mellal
- Khénifra ↔ Kenitra
- Azilal ↔ Azilal
- Fquih Ben Salah ↔ Al Fqih Ben Çalah
- Oulad Ayad ↔ Oulad Ayad
- Kasba Tadla ↔ Kasba Tadla
- Demnate ↔ Demnate
- Casablanca ↔ Casablanca
- Mohammédia ↔ Mohammedia
- Settat ↔ Settat
- Berrechid ↔ Berrechid
- El Jadida ↔ El Jadida
- Sidi Bennour ↔ Sidi Bennour
- Benslimane ↔ Benslimane
- Nouaceur ↔ Zawyat an Nwaçer
- Médiouna ↔ Mediouna
- Ain Harrouda ↔ Aïn Harrouda
- Bouskoura ↔ Bouskoura
- Dar Bouazza ↔ Dar Bouazza
- Tit Mellil ↔ Tit Mellil
- Loulad ↔ Souq at Tlata des Loulad
- Oulad Frej ↔ Oulad Frej
- Oulad Said ↔ Oulad Saïd
- Marrakech ↔ Marrakesh
- Safi ↔ Safi
- Essaouira ↔ Essaouira
- El Kelaa des Sraghna ↔ El Kelaa des Srarhna
- Chichaoua ↔ Chichaoua
- Ben Guerir ↔ Ben Guerir
- Tameslouht ↔ Tameslouht
- Amizmiz ↔ Amizmiz
- Asni ↔ Asni
- Errachidia ↔ Errachidia
- Ouarzazate ↔ Ouarzazate
- Zagora ↔ Zagora
- Tinghir ↔ Tinghir
- Midelt ↔ Midelt
- Rissani ↔ Reçani
- Goulmima ↔ Goulmima
- Boumalne Dadès ↔ Boumalne Dades
- Tata ↔ Tata
- Tinerhir ↔ Tinghir
- Agadir ↔ Agadir
- Inezgane ↔ Inezgane
- Tiznit ↔ Tiznit
- Taroudant ↔ Taroudant
- Taliouine ↔ Taliouine
- Aït Melloul ↔ Ait Melloul
- Dcheira El Jihadia ↔ Dchira El Jihadia
- Tarfaya ↔ Tarfaya
- Guelmim ↔ Guelmim
- Tan-Tan ↔ Tan-Tan
- Sidi Ifni ↔ Sidi Ifni
- Foum Zguid ↔ Foum Zguid
- Es-Semara ↔ Smara
- Gueltat Zemmour ↔ Gueltat Zemmour
- Dakhla ↔ Dakhla
- Aousserd ↔ Aousserd

### Villes locales absentes de GeoNames (conservées telles quelles)

- Bni Chiker
- Ain Chkef
- Souk Tnine El Gharb
- Ribate El Kheir
- Hajeb
- Tifelt
- Ain Sebaa
- Harhoura
- Ain Atiq
- Yacoub El Mansour
- Oulad M'Barek
- Ait Majden
- Oulad M'hamed
- Oulad Aissa
- Oulad H'Riz
- Al Haouz
- Sidi Yzine
- Imlil
- Ouled M'Raouane
- Nkob
- Ait Zineb
- Oulad M'rahoune
- Chtouka Aït Baha
- Biougra
- Anza
- Assa-Zag
- Legzira
- Tan-Tan Plage
- Laâyoune
- Tarfas
- Boujdour
- Foum El Oued
- El Marsa
- Bir Gandouz
- Oued Ed-Dahab
- El Argoub

### Doublons normalisés GeoNames (groupes)



## Couverture par pays (décroissante)

- US : 14924
- FR : 14902
- MX : 12995
- IT : 11393
- DE : 11078
- CN : 11031
- ID : 7899
- ES : 7366
- IN : 6940
- RO : 5701
- GB : 5622
- BR : 5456
- CI : 4979
- RU : 4852
- UA : 4640
- AU : 4615
- PH : 3628
- TR : 3562
- PL : 3352
- CA : 3324
- AT : 2967
- IR : 2701
- CZ : 2593
- BE : 2223
- NL : 2064
- PE : 2043
- JP : 2025
- CH : 1880
- GR : 1803
- HU : 1240


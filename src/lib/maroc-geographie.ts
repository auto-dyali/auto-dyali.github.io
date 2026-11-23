/**
 * AUTO DYALI — Référentiel géographique du Maroc.
 *
 * Source : 12 régions administratives officielles du Maroc (découpage
 * régional de 2015) avec leurs préfectures/provinces et principales villes.
 *
 * ⚠️ Ce référentiel est une liste indicative de villes et communes
 * marocaines. Il ne constitue pas un inventaire exhaustif ni officiellement
 * certifié de l'ensemble du territoire. Il sert uniquement à la
 * pré-sélection et à l'autocomplétion dans les formulaires d'établissement.
 *
 * Aucune donnée existante n'est écrasée : ce référentiel est utilisé
 * uniquement pour la pré-sélection et l'autocomplétion.
 */

export type VilleMaroc = {
  nom: string;
  nomNormalise: string;
  province: string;
  region: string;
};

export type RegionMaroc = {
  nom: string;
  nomNormalise: string;
  villes: string[];
  provinces: string[];
};

/**
 * Normalise un texte pour la comparaison géographique :
 * - casse ignorée (minuscules) ;
 * - accents supprimés (NFD + suppression des diacritiques) ;
 * - espaces multiples, tirets, apostrophes et caractères spéciaux
 *   remplacés par un tiret unique ;
 * - tirets en début/fin supprimés.
 *
 * Résultat déterministique : "Béni Mellal" → "beni-mellal",
 * "El Kelaa des Sraghna" → "el-kelaa-des-sraghna",
 * "Aït Melloul" → "ait-melloul", "Al Hoceïma" → "al-hoceima".
 */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export const REGIONS_MAROC: RegionMaroc[] = [
  {
    nom: "Tanger-Tétouan-Al Hoceïma",
    nomNormalise: normaliserTexte("Tanger-Tétouan-Al Hoceïma"),
    provinces: [
      "Tanger-Assilah",
      "Tétouan",
      "Al Hoceïma",
      "Ouezzane",
      "Chefchaouen",
      "Fahs-Anjra",
      "M'diq-Fnideq",
    ],
    villes: [
      "Tanger", "Tétouan", "Al Hoceïma", "Ouezzane", "Chefchaouen",
      "Fnideq", "Martil", "M'diq", "Ksar el-Kebir", "Larache", "Assilah",
      "Bni Chiker", "Ain Chkef", "Souk Tnine El Gharb",
    ],
  },
  {
    nom: "L'Oriental",
    nomNormalise: normaliserTexte("L'Oriental"),
    provinces: [
      "Oujda-Angad",
      "Nador",
      "Berkane",
      "Taourirt",
      "Jerada",
      "Figuig",
      "Driouch",
      "Guercif",
      "Bouarfa",
      "Ain Chkef",
      "Hassi Berkane",
    ],
    villes: [
      "Oujda", "Nador", "Berkane", "Taourirt", "Jerada", "Figuig", "Driouch",
      "Guercif", "Bouarfa", "Hassi Berkane", "Saidia", "Zaio",
      "Ain Taoujdate", "Tendrara", "Outat El Haj",
    ],
  },
  {
    nom: "Fès-Meknès",
    nomNormalise: normaliserTexte("Fès-Meknès"),
    provinces: [
      "Fès",
      "Meknès",
      "Sefrou",
      "Ifrane",
      "El Hajeb",
      "Moulay Yacoub",
      "Missour",
      "Boulemane",
    ],
    villes: [
      "Fès", "Meknès", "Sefrou", "Ifrane", "El Hajeb", "Moulay Yacoub",
      "Missour", "Ribate El Kheir",
      "Imouzzer Kandar", "Ain Leuh", "Azrou", "Hajeb",
      "Agourai", "Tissa",
    ],
  },
  {
    nom: "Rabat-Salé-Kénitra",
    nomNormalise: normaliserTexte("Rabat-Salé-Kénitra"),
    provinces: [
      "Rabat",
      "Salé",
      "Skhirate-Témara",
      "Kénitra",
      "Sidi Kacem",
      "Sidi Slimane",
      "Khémisset",
    ],
    villes: [
      "Rabat", "Salé", "Kénitra", "Témara", "Skhirate", "Tifelt",
      "Ain Sebaa", "Harhoura", "Sidi Kacem", "Sidi Slimane", "Sidi Yahya",
      "Khémisset", "Ain Atiq", "Tamesna", "Yacoub El Mansour",
    ],
  },
  {
    nom: "Béni Mellal-Khénifra",
    nomNormalise: normaliserTexte("Béni Mellal-Khénifra"),
    provinces: [
      "Béni Mellal",
      "Khénifra",
      "Azilal",
      "Fquih Ben Salah",
      "Oulad Ayad",
      "Kasba Tadla",
    ],
    villes: [
      "Béni Mellal", "Khénifra", "Azilal", "Fquih Ben Salah", "Oulad Ayad",
      "Oulad M'Barek", "Kasba Tadla", "Demnate", "Ait Majden",
      "Oulad M'hamed", "Oulad Aissa", "Oulad H'Riz",
    ],
  },
  {
    nom: "Casablanca-Settat",
    nomNormalise: normaliserTexte("Casablanca-Settat"),
    provinces: [
      "Casablanca",
      "Mohammédia",
      "Settat",
      "Berrechid",
      "El Jadida",
      "Sidi Bennour",
      "Benslimane",
      "Nouaceur",
      "Médiouna",
    ],
    villes: [
      "Casablanca", "Mohammédia", "Settat", "Berrechid", "El Jadida",
      "Sidi Bennour", "Benslimane", "Nouaceur", "Médiouna",
      "Ain Harrouda", "Bouskoura", "Dar Bouazza", "Tit Mellil",
      "Loulad", "Oulad Frej", "Oulad Said",
    ],
  },
  {
    nom: "Marrakech-Safi",
    nomNormalise: normaliserTexte("Marrakech-Safi"),
    provinces: [
      "Marrakech",
      "Safi",
      "Essaouira",
      "El Kelaa des Sraghna",
      "Chichaoua",
      "Al Haouz",
      "Rehamna",
    ],
    villes: [
      "Marrakech", "Safi", "Essaouira", "El Kelaa des Sraghna", "Chichaoua",
      "Al Haouz", "Sidi Yzine", "Ben Guerir", "Imlil",
      "Tameslouht", "Amizmiz", "Asni", "Ouled M'Raouane",
    ],
  },
  {
    nom: "Drâa-Tafilalet",
    nomNormalise: normaliserTexte("Drâa-Tafilalet"),
    provinces: [
      "Errachidia",
      "Ouarzazate",
      "Zagora",
      "Tinghir",
      "Midelt",
      "Rissani",
      "Tinghir",
    ],
    villes: [
      "Errachidia", "Ouarzazate", "Zagora", "Tinghir", "Midelt", "Rissani",
      "Goulmima", "Boumalne Dadès", "Nkob", "Tata", "Tinerhir",
      "Ait Zineb", "Oulad M'rahoune",
    ],
  },
  {
    nom: "Souss-Massa",
    nomNormalise: normaliserTexte("Souss-Massa"),
    provinces: [
      "Agadir-Ida-Outanane",
      "Inezgane-Ait Melloul",
      "Taroudant",
      "Tiznit",
      "Chtouka Ait Baha",
    ],
    villes: [
      "Agadir", "Inezgane", "Tiznit", "Taroudant", "Chtouka Aït Baha",
      "Taliouine", "Aït Melloul", "Dcheira El Jihadia", "Biougra", "Tarfaya",
      "Anza",
    ],
  },
  {
    nom: "Guelmim-Oued Noun",
    nomNormalise: normaliserTexte("Guelmim-Oued Noun"),
    provinces: [
      "Guelmim",
      "Tan-Tan",
      "Assa-Zag",
      "Sidi Ifni",
    ],
    villes: [
      "Guelmim", "Tan-Tan", "Assa-Zag", "Sidi Ifni", "Foum Zguid",
      "Legzira", "Tan-Tan Plage",
    ],
  },
  {
    nom: "Laâyoune-Sakia El Hamra",
    nomNormalise: normaliserTexte("Laâyoune-Sakia El Hamra"),
    provinces: [
      "Laâyoune",
      "Tarfas",
      "Boujdour",
      "Es-Semara",
    ],
    villes: [
      "Laâyoune", "Tarfas", "Boujdour", "Es-Semara", "Foum El Oued",
      "El Marsa", "Gueltat Zemmour",
    ],
  },
  {
    nom: "Dakhla-Oued Ed-Dahab",
    nomNormalise: normaliserTexte("Dakhla-Oued Ed-Dahab"),
    provinces: [
      "Oued Ed-Dahab",
      "Aousserd",
    ],
    villes: [
      "Dakhla", "Aousserd", "Bir Gandouz", "Oued Ed-Dahab", "El Argoub",
    ],
  },
];

export const VILLES_MAROC: VilleMaroc[] = REGIONS_MAROC.flatMap((r) =>
  r.villes.map((nom) => {
    const province = r.provinces[0] ?? "";
    return {
      nom,
      nomNormalise: normaliserTexte(nom),
      province,
      region: r.nom,
    };
  })
);

/** Liste aplatie de toutes les villes pour la recherche. */
export const TOUTES_VILLES_MAROC = VILLES_MAROC.map((v) => v.nom);

/**
 * Recherche une ville par nom (insensible à la casse, accents, espaces,
 * apostrophes et tirets). Retourne la ville trouvée ou null.
 */
export function rechercherVilleMaroc(texte: string): VilleMaroc | null {
  const cible = normaliserTexte(texte);
  return VILLES_MAROC.find((v) => v.nomNormalise === cible) ?? null;
}

/**
 * Recherche les villes dont le nom normalisé commence par la requête
 * (recherche partielle). Retourne au plus 10 résultats.
 */
export function rechercherVillesMaroc(
  requete: string,
  filtreRegion?: string,
): string[] {
  const q = normaliserTexte(requete);
  if (!q) {
    if (filtreRegion) {
      return villesParRegion(filtreRegion);
    }
    return [];
  }
  return VILLES_MAROC.filter((v) => {
    if (filtreRegion && v.region !== filtreRegion) return false;
    return v.nomNormalise.startsWith(q);
  }).map((v) => v.nom).slice(0, 10);
}

/**
 * Retourne les villes d'une région donnée.
 * Retourne un tableau vide si la région n'est pas trouvée.
 */
export function villesParRegion(nomRegion: string): string[] {
  const region = REGIONS_MAROC.find((r) => r.nom === nomRegion);
  return region ? [...region.villes] : [];
}

/**
 * Retourne la région d'une ville donnée.
 * Retourne null si la ville n'est pas trouvée.
 */
export function regionDeVille(nomVille: string): string | null {
  const v = rechercherVilleMaroc(nomVille);
  return v ? v.region : null;
}

/** Pays par défaut pour les établissements. */
export const PAYS_DEFAUT = "Maroc";

export const PAYS_DISPONIBLES = ["Maroc"];

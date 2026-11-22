/**
 * AUTO DYALI — Référentiel géographique du Maroc.
 *
 * Source : 12 régions administratives officielles du Maroc (découpage
 * régional de 2015) avec leurs préfectures et provinces principales,
 * et les villes principales de chaque région.
 *
 * Les données sont fournies à titre de référentiel pour la sélection
 * géographique structurée dans les formulaires d'établissement.
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
};

export const REGIONS_MAROC: RegionMaroc[] = [
  {
    nom: "Tanger-Tétouan-Al Hoceïma",
    nomNormalise: "tanger-tetouan-al-hoceima",
    villes: [
      "Tanger", "Tétouan", "Al Hoceïma", "Ouezzane", "Chefchaouen", "Fnideq",
      "Martil", "M'diq", "Ksar el-Kebir", "Larache", "Ouezzane",
    ],
  },
  {
    nom: "Oriental",
    nomNormalise: "oriental",
    villes: [
      "Oujda", "Nador", "Berkane", "Taourirt", "Jerada", "Aïn Chock",
      "Sayada", "Driouch", "Figuig", "Guercif", "Hassi Berkane",
    ],
  },
  {
    nom: "Fès-Meknès",
    nomNormalise: "fes-meknes",
    villes: [
      "Fès", "Meknès", "Sefrou", "Ifrane", "El Hajeb", "Moulay Yacoub",
      "Ain Taoujdate", "Missour", "Outat El Haj", "Ribate El Kheir",
    ],
  },
  {
    nom: "Rabat-Salé-Kénitra",
    nomNormalise: "rabat-sale-kenitra",
    villes: [
      "Rabat", "Salé", "Kénitra", "Témara", "Skhirate", "Tifelt",
      "Ain Sebaa", "Harhoura", "Sidi Kacem", "Sidi Slimane", "Sidi Yahya",
    ],
  },
  {
    nom: "Béni Mellal-Khénifra",
    nomNormalise: "beni-mellal-khenifra",
    villes: [
      "Béni Mellal", "Khénifra", "Azilal", "Fquih Ben Salah", "Oulad Ayad",
      "Oulad M'Barek", "Kasba Tadla", "Demnate", "Ait Majden",
    ],
  },
  {
    nom: "Casablanca-Settat",
    nomNormalise: "casablanca-settat",
    villes: [
      "Casablanca", "Mohammédia", "Settat", "Berrechid", "El Jadida",
      "Sidi Bennour", "Benslimane", "Nouaceur", "Médiouna", "Laâyoune",
    ],
  },
  {
    nom: "Marrakech-Safi",
    nomNormalise: "marrakech-safi",
    villes: [
      "Marrakech", "Safi", "Essaouira", "El Kelaa des Sraghna", "Chichaoua",
      "Al Haouz", "Sidi Bennour", "Sidi Yzine", "Ben Guerir", "Imlil",
    ],
  },
  {
    nom: "Drâa-Tafilalet",
    nomNormalise: "draa-tafilalet",
    villes: [
      "Errachidia", "Ouarzazate", "Zagora", "Tinghir", "Midelt", "Rissani",
      "Goulmima", "Boumalne Dadès", "Nkob", "Tata",
    ],
  },
  {
    nom: "Souss-Massa",
    nomNormalise: "souss-massa",
    villes: [
      "Agadir", "Inezgane", "Tiznit", "Taroudant", "Chtouka Aït Baha",
      "Taliouine", "Aït Melloul", "Dcheira El Jihadia", "Biougra", "Tarfaya",
    ],
  },
  {
    nom: "Guelmim-Oued Noun",
    nomNormalise: "guelmim-oued-noun",
    villes: [
      "Guelmim", "Tantan", "Assa-Zag", "Sidi Ifni", "Tan-Tan", "Foum Zguid",
    ],
  },
  {
    nom: "Laâyoune-Sakia El Hamra",
    nomNormalise: "laayoune-sakia-el-hamra",
    villes: [
      "Laâyoune", "Tarfas", "Boujdour", "Es-Semara", "Foum El Oued",
    ],
  },
  {
    nom: "Dakhla-Oued Ed-Dahab",
    nomNormalise: "dakhla-oued-ed-dahab",
    villes: [
      "Dakhla", "Aousserd", "Bir Gandouz", "Oued Ed-Dahab",
    ],
  },
];

export const VILLES_MAROC: VilleMaroc[] = REGIONS_MAROC.flatMap((r) =>
  r.villes.map((nom) => ({
    nom,
    nomNormalise: nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-"),
    province: "",
    region: r.nom,
  }))
);

/** Liste aplatie de toutes les villes pour la recherche. */
export const TOUTES_VILLES_MAROC = VILLES_MAROC.map((v) => v.nom);

/**
 * Recherche une ville par nom (insensible à la casse et aux accents).
 * Retourne la ville trouvée ou null.
 */
export function rechercherVilleMaroc(texte: string): VilleMaroc | null {
  const normalise = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cible = normalise(texte);
  return (
    VILLES_MAROC.find((v) => v.nomNormalise === cible) ?? null
  );
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

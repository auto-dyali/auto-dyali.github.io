/**
 * AUTO DYALI — Référentiel géographique international (GV5).
 *
 * Pays : codes ISO (entrées GeoNames countryInfo), libellés français via
 *   Intl.DisplayNames('fr'). XK est un code utilisateur, pas un code ISO officiel.
 * Villes : GeoNames cities500 (CC BY 4.0), chargées à la demande depuis
 *   /data/villes-par-pays.json, JAMAIS embarquées dans le bundle JavaScript.
 * Maroc : union avec le référentiel local (12 régions, 142 villes), conservé
 *   intact et prioritaire pour les libellés.
 *
 * Limite documentée dans docs/GEODATA_STATS.md : cities500 exclut les
 * localités < 500 habitants ; 6 entrées pays n'ont aucune ville ; les noms
 * sans traduction française restent dans leur langue source.
 */

import paysImportes from "../../public/data/pays-iso.json";
import { normaliserTexte, TOUTES_VILLES_MAROC } from "./maroc-geographie";

export type Pays = {
  code: string;
  nom: string;
  nomSource: string;
  codeIsoOfficiel: boolean;
};

export const PAYS: Pays[] = paysImportes as Pays[];
export const PAYS_PAR_CODE = new Map(PAYS.map((p) => [p.code, p]));

const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });

/** Libellé français du pays ; repli sur le nom GeoNames si code inconnu. */
export function libellePays(code: string): string {
  const connu = PAYS_PAR_CODE.get(code);
  if (connu) return connu.nom;
  const traduit = displayNames.of(code);
  return traduit && traduit !== code ? traduit : code;
}

/**
 * Alias ciblés (couverture volontairement limitée) : clé normalisée -> nom
 * français affiché. Les noms non couverts sont conservés tels quels.
 */
export const ALIAS_VILLES_FR: Record<string, string> = {
  tangier: "Tanger",
  tanger: "Tanger",
  tetouan: "Tétouan",
  "letouan": "Tétouan",
  rabat: "Rabat",
  casablanca: "Casablanca",
  marrakech: "Marrakech",
  marrakesh: "Marrakech",
  fes: "Fès",
  fez: "Fès",
  meknes: "Meknès",
  "marrakech-safi": "Marrakech-Safi",
  paris: "Paris",
  londres: "Londres",
  london: "Londres",
  bruxelles: "Bruxelles",
  brussels: "Bruxelles",
  tunis: "Tunis",
  alger: "Alger",
};

/** Nom affiché d'une ville : alias français connu, sinon nom source. */
export function libelleVille(nom: string): string {
  return ALIAS_VILLES_FR[normaliserTexte(nom)] ?? nom;
}

export { normaliserTexte };

let cacheVilles: Map<string, string[]> | null = null;
let chargement: Promise<Map<string, string[]>> | null = null;

/**
 * Charge le référentiel des villes à la demande (une seule requête réseau).
 * Repli local pour le Maroc si le fichier statique est indisponible : on ne
 * perd jamais les 142 villes du référentiel historique.
 */
export async function chargerVillesParPays(): Promise<Map<string, string[]>> {
  if (cacheVilles) return cacheVilles;
  if (chargement) return chargement;
  chargement = (async () => {
    const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
    try {
      const reponse = await fetch(`${basePath}/data/villes-par-pays.json`, {
        cache: "force-cache",
      });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const donnees = (await reponse.json()) as Record<string, string[]>;
      cacheVilles = new Map(Object.entries(donnees));
    } catch {
      cacheVilles = new Map([["MA", [...TOUTES_VILLES_MAROC]]]);
    }
    return cacheVilles;
  })();
  try {
    return await chargement;
  } finally {
    chargement = null;
  }
}

/** Villes d'un pays, sans jamais emprunter à un autre pays. */
export async function villesDuPays(code: string): Promise<string[]> {
  const donnees = await chargerVillesParPays();
  return donnees.get(code) ?? (code === "MA" ? [...TOUTES_VILLES_MAROC] : []);
}

/**
 * Recherche insensible aux accents et à la casse. Préfixe prioritaire,
 * puis correspondance interne ; limite bornée pour la lisibilité.
 */
export function rechercherVilles(liste: string[], requete: string, limite = 12): string[] {
  const q = normaliserTexte(requete);
  if (!q) return [];
  const prefixes: string[] = [];
  const internes: string[] = [];
  for (const ville of liste) {
    const cle = normaliserTexte(ville);
    if (cle.startsWith(q)) prefixes.push(ville);
    else if (cle.includes(q)) internes.push(ville);
    if (prefixes.length >= limite) break;
  }
  return [...prefixes, ...internes].slice(0, limite).map(libelleVille);
}

/** Vrai si la ville appartient au pays (comparaison normalisée stricte). */
export function villeAppartientAuPays(
  ville: string,
  codePays: string,
  listes: Map<string, string[]>,
): boolean {
  const cible = normaliserTexte(ville);
  return (listes.get(codePays) ?? []).some((v) => normaliserTexte(v) === cible);
}

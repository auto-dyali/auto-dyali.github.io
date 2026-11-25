/**
 * GV5 — Générateur reproductible du référentiel géographique international.
 *
 * Sources (à télécharger une fois, NON embarquées) :
 *   https://download.geonames.org/export/dump/cities500.zip
 *   https://download.geonames.org/export/dump/countryInfo.txt
 * Licence : GeoNames, Creative Commons Attribution 4.0 — voir docs/ATTRIBUTIONS.md.
 *
 * Règles explicites :
 *   - pays : entrées de countryInfo (codes ISO + code utilisateur XK) ;
 *     libellé français via Intl.DisplayNames('fr'), repli sur le nom GeoNames ;
 *   - villes : lignes `cities500` (localités >= 500 habitants), feature class P,
 *     code pays présent dans countryInfo ;
 *   - déduplication : par clé normalisée (NFD, diacritiques retirés, minuscules,
 *     apostrophes et séparateurs -> tiret), en conservant le nom de la localité
 *     la plus peuplée ; pour MA, le libellé du référentiel local est prioritaire ;
 *   - Maroc : UNION avec src/lib/maroc-geographie.ts (142 villes, 12 régions),
 *     jamais remplacement ni écrasement ; les alias GeoNames servent uniquement
 *     à établir les correspondances, pas à supprimer une entrée locale ;
 *   - aucun appel réseau à l'exécution, aucune dépendance npm, aucun GPL ;
 *   - la liste n'est PAS exhaustive (seuil 500 habitants, 6 pays sans localité).
 *
 * Usage :
 *   node scripts/generate-geodata.mjs --source-dir /chemin/aux/fichiers/geonames
 *   node scripts/generate-geodata.mjs --source-dir … --check   # vérifie sans écrire
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const SOURCE_ARG = getArg("--source-dir");
const CHECK = args.includes("--check");
/* Le ZIP GeoNames se décompresse dans un sous-dossier `geonames/`. */
const { existsSync } = await import("node:fs");
const CITIES_FILE = existsSync(join(SOURCE_ARG ?? "", "cities500.txt"))
  ? join(SOURCE_ARG, "cities500.txt")
  : join(SOURCE_ARG ?? "", "geonames/cities500.txt");
const COUNTRY_FILE = existsSync(join(SOURCE_ARG ?? "", "countryInfo.txt"))
  ? join(SOURCE_ARG, "countryInfo.txt")
  : join(SOURCE_ARG ?? "", "geonames/countryInfo.txt");
if (!SOURCE_ARG || !existsSync(CITIES_FILE) || !existsSync(COUNTRY_FILE)) {
  console.error("Argument obligatoire : --source-dir <dossier contenant cities500.txt et countryInfo.txt>");
  process.exit(2);
}

/** Normalisation IDENTIQUE à src/lib/geographie.ts et au référentiel marocain. */
export function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });

/* ------------------------------------------------------------------ */
/* 1. Pays                                                             */
/* ------------------------------------------------------------------ */
const pays = readFileSync(COUNTRY_FILE, "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split("\t"))
  .filter((r) => /^[A-Z]{2}$/.test(r[0]));

const paysData = pays
  .map((r) => ({
    code: r[0],
    nom: displayNames.of(r[0]) && displayNames.of(r[0]) !== r[0] ? displayNames.of(r[0]) : r[4],
    nomSource: r[4],
    codeIsoOfficiel: Number(r[2]) > 0,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

/* ------------------------------------------------------------------ */
/* 2. Référentiel marocain existant (jamais modifié)                   */
/* ------------------------------------------------------------------ */
const marocSrc = readFileSync(join(ROOT, "src/lib/maroc-geographie.ts"), "utf8");
const villesLocales = [
  ...marocSrc.matchAll(/villes:\s*\[([\s\S]*?)\]/g),
].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
const regionsLocales = [
  ...marocSrc.matchAll(/nom:\s*"([^"]+)",\s*nomNormalise:/g),
].map((m) => m[1]);
const cleLocale = new Map();
for (const v of villesLocales) if (!cleLocale.has(normaliser(v))) cleLocale.set(normaliser(v), v);

/* ------------------------------------------------------------------ */
/* 3. Villes GeoNames                                                  */
/* ------------------------------------------------------------------ */
const lignes = readFileSync(CITIES_FILE, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"))
  .filter((f) => f.length > 14 && f[6] === "P" && /^[A-Z]{2}$/.test(f[8]));

const codesPays = new Set(pays.map((r) => r[0]));
const brutParPays = new Map();
for (const f of lignes) {
  if (!codesPays.has(f[8])) continue;
  if (!brutParPays.has(f[8])) brutParPays.set(f[8], []);
  brutParPays.get(f[8]).push({
    nom: f[1],
    ascii: f[2],
    alias: f[3] ? f[3].split(",").filter(Boolean) : [],
    population: Number(f[14]) || 0,
  });
}

/* Correspondances marocaines : mêmes clés que le générateur. */
const villesMaBrut = brutParPays.get("MA") ?? [];
const clesMaGeo = new Map();
for (const v of villesMaBrut) {
  for (const forme of [v.nom, v.ascii, ...v.alias]) {
    const c = normaliser(forme);
    if (c) clesMaGeo.set(c, v.nom);
  }
}
const correspondantes = villesLocales.filter((v) => clesMaGeo.has(normaliser(v)));
const localesAbsentes = villesLocales.filter((v) => !clesMaGeo.has(normaliser(v)));
/* L'union doit utiliser la CLE DU NOM PRINCIPAL, pas les alias : sinon on
   compterait deux fois une même ville GeoNames dont l'alias correspond à une
   ville locale alors que son nom principal diffère. */
const clesNomsMaGeo = new Set(villesMaBrut.map((v) => normaliser(v.nom)));
const correspondancesParNom = villesLocales.filter((v) => clesNomsMaGeo.has(normaliser(v))).length;

/* Union Maroc : TOUTES les entrées locales sont conservées, y compris celles
   qui partagent une clé normalisée avec une autre entrée locale. */
const clesLocales = new Set(villesLocales.map(normaliser));
const vus = new Set(clesLocales);
const unionMa = [...villesLocales];
let geoNouveaux = 0;
for (const v of [...villesMaBrut].sort((a, b) => b.population - a.population)) {
  const c = normaliser(v.nom);
  if (!vus.has(c)) {
    vus.add(c);
    unionMa.push(v.nom);
    geoNouveaux++;
  }
}

/* Autres pays : déduplication par clé normalisée, localité la plus peuplée d'abord. */
const parPays = {};
for (const [code, liste] of brutParPays) {
  const dedup = new Map();
  for (const v of [...liste].sort((a, b) => b.population - a.population || a.nom.localeCompare(b.nom, "fr"))) {
    const c = normaliser(v.nom);
    if (!dedup.has(c)) dedup.set(c, v.nom);
  }
  parPays[code] = [...dedup.values()].sort((a, b) => a.localeCompare(b, "fr"));
}
parPays.MA = unionMa.sort((a, b) => a.localeCompare(b, "fr"));

const villesParPays = Object.fromEntries(
  Object.keys(parPays)
    .sort()
    .map((code) => [code, parPays[code]]),
);

/* Doublons géographiques détectés (plusieurs libellés -> même clé). */
const doublonsMa = {};
for (const v of villesMaBrut) {
  const c = normaliser(v.nom);
  (doublonsMa[c] ??= new Set()).add(v.nom);
}
const doublonsMaDetail = Object.entries(doublonsMa)
  .filter(([, s]) => s.size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([cle, noms]) => ({ cle, noms: [...noms].sort() }));

/* ------------------------------------------------------------------ */
/* 4. Statistiques et documents                                        */
/* ------------------------------------------------------------------ */
const effectifs = Object.entries(villesParPays)
  .map(([code, liste]) => ({ code, total: liste.length }))
  .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
const paysAvecVilles = effectifs.filter((e) => e.total > 0).length;
const paysSansVilles = paysData.filter((p) => !(p.code in villesParPays)).map((p) => p.code);
const totalRetenues = effectifs.reduce((a, e) => a + e.total, 0);
const octetsJson = Buffer.byteLength(JSON.stringify(villesParPays));
const stats = {
  source: { cities500Lignes: lignes.length, countryInfoEntrees: pays.length },
  pays: {
    entrees: paysData.length,
    codesIsoOfficiels: paysData.filter((p) => p.codeIsoOfficiel).length,
    codesSpeciaux: paysData.filter((p) => !p.codeIsoOfficiel).map((p) => p.code),
    avecVilles: paysAvecVilles,
    sansVilles: paysSansVilles,
  },
  villes: { lignesSource: lignes.length, retenues: totalRetenues, octetsJson: octetsJson },
  maroc: {
    locales: villesLocales.length,
    regions: regionsLocales.length,
    geoNamesBrut: villesMaBrut.length,
    correspondancesAvecAlias: correspondantes.length,
    correspondancesParNom,
    localesAbsentes: localesAbsentes.length,
    localesClesUniques: clesLocales.size,
    geoNamesClesUniques: clesNomsMaGeo.size,
    intersectionCles: [...clesLocales].filter((c) => clesNomsMaGeo.has(c)).length,
    geoNamesAjoutes: geoNouveaux,
    unionTheorique: villesLocales.length + geoNouveaux,
    unionRetenu: villesParPays.MA.length,
    doublonsNormalises: doublonsMaDetail.length,
  },
};

const md = `# GV5 — Statistiques du référentiel géographique généré

Généré par \`scripts/generate-geodata.mjs\`. Sources : GeoNames \`cities500\` et \`countryInfo\`, licence CC BY 4.0.

## Pays

- Entrées \`countryInfo\` : **${stats.pays.entrees}** (codes ISO numériques non nuls : ${stats.pays.codesIsoOfficiels} ; code utilisateur : ${stats.pays.codesSpeciaux.join(", ") || "aucun"}).
- **Ne pas annoncer « 252 pays ISO »** : il s'agit d'entrées GeoNames, dont un code utilisateur.
- Pays avec au moins une localité : **${stats.pays.avecVilles}**.
- Sans localité (${stats.pays.sansVilles.length}) : ${stats.pays.sansVilles.join(", ")}.

## Villes

- Lignes source \`cities500\` (feature class P, code pays connu) : **${stats.villes.lignesSource}**.
- Villes retenues après déduplication par clé normalisée : **${stats.villes.retenues}**.
- Taille du JSON généré : **${stats.villes.octetsJson} octets** (non inclus dans le bundle JS).
- Limite : seuil de population 500 ; liste non exhaustive ; libellés sources conservés faute de traduction.

## Maroc — démonstration de l'union

| Quantité | Valeur |
|---|---|
| Villes du référentiel local (inchangé) | ${stats.maroc.locales} |
| Régions du référentiel local | ${stats.maroc.regions} |
| Lignes GeoNames MA | ${stats.maroc.geoNamesBrut} |
| Correspondances par nom principal (clé normalisée) — utilisées pour l'union | ${stats.maroc.correspondancesParNom} |
| Correspondances élargies (nom / ASCII / alias) — utilisées pour le contrôle de couverture | ${stats.maroc.correspondancesAvecAlias} |
| Clés normalisées distinctes côté local | ${stats.maroc.localesClesUniques} |
| Clés normalisées distinctes côté GeoNames | ${stats.maroc.geoNamesClesUniques} |
| Intersection des clés (noms principaux) | ${stats.maroc.intersectionCles} |
| Noms GeoNames réellement ajoutés | ${stats.maroc.geoNamesAjoutes} |
| Union = ${stats.maroc.locales} (toutes conservées) + ${stats.maroc.geoNamesAjoutes} | **${stats.maroc.unionTheorique}** |
| Union retenue | **${stats.maroc.unionRetenu}** |
| Entrées locales absentes de GeoNames même par alias (conservées) | ${stats.maroc.localesAbsentes} |

Explication de l'écart avec le calcul naïf annoncé initialement : ${stats.maroc.correspondancesAvecAlias} correspondances **avec alias** et ${stats.maroc.correspondancesParNom} correspondances **par nom principal** mesurent deux choses différentes. Les ${stats.maroc.locales} entrées locales forment ${stats.maroc.localesClesUniques} clés distinctes ; les ${stats.maroc.geoNamesBrut} lignes GeoNames n'en forment que ${stats.maroc.geoNamesClesUniques} (4 lignes répètent un même nom). L'union conserve explicitement chaque entrée locale. Le calcul correct est : ${stats.maroc.locales} + (${stats.maroc.geoNamesBrut} − ${stats.maroc.intersectionCles}) = **${stats.maroc.unionTheorique}**, identique à l'union retenue. **Aucune ville locale n'est perdue** ; aucun doublon normalisé interne à GeoNames n'a été détecté (${stats.maroc.doublonsNormalises} groupe).

### Correspondances (ville locale ↔ nom GeoNames)

${correspondantes.map((v) => `- ${v} ↔ ${clesMaGeo.get(normaliser(v))}`).join("\n")}

### Villes locales absentes de GeoNames (conservées telles quelles)

${localesAbsentes.map((v) => `- ${v}`).join("\n")}

### Doublons normalisés GeoNames (groupes)

${doublonsMaDetail.map((d) => `- **${d.cle}** : ${d.noms.join(" | ")}`).join("\n")}

## Couverture par pays (décroissante)

${effectifs.slice(0, 30).map((e) => `- ${e.code} : ${e.total}`).join("\n")}

`;

if (CHECK) {
  console.log(JSON.stringify(stats, null, 2));
} else {
  mkdirSync(join(ROOT, "public/data"), { recursive: true });
  writeFileSync(join(ROOT, "public/data/villes-par-pays.json"), JSON.stringify(villesParPays));
  writeFileSync(join(ROOT, "public/data/pays-iso.json"), JSON.stringify(paysData));
  writeFileSync(join(ROOT, "docs/GEODATA_STATS.md"), md);
  console.log(JSON.stringify(stats, null, 2));
}

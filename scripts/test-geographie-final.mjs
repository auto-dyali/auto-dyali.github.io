/**
 * GV5 — Tests ciblés du référentiel géographique final (aucun réseau, aucune DB).
 * Vérifie les données générées, l'absence de perte des 142 villes marocaines,
 * la recherche accent/casse, le reset pays et le chargement à la demande.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pays = JSON.parse(read("public/data/pays-iso.json"));
const villes = JSON.parse(read("public/data/villes-par-pays.json"));
const component = read("src/components/ChampGeographieMaroc.tsx");
const lib = read("src/lib/geographie.ts");
const generator = read("scripts/generate-geodata.mjs");
const onboarding = read("src/app/super-admin/onboarding/page.tsx");
const workspace = read("src/components/abonne-workspace.tsx");

const normaliser = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

test("pays : entrées GeoNames, code utilisateur XK et libellé français", () => {
  assert.equal(pays.length, 252);
  assert.equal(pays.filter((p) => p.codeIsoOfficiel).length, 251);
  assert.deepEqual(pays.filter((p) => !p.codeIsoOfficiel).map((p) => p.code), ["XK"]);
  assert.equal(pays.find((p) => p.code === "MA")?.nom, "Maroc");
  assert.equal(pays.find((p) => p.code === "FR")?.nom, "France");
});

test("villes : couverture générée et filtrage par code pays à la source", () => {
  assert.equal(Object.keys(villes).length, 246);
  assert.equal(Object.values(villes).reduce((a, b) => a + b.length, 0), 209004);
  assert.equal(villes.MA.length, 528);
  assert.match(generator, /f\[8\]/); // code pays GeoNames utilisé comme clé
  assert.match(generator, /feature class P/);
});

test("Maroc : aucune des 142 villes historiques n'est perdue", () => {
  const src = read("src/lib/maroc-geographie.ts");
  const locales = [...src.matchAll(/villes:\s*\[([\s\S]*?)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  );
  assert.equal(locales.length, 142);
  assert.equal([...src.matchAll(/nom:\s*"([^"]+)",\s*nomNormalise:/g)].length, 12);
  const presents = new Set(villes.MA.map(normaliser));
  for (const ville of locales) assert.ok(presents.has(normaliser(ville)), `ville perdue: ${ville}`);
  /* Union réelle : 142 locales + 386 noms GeoNames nouveaux = 528. */
  assert.equal(villes.MA.length, 142 + 386);
});

test("recherche insensible aux accents et à la casse, sans ville étrangère", () => {
  const Chercher = (liste, q) =>
    liste.filter((v) => normaliser(v).startsWith(normaliser(q))).slice(0, 12);
  assert.deepEqual(Chercher(villes.MA, "Tetouan"), Chercher(villes.MA, "tétouan"));
  assert.ok(Chercher(villes.MA, "tanger").length > 0);
  assert.equal(Chercher(villes.FR, "Tetouan").length, 0);
  assert.match(lib, /normaliserTexte\(requete\)/);
  assert.match(lib, /cle\.startsWith\(q\)/);
});

test("changement de pays : ville et région vidées immédiatement", () => {
  assert.match(component, /if \(code !== country\)/);
  assert.match(component, /onChange\("ville", ""\)/);
  assert.match(component, /onChange\("region", ""\)/);
  assert.match(component, /villeAppartientAuPays/);
});

test("chargement à la demande : aucun JSON de villes dans le bundle initial", () => {
  assert.match(lib, /fetch\(`\$\{basePath\}\/data\/villes-par-pays\.json`/);
  assert.doesNotMatch(lib, /^\s*import .*villes-par-pays\.json/m);
  assert.match(lib, /TOUTES_VILLES_MAROC/); // repli local pour le Maroc
});

test("persistance : code ISO utilisé à la création et en modification", () => {
  assert.match(onboarding, /country: "MA"/);
  assert.match(onboarding, /libellePays\(form\.country\)/);
  assert.match(workspace, /\? "MA"/);
  assert.match(workspace, /p_country: etab\.country\.trim\(\)/);
});

test("attribution, limites et licence documentées", () => {
  const attr = read("docs/ATTRIBUTIONS.md");
  const stats = read("docs/GEODATA_STATS.md");
  assert.match(attr, /CC BY 4\.0/);
  assert.match(attr, /pas exhaustive/);
  assert.match(attr, /XK/);
  assert.match(stats, /528/);
  assert.match(stats, /386/);
});

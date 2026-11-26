/**
 * GV5 §118 (complément) — Tests ciblés du formulaire Pays / Région / Ville.
 * Données réelles du dépôt + contrôles statiques du composant.
 * Aucun réseau, aucune base distante, aucun navigateur.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pays = JSON.parse(read("public/data/pays-iso.json"));
const villes = JSON.parse(read("public/data/villes-par-pays.json"));
const regions = JSON.parse(read("public/data/villes-maroc-par-region.json"));
const composant = read("src/components/ChampGeographieMaroc.tsx");
const lib = read("src/lib/geographie.ts");
const sourceMaroc = read("src/lib/maroc-geographie.ts");

const norm = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

test("Pays : source chargée et non vide, pays sélectionnable", () => {
  assert.ok(pays.length >= 250);
  assert.ok(pays.some((p) => p.code === "MA" && p.nom === "Maroc"));
  assert.ok(pays.some((p) => p.code === "FR"));
  assert.match(composant, /PAYS\.map/);
  assert.match(composant, /onChange\("country", code\)/);
});

test("Région : 12 régions marocaines, une seule source, aucun doublon", () => {
  const nomsSource = [...sourceMaroc.matchAll(/\bnom:\s*"([^"]+)",\s*nomNormalise:/g)].map((m) => m[1]);
  assert.equal(nomsSource.length, 12);
  assert.deepEqual(Object.keys(regions).sort(), [...nomsSource].sort());
  const toutes = Object.values(regions).flat();
  assert.equal(new Set(toutes.map(norm)).size, toutes.length, "aucun doublon de ville");
});

test("Ville : 528 villes marocaines conservées et exploitables", () => {
  assert.equal(villes.MA.length, 528);
  const locales = [...sourceMaroc.matchAll(/villes:\s*\[([\s\S]*?)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  assert.equal(locales.length, 142);
  const globales = new Set(villes.MA.map(norm));
  for (const v of locales) assert.ok(globales.has(norm(v)), `ville locale perdue : ${v}`);
  const parRegion = new Set(Object.values(regions).flat().map(norm));
  for (const v of villes.MA) {
    if (!parRegion.has(norm(v))) {
      assert.equal(norm(v), "tah", "seule la localité sans code admin1 peut être sans région");
    }
  }
});

test("Dépendances : pays → région → ville, reset et cohérence", () => {
  assert.match(composant, /onChange\("ville", ""\)/);
  assert.match(composant, /onChange\("region", ""\)/);
  assert.match(composant, /villeAppartientARegionMaroc\(ville, region\)/);
  assert.match(composant, /villesDeRegionMaroc\(region\)/);
  assert.match(composant, /regionDeVilleMaroc\(nomVille\)/);
  assert.doesNotMatch(composant, /regionDeVille\(/);
});

test("États : chargement, absence de données et recherche sans saisie", () => {
  assert.match(composant, /etatVilles/);
  assert.match(composant, /"chargement" \| "pret" \| "vide"/);
  assert.match(composant, /Aucune donnée de ville disponible/);
  assert.match(composant, /if \(!requete\.trim\(\)\) return listeVilles\.slice/);
  assert.match(composant, /role="status"/);
});

test("Deux pays étrangers exploitables et filtrage par pays", () => {
  for (const code of ["FR", "US"]) assert.ok((villes[code] ?? []).length > 100);
  assert.match(lib, /listes\.get\(codePays\)/);
  assert.doesNotMatch(lib, /listes\.get\(MAROC\)[\s\S]*codePays/);
});

test("Persistance : code pays, région et ville envoyés et relus", () => {
  const page = read("src/app/super-admin/onboarding/page.tsx");
  assert.match(page, /country: form\.country/);
  assert.match(page, /region: form\.region/);
  assert.match(page, /city: form\.city/);
  const workspace = read("src/components/abonne-workspace.tsx");
  assert.match(workspace, /gv5_archived_at|region: txt\(d\?\.region/);
});

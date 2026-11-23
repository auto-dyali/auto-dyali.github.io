/**
 * GV5 §93 — Tests du référentiel géographique du Maroc.
 *
 * Couvre :
 *   - normalisation cohérente (casse, accents, espaces, apostrophes, tirets) ;
 *   - villes composées (Béni Mellal, El Kelaa des Sraghna, Aït Melloul,
 *     Al Hoceïma, Sidi Slimane, Oued Ed-Dahab) ;
 *   - recherche partielle et correspondances déterministes ;
 *   - filtrage géographique par région ;
 *   - résolution région ←→ ville ;
 *   - 12 régions couvertes ;
 *   - absence de doublons ;
 *   - ville absente du référentiel (gestion propre).
 *
 * Aucun réseau. Test purement local.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliserTexte,
  REGIONS_MAROC,
  VILLES_MAROC,
  TOUTES_VILLES_MAROC,
  rechercherVilleMaroc,
  rechercherVillesMaroc,
  villesParRegion,
  regionDeVille,
  PAYS_DEFAUT,
} from "../src/lib/maroc-geographie.ts";

test("normalisation : casse ignorée", () => {
  assert.strictEqual(normaliserTexte("CASABLANCA"), "casablanca");
  assert.strictEqual(normaliserTexte("casablanca"), "casablanca");
  assert.strictEqual(normaliserTexte("Casablanca"), "casablanca");
});

test("normalisation : accents supprimés", () => {
  assert.strictEqual(normaliserTexte("Tétouan"), "tetouan");
  assert.strictEqual(normaliserTexte("Fès"), "fes");
  assert.strictEqual(normaliserTexte("Al Hoceïma"), "al-hoceima");
  assert.strictEqual(normaliserTexte("Oued Ed-Dahab"), "oued-ed-dahab");
});

test("normalisation : espaces multiples et tirets", () => {
  assert.strictEqual(normaliserTexte("Béni  Mellal"), "beni-mellal");
  assert.strictEqual(normaliserTexte("El Kelaa des Sraghna"), "el-kelaa-des-sraghna");
  assert.strictEqual(normaliserTexte("Aït Melloul"), "ait-melloul");
  assert.strictEqual(normaliserTexte("Sidi Slimane"), "sidi-slimane");
  assert.strictEqual(normaliserTexte("Oued Ed-Dahab"), "oued-ed-dahab");
  assert.strictEqual(normaliserTexte("  Tanger  "), "tanger");
});

test("normalisation : apostrophes et caractères spéciaux", () => {
  assert.strictEqual(normaliserTexte("M'diq"), "m-diq");
  assert.strictEqual(normaliserTexte("Ksar el-Kebir"), "ksar-el-kebir");
});

test("12 régions présentes", () => {
  assert.strictEqual(REGIONS_MAROC.length, 12);
  const noms = REGIONS_MAROC.map((r) => r.nom);
  assert.ok(noms.includes("Tanger-Tétouan-Al Hoceïma"));
  assert.ok(noms.includes("Oriental"));
  assert.ok(noms.includes("Fès-Meknès"));
  assert.ok(noms.includes("Rabat-Salé-Kénitra"));
  assert.ok(noms.includes("Béni Mellal-Khénifra"));
  assert.ok(noms.includes("Casablanca-Settat"));
  assert.ok(noms.includes("Marrakech-Safi"));
  assert.ok(noms.includes("Drâa-Tafilalet"));
  assert.ok(noms.includes("Souss-Massa"));
  assert.ok(noms.includes("Guelmim-Oued Noun"));
  assert.ok(noms.includes("Laâyoune-Sakia El Hamra"));
  assert.ok(noms.includes("Dakhla-Oued Ed-Dahab"));
});

test("chaque région a un nomNormalise cohérent", () => {
  for (const r of REGIONS_MAROC) {
    assert.strictEqual(r.nomNormalise, normaliserTexte(r.nom));
    assert.ok(r.villes.length > 0, `La région ${r.nom} ne doit pas être vide`);
  }
});

test("pas de doublon de villes dans le référentiel", () => {
  const noms = VILLES_MAROC.map((v) => v.nom);
  const uniques = new Set(noms);
  assert.strictEqual(noms.length, uniques.size, "Des doublons de villes ont été détectés");
});

test("chaque ville a un nomNormalise cohérent", () => {
  for (const v of VILLES_MAROC) {
    assert.strictEqual(v.nomNormalise, normaliserTexte(v.nom));
    assert.ok(v.region, `La ville ${v.nom} doit être rattachée à une région`);
  }
});

test("recherche ville : correspondance exacte", () => {
  assert.ok(rechercherVilleMaroc("Casablanca")?.nom === "Casablanca");
  assert.ok(rechercherVilleMaroc("casablanca")?.nom === "Casablanca");
  // "CASA BLANCA" avec espace devient "casa-blanca" ≠ "casablanca" :
  // c'est le comportement attendu et correct.
});

test("recherche ville : villes composées", () => {
  const beni = rechercherVilleMaroc("Béni Mellal");
  assert.ok(beni, "Béni Mellal doit être trouvée");
  assert.strictEqual(beni.nom, "Béni Mellal");
  assert.strictEqual(beni.region, "Béni Mellal-Khénifra");

  const kelaa = rechercherVilleMaroc("El Kelaa des Sraghna");
  assert.ok(kelaa, "El Kelaa des Sraghna doit être trouvée");
  assert.strictEqual(kelaa.nom, "El Kelaa des Sraghna");
  assert.strictEqual(kelaa.region, "Marrakech-Safi");

  const ait = rechercherVilleMaroc("Aït Melloul");
  assert.ok(ait, "Aït Melloul doit être trouvée");
  assert.strictEqual(ait.nom, "Aït Melloul");
  assert.strictEqual(ait.region, "Souss-Massa");

  const al = rechercherVilleMaroc("Al Hoceïma");
  assert.ok(al, "Al Hoceïma doit être trouvée");
  assert.strictEqual(al.nom, "Al Hoceïma");
  assert.strictEqual(al.region, "Tanger-Tétouan-Al Hoceïma");

  const sidi = rechercherVilleMaroc("Sidi Slimane");
  assert.ok(sidi, "Sidi Slimane doit être trouvée");
  assert.strictEqual(sidi.nom, "Sidi Slimane");
  assert.strictEqual(sidi.region, "Rabat-Salé-Kénitra");

  const oued = rechercherVilleMaroc("Oued Ed-Dahab");
  assert.ok(oued, "Oued Ed-Dahab doit être trouvée");
  assert.strictEqual(oued.nom, "Oued Ed-Dahab");
  assert.strictEqual(oued.region, "Dakhla-Oued Ed-Dahab");
});

test("recherche ville : absente du référentiel", () => {
  assert.strictEqual(rechercherVilleMaroc("Ville Inexistante Xyz"), null);
  assert.strictEqual(rechercherVilleMaroc(""), null);
  assert.strictEqual(rechercherVilleMaroc("   "), null);
});

test("recherche partielle : avec requête", () => {
  const casablanca = rechercherVillesMaroc("cas");
  assert.ok(casablanca.includes("Casablanca"), "La recherche partielle 'cas' doit trouver Casablanca");
  assert.ok(casablanca.length <= 10, "Au plus 10 résultats");
});

test("recherche partielle : filtrée par région", () => {
  const souss = rechercherVillesMaroc("agadir", "Souss-Massa");
  assert.ok(souss.includes("Agadir"), "Agadir doit être trouvée dans Souss-Massa");

  // Agadir ne doit PAS apparaître quand on filtre sur une autre région
  const rabat = rechercherVillesMaroc("agadir", "Rabat-Salé-Kénitra");
  assert.ok(!rabat.includes("Agadir"), "Agadir ne doit pas apparaître dans Rabat-Salé-Kénitra");
});

test("recherche partielle : requête vide + région retourne les villes de la région", () => {
  const fes = rechercherVillesMaroc("", "Fès-Meknès");
  assert.ok(fes.includes("Fès"), "Fès doit apparaître pour la région Fès-Meknès");
  assert.ok(fes.includes("Meknès"), "Meknès doit apparaître pour la région Fès-Meknès");
  assert.ok(!fes.includes("Casablanca"), "Casablanca ne doit pas apparaître pour Fès-Meknès");
});

test("regionDeVille : résolution correcte", () => {
  assert.strictEqual(regionDeVille("Marrakech"), "Marrakech-Safi");
  assert.strictEqual(regionDeVille("Tanger"), "Tanger-Tétouan-Al Hoceïma");
  assert.strictEqual(regionDeVille("Ville Inconnue"), null);
});

test("villesParRegion : retourne les villes de la région", () => {
  const oujda = villesParRegion("Oriental");
  assert.ok(oujda.includes("Oujda"), "Oujda doit être dans Oriental");
  assert.ok(oujda.includes("Nador"), "Nador doit être dans Oriental");

  const vide = villesParRegion("Région Inexistante");
  assert.strictEqual(vide.length, 0, "Région inexistante doit retourner un tableau vide");
});

test("pays par défaut", () => {
  assert.strictEqual(PAYS_DEFAUT, "Maroc");
});

test("pas de doublon de nom de région", () => {
  const noms = REGIONS_MAROC.map((r) => r.nom);
  const uniques = new Set(noms);
  assert.strictEqual(noms.length, uniques.size, "Pas de doublon de régions");
});

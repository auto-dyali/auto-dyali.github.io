/**
 * Tests unitaires des helpers CSV génériques.
 * Exécution : node --test scripts/test-csv-export.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell, buildCsv, dateFrCourte, formatMontant } from "../src/lib/csv-export.ts";

test("escapeCsvCell gère null/undefined/nombres", () => {
  assert.equal(escapeCsvCell(null), "");
  assert.equal(escapeCsvCell(undefined), "");
  assert.equal(escapeCsvCell(0), '"0"');
  assert.equal(escapeCsvCell(42), '"42"');
});

test("escapeCsvCell échappe guillemets et remplace retours ligne", () => {
  assert.equal(escapeCsvCell('a"b'), '"a""b"');
  assert.equal(escapeCsvCell("l1\nl2"), '"l1 l2"');
  assert.equal(escapeCsvCell("l1\r\nl2"), '"l1 l2"');
});

test("buildCsv produit entête et lignes", () => {
  const csv = buildCsv(["A", "B"], [["x", 1], [null, "y"]]);
  assert.equal(csv, '"A","B"\n"x","1"\n,"y"');
});

test("dateFrCourte formate ou renvoie tiret", () => {
  assert.equal(dateFrCourte(null), "—");
  assert.match(dateFrCourte("2026-01-15T10:00:00Z"), /\d{2}\/\d{2}\/2026/);
});

test("formatMontant gère null et formate MAD", () => {
  assert.equal(formatMontant(null), "—");
  assert.equal(formatMontant(undefined), "—");
  const out = formatMontant(1234.5);
  assert.ok(out.includes("1") && out.includes("234"));
});

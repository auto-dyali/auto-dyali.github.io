/**
 * Tests unitaires — logique CRM pure (rappels entretien).
 * Exécution : node --test scripts/test-crm.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { prochaineEcheance, moisDepuisIntervention } from "../src/lib/crm.ts";

test("prochaineEcheance privilégie la dernière vérification", () => {
  const iso = prochaineEcheance("2026-01-10T12:00:00Z", "2026-02-10T12:00:00Z", "2025-01-01T12:00:00Z");
  assert.ok(iso);
  const d = new Date(iso);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 4); // mai
  assert.equal(d.getUTCDate(), 10);
});

test("prochaineEcheance utilise la dernière intervention si pas de vérification", () => {
  const iso = prochaineEcheance("2026-03-15T12:00:00Z", null, null);
  assert.ok(iso);
  const d = new Date(iso);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5); // juin
  assert.equal(d.getUTCDate(), 15);
});

test("prochaineEcheance retourne null sans référence valide", () => {
  assert.equal(prochaineEcheance(null, null, "2026-01-01T00:00:00Z"), null);
  assert.equal(prochaineEcheance("invalide", null, null), null);
});

test("moisDepuisIntervention calcule les mois écoulés", () => {
  const maintenant = new Date("2026-06-15T12:00:00Z");
  assert.equal(moisDepuisIntervention("2026-03-15T00:00:00Z", maintenant), 3);
  assert.equal(moisDepuisIntervention(null, maintenant), null);
  assert.equal(moisDepuisIntervention("bad", maintenant), null);
});

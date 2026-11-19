/**
 * Tests unitaires des helpers CSV du CRM Super Admin.
 * Exécution : node --test scripts/test-crm-csv.mjs
 *
 * Node 26 retire les types TypeScript nativement : on peut importer
 * directement le module `.ts` sans transpilation supplémentaire.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { formatCSV, exporterCSV } from "../src/lib/crm-csv.ts";

test("formatCSV échappe les guillemets", () => {
  assert.equal(formatCSV('Garage "Central"'), '"Garage ""Central"""');
});

test("formatCSV remplace les sauts de ligne par un espace", () => {
  assert.equal(formatCSV("ligne1\nligne2"), '"ligne1 ligne2"');
  assert.equal(formatCSV("ligne1\r\nligne2"), '"ligne1 ligne2"');
});

test("formatCSV gère null et undefined", () => {
  assert.equal(formatCSV(null), "");
  assert.equal(formatCSV(undefined), "");
  assert.equal(formatCSV(""), '""');
});

test("exporterCSV retourne null si aucun lead", () => {
  assert.equal(exporterCSV([]), null);
});

test("exporterCSV produit un en-tête et une ligne par lead", () => {
  const leads = [
    {
      company: "Garage A",
      contact_name: "Ali",
      email: "a@example.com",
      phone: "0600000000",
      city: "Rabat",
      activity: "Mécanique",
      plan_interest: "gold",
      stage: "prospect",
      next_action_at: null,
      owner_id: null,
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-02T10:00:00.000Z",
    },
    {
      company: "Garage B",
      contact_name: null,
      email: null,
      phone: null,
      city: null,
      activity: null,
      plan_interest: null,
      stage: "won",
      next_action_at: "2026-02-01",
      owner_id: "owner-1",
      created_at: null,
      updated_at: null,
    },
  ];

  const csv = exporterCSV(leads, [{ id: "owner-1", full_name: "Rachid Bami" }]);
  assert.ok(csv);
  const lines = csv.split("\n");
  assert.equal(lines.length, 3, "en-tête + 2 lignes");
  assert.match(lines[0], /^"Entreprise"/);
  assert.match(lines[0], /"Propriétaire"/);
  assert.match(lines[1], /"Garage A"/);
  assert.match(lines[2], /"Rachid Bami"/);
});

test("exporterCSV utilise l'identifiant si le propriétaire est inconnu", () => {
  const csv = exporterCSV(
    [
      {
        company: "Garage C",
        contact_name: null,
        email: null,
        phone: null,
        city: null,
        activity: null,
        plan_interest: null,
        stage: "trial",
        next_action_at: null,
        owner_id: "owner-inconnu",
        created_at: null,
        updated_at: null,
      },
    ],
    []
  );
  assert.ok(csv);
  assert.match(csv, /"owner-inconnu"/);
});

test("formatCSV échappe les virgules dans une valeur", () => {
  assert.equal(formatCSV("Garage Central, Rabat"), '"Garage Central, Rabat"');
});

test("formatCSV échappe les guillemets doubles et virgules combinés", () => {
  assert.equal(formatCSV('Garage "Central", Rabat'), '"Garage ""Central"", Rabat"');
});

test("exporterCSV gère une entreprise avec virgule dans le nom", () => {
  const csv = exporterCSV(
    [
      {
        company: 'Garage "Central", Rabat',
        contact_name: "Ali",
        email: "a@example.com",
        phone: "0600000000",
        city: "Rabat",
        activity: "Mécanique",
        plan_interest: "silver",
        stage: "demo",
        next_action_at: null,
        owner_id: null,
        created_at: null,
        updated_at: null,
      },
    ],
    []
  );
  assert.ok(csv);
  assert.match(csv, /"Garage ""Central"", Rabat"/);
});

test("exporterCSV avec création null", () => {
  const csv = exporterCSV(
    [
      {
        company: "Garage D",
        contact_name: null,
        email: null,
        phone: null,
        city: null,
        activity: null,
        plan_interest: null,
        stage: "lost",
        next_action_at: null,
        owner_id: null,
        created_at: null,
        updated_at: null,
      },
    ],
    []
  );
  assert.ok(csv);
  assert.match(csv, /"Garage D"/);
  assert.match(csv, /"lost"/);
  // La colonne "Créé le" doit être vide quand created_at est null
  const lines = csv.split("\n");
  // Le format CSV utilise des guillemets doubles pour les chaînes vides
  assert.ok(lines.length >= 2, "au moins 2 lignes (en-tête + donnée)");
  assert.ok(lines[1].includes('","'), "champs vides pour created_at/updated_at null");
});

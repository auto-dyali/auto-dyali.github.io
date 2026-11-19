import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  ACCEPTED_IMPORT_EXTENSIONS,
  isAcceptedImportFileName,
  validateImportFile,
} from "../src/lib/excel-safe.ts";

test("extensions d'import acceptées", () => {
  assert.deepEqual([...ACCEPTED_IMPORT_EXTENSIONS], [".xlsx", ".xls", ".csv"]);
  assert.equal(isAcceptedImportFileName("catalogue.xlsx"), true);
  assert.equal(isAcceptedImportFileName("catalogue.XLS"), true);
  assert.equal(isAcceptedImportFileName("clients.csv"), true);
  assert.equal(isAcceptedImportFileName("catalogue.xlsm"), false);
  assert.equal(isAcceptedImportFileName("image.png"), false);
});

test("fichier vide ou format refusé", () => {
  assert.equal(validateImportFile({ name: "x.xlsx", size: 0 }), "Le fichier est vide.");
  assert.match(
    validateImportFile({ name: "x.exe", size: 10 }) ?? "",
    /Format non accepté/,
  );
});

test("fichier trop volumineux refusé", () => {
  const msg = validateImportFile({ name: "x.xlsx", size: MAX_IMPORT_BYTES + 1 });
  assert.ok(msg);
  assert.match(msg, /trop volumineux/);
  assert.match(msg, /10 Mo/);
});

test("fichier valide accepté", () => {
  assert.equal(validateImportFile({ name: "ok.xlsx", size: 1024 }), null);
  assert.equal(validateImportFile({ name: "ok.csv", size: MAX_IMPORT_BYTES }), null);
});

test("limites de sécurité définies", () => {
  assert.equal(MAX_IMPORT_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_IMPORT_ROWS, 5000);
});

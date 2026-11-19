/**
 * GV5 §51 — Tests unitaires des permissions (intersection forfait ∩ droits).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  findPermission,
  intersectFeaturesWithPermissions,
  normalizePermission,
} from "../src/lib/permissions.ts";

const rows = [
  normalizePermission({ module: "dashboard", can_view: true, can_create: false, can_edit: false, can_delete: false }),
  normalizePermission({ module: "clients", can_view: true, can_create: true, can_edit: true, can_delete: false }),
];

test("normalizePermission ne devine aucun droit", () => {
  const p = normalizePermission({ module: "stock" });
  assert.equal(p.can_view, false);
  assert.equal(p.can_create, false);
  assert.equal(p.can_edit, false);
  assert.equal(p.can_delete, false);
});

test("can() applique chaque action", () => {
  assert.equal(can(rows, "dashboard", "view"), true);
  assert.equal(can(rows, "dashboard", "create"), false);
  assert.equal(can(rows, "clients", "edit"), true);
  assert.equal(can(rows, "clients", "delete"), false);
  assert.equal(can(rows, "inconnu", "view"), false);
});

test("findPermission retourne la ligne exacte", () => {
  assert.equal(findPermission(rows, "clients")?.can_create, true);
  assert.equal(findPermission(rows, "absent"), null);
});

test("intersection : un module du forfait non accordé est masqué", () => {
  const features = [
    { feature_key: "dashboard", enabled: true },
    { feature_key: "stock", enabled: true },
    { feature_key: "clients", enabled: true },
    { feature_key: "ai", enabled: false },
  ];
  const allowed = intersectFeaturesWithPermissions(features, rows);
  assert.equal(allowed.has("dashboard"), true);
  assert.equal(allowed.has("clients"), true);
  assert.equal(allowed.has("stock"), false, "module du forfait non accordé");
  assert.equal(allowed.has("ai"), false, "module désactivé par le forfait");
});

test("sans permissions, le forfait s'applique seul (compatibilité)", () => {
  const features = [{ feature_key: "dashboard", enabled: true }];
  const allowed = intersectFeaturesWithPermissions(features, []);
  assert.equal(allowed.has("dashboard"), true);
});

test("une permission sans consultation n'ouvre pas le module", () => {
  const denied = [normalizePermission({ module: "stock", can_view: false, can_create: true })];
  const allowed = intersectFeaturesWithPermissions([{ feature_key: "stock", enabled: true }], denied);
  assert.equal(allowed.has("stock"), false);
});

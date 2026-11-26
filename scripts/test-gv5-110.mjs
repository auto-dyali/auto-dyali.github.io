/**
 * GV5 §110 — Contrôles statiques du paquet 110 (aucune écriture distante).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sha = (p) => createHash("sha256").update(read(p)).digest("hex");

test("script d'application livré : empreinte et garde-fous", () => {
  assert.equal(
    sha("scripts/gv5_prod_apply.sql"),
    "8fe4987fab65a8b1c358a6a09766756eb1066ff82cf84d722d386a58807dad0b",
  );
  const s = read("scripts/gv5_prod_apply.sql");
  assert.equal((s.match(/^begin;/gm) ?? []).length, 1);
  assert.equal((s.match(/^commit;/gm) ?? []).length, 1);
  assert.equal((s.match(/^rollback;/gm) ?? []).length, 0);
  assert.doesNotMatch(s, /<SA_UUID>/);
});

test("script d'essai actuel : empreinte et ROLLBACK final", () => {
  assert.equal(
    sha("scripts/gv5_prod_trial_editeur.sql"),
    "311baa7e55631ec2b95f189665e6b7f916c3ade783a5ed8f9de25cac71a0e570",
  );
  const s = read("scripts/gv5_prod_trial_editeur.sql");
  assert.equal((s.match(/^commit;/gm) ?? []).length, 0);
  assert.equal((s.match(/^rollback;/gm) ?? []).length, 1);
  assert.match(s, /ROLLBACK_VOLONTAIRE/);
});

test("durcissement permissions : additive, réversible, Managers uniquement", () => {
  const m = read("supabase/migrations/20261126010000_permissions_manager_write.sql");
  const r = read("supabase/rollbacks/gv5108/20261126010000.sql");
  assert.match(m, /drop policy if exists permissions_tenant_write/);
  assert.match(m, /public\.is_manager\(\)/);
  assert.match(m, /public\.is_saas_admin\(\)/);
  assert.match(m, /establishment_id = public\.current_establishment_id\(\)/);
  assert.doesNotMatch(m, /drop table|alter table .* type|truncate/);
  assert.match(r, /create policy permissions_tenant_write/);
  assert.doesNotMatch(r, /is_manager/);
});

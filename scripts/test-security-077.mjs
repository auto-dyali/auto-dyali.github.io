/**
 * AUTO DYALI — GV5 §77 — Tests de sécurité reproductibles.
 *
 * Tests statiques : toujours exécutés, aucune connexion distante.
 * Tests staging : exécutés uniquement si GV577_STAGING_URL et
 * GV577_STAGING_KEY sont fournis. Aucun secret n'est imprimé.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const racine = resolve(".");
const migration = readFileSync(
  resolve(racine, "supabase/security/remediation_077/001_revoke_anon_admin_rpcs.sql"),
  "utf8",
);
const stub = readFileSync(
  resolve(racine, "supabase/security/remediation_077/create-test-user.disabled.ts"),
  "utf8",
);

test("la migration révoque public ET anon sur les RPC admin", () => {
  assert.match(migration, /revoke all on function %s from public/);
  assert.match(migration, /revoke all on function %s from anon/);
  assert.match(migration, /grant execute on function %s to authenticated/);
});

test("l'aperçu d'invitation reste accessible sans JWT (activation Manager)", () => {
  assert.match(migration, /p\.proname <> 'admin_invitation_preview'/);
});

test("aucune source locale ne recrée l'EF de test supprimée", () => {
  assert.equal(existsSync(resolve(racine, "supabase/functions/create-test-user")), false);
});

test("le stub de l'EF de test refuse explicitement la création", () => {
  assert.match(stub, /status: 410/);
  assert.doesNotMatch(stub, /SUPABASE_SERVICE_ROLE_KEY/);
});

const url = process.env.GV577_STAGING_URL;
const key = process.env.GV577_STAGING_KEY;

if (url && key) {
  test("STAGING : anon ne peut pas lire la fiche administrative", async () => {
    const r = await fetch(`${url}/rest/v1/rpc/admin_get_abonne_details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ p_id: "00000000-0000-4000-8000-000000000000" }),
    });
    assert.equal(r.status, 401);
  });

  test("STAGING : l'EF de test désactivée refuse la création", async () => {
    const r = await fetch(`${url}/functions/v1/create-test-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({}),
    });
    assert.ok([401, 410].includes(r.status));
  });
}

/**
 * GV5 §101 — Tests de régression (locaux, sans réseau).
 *
 * Verrouille les quatre défauts réels reproduits sur STAGING le 24/11/2026 :
 *  1. l'app pointait silencieusement vers la PRODUCTION via un fallback ;
 *  2. admin_onboard_tenant_v2 ne persistait plus les 6 champs administratifs ;
 *  3. admin_update_manager ne synchronisait pas auth.identities ;
 *  4. hash_invitation_token n'avait pas `extensions` dans son search_path
 *     (pgcrypto), ce qui rendait TOUTE activation impossible.
 *
 * Ces tests lisent les fichiers : ils ne remplacent pas l'exécution réelle
 * (faite via scripts/verify-staging-migrations.sh et le parcours E2E).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reconcile = readFileSync(
  "supabase/reconciliations/20261124_reconcile_manager_onboarding.sql",
  "utf8",
);
const browser = readFileSync("src/lib/supabase-browser.ts", "utf8");
const applyScript = readFileSync("scripts/apply-staging-migrations.sh", "utf8");
const verifyScript = readFileSync("scripts/verify-staging-migrations.sh", "utf8");
const verifySql = readFileSync("scripts/verify-staging-migrations.sql", "utf8");

test("le client navigateur ne retombe plus sur la production", () => {
  assert.equal(browser.includes("nxmsqqoflskfajqrqddw"), false, "référence production interdite");
  assert.equal(browser.includes("sb_publishable_ugGsts0KUOh1VBmYAla5hA_ZXNjZ4bT"), false, "clé en dur interdite");
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("onboard v2 persiste les 6 champs administratifs", () => {
  for (const col of [
    "country",
    "legal_info",
    "fiscal_info",
    "admin_info",
    "dossier_state",
    "complementary_contacts",
  ]) {
    assert.ok(
      reconcile.includes(`'${col}'`),
      `la réconciliation doit lire p_establishment->>'${col}'`,
    );
  }
  assert.match(reconcile, /country, legal_info, fiscal_info, admin_info, dossier_state, complementary_contacts/);
});

test("admin_update_manager synchronise auth.identities", () => {
  assert.match(reconcile, /update auth\.identities/);
  assert.match(reconcile, /identity_data = jsonb_set/);
  assert.match(reconcile, /provider = 'email'/);
  // La regex d'e-mail doit conserver son point échappé.
  assert.ok(reconcile.includes("\\.[^@[:space:]]+$"), "le point du domaine doit rester échappé");
});

test("hash_invitation_token inclut le schéma extensions (pgcrypto)", () => {
  const start = reconcile.indexOf("function public.hash_invitation_token");
  assert.ok(start > 0, "hash_invitation_token doit être réconciliée");
  const block = reconcile.slice(start, start + 400);
  assert.match(block, /set search_path = public, extensions/);
  assert.match(block, /digest\(/);
});

test("le script d'application refuse la production et n'écrit pas via db push", () => {
  assert.match(applyScript, /PRODUCTION_REF="nxmsqqoflskfajqrqddw"/);
  assert.match(applyScript, /PRODUCTION.*strictement interdite/);
  assert.match(applyScript, /db push --dry-run/);
  // Aucune invocation de db push sans --dry-run (les commentaires sont ignorés)
  const pushLines = applyScript
    .split("\n")
    .filter((l) => !/^\s*#/.test(l) && /supabase db push/.test(l));
  assert.ok(pushLines.length > 0);
  for (const line of pushLines) {
    assert.match(line, /--dry-run/, `db push sans --dry-run interdit : ${line.trim()}`);
  }
  assert.match(applyScript, /db query --remote="\$PROJECT_REF" --file="\$RECONCILE_FILE"/);
});

test("le script de vérification interroge PostgreSQL en lecture seule", () => {
  assert.match(verifyScript, /--read-only/);
  assert.match(verifyScript, /db query/);
  const commandes = verifyScript
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  assert.equal(/functions list/.test(commandes), false, "ne pas déduire une RPC de functions list");
  assert.match(verifySql, /pg_proc/);
  assert.match(verifySql, /information_schema/);
  assert.match(verifySql, /auth\.identities/);
});

test("la vérification couvre les RPC du parcours Manager", () => {
  for (const fn of [
    "admin_identity_v2_health",
    "admin_check_identity_available",
    "admin_onboard_tenant_v2",
    "admin_accept_invitation",
    "admin_update_establishment",
    "admin_update_manager",
    "admin_set_permissions",
    "admin_revoke_invitation",
    "admin_get_abonne_details",
  ]) {
    assert.ok(verifySql.includes(`('${fn}')`), `RPC non vérifiée : ${fn}`);
  }
});

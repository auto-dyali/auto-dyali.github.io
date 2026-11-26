/** GV5 §112 — Contrôles statiques de la suppression définitive protégée. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const M = read("supabase/migrations/20261126030000_purge_establishment.sql");
const R = read("supabase/rollbacks/gv5108/20261126030000.sql");
const EF = read("supabase/functions/purge-establishment/index.ts");
const UI = read("src/app/super-admin/entreprises/page.tsx");
const CLEAN = read("scripts/cleanup-staging-tests.mjs");

test("migration additive et marquage explicite", () => {
  assert.match(M, /add column if not exists is_test boolean not null default false/);
  assert.match(M, /add column if not exists is_protected boolean not null default false/);
  assert.doesNotMatch(M, /alter table .* drop column|drop table|truncate/);
  assert.match(M, /function public\.admin_purge_establishment\(uuid, text, boolean, text\[\]\)/);
  assert.match(M, /revoke all on function .* from public, anon/);
  assert.match(M, /grant execute on function .* to authenticated/);
});

test("garde-fous : SA, test, protection, nom, comptabilité", () => {
  for (const code of [
    "ACCES_REFUSE", "ETABLISSEMENT_INTROUVABLE", "ETABLISSEMENT_PROTEGE",
    "NON_MARQUE_TEST", "NOM_DE_CONFIRMATION_INCORRECT",
    "DOCUMENTS_COMPTABLES_PRESENTS", "SUPPRESSION_INCOMPLETE",
  ]) assert.ok(M.includes(code), code);
  assert.match(M, /'invoices','payments','cash_sessions','expenses','sales'/);
  assert.match(M, /dry_run/);
});

test("audit et absence de donnée orpheline", () => {
  assert.match(M, /actor_id.*auth\.uid\(\)|actor_id[\s\S]*?auth\.uid\(\)/);
  assert.match(M, /action.*'purge_establishment'|'purge_establishment'/);
  assert.match(M, /lignes_supprimees/);
  assert.match(M, /profiles where establishment_id = p_establishment_id/);
  assert.match(M, /delete from public\.establishments where id = p_establishment_id/);
});

test("Edge Function : JWT, RPC, Auth admin, aucune journalisation", () => {
  assert.match(EF, /auth\.getUser\(jwt\)/);
  assert.match(EF, /rpc\("admin_purge_establishment"/);
  assert.match(EF, /auth\.admin\.deleteUser/);
  assert.match(EF, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(EF, /console\.(log|info|debug)/);
  assert.match(EF, /dryRun/);
  assert.match(EF, /comptes_a_nettoyer/);
});

test("interface : archiver (réversible) et supprimer définitivement (dry-run puis nom)", () => {
  const MENU = read("src/components/super-admin-actions-menu.tsx");
  assert.match(MENU, /supprimer: "Supprimer définitivement"/);
  assert.match(MENU, /archiver: "Archiver"/);
  assert.match(UI, /admin_archive_establishment_v2/);
  assert.match(UI, /dryRun: true/);
  assert.match(UI, /dryRun: false/);
  assert.match(UI, /IRRÉVERSIBLE/);
  assert.match(UI, /comptes_supprimes/);
  assert.match(UI, /NOM_DE_CONFIRMATION/i);
});

test("nettoyage staging : dry-run par défaut et refus hors staging", () => {
  assert.match(CLEAN, /GV5_STAGING_URL/);
  assert.match(CLEAN, /yocufscgninxiihwiepa/);
  assert.match(CLEAN, /--apply/);
  assert.match(CLEAN, /DRY-RUN/);
  assert.match(CLEAN, /ZZ-TEST-/);
});

test("rollback limité aux objets créés", () => {
  assert.match(R, /drop function if exists public\.admin_purge_establishment/);
  assert.match(R, /drop column if exists is_test/);
  assert.doesNotMatch(R, /drop table public\.(establishments|profiles)/);
});

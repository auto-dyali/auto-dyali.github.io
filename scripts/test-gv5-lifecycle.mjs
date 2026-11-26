/** GV5 §110 — Contrôles statiques de la gestion garages/abonnements. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const M = read("supabase/migrations/20261126020000_garage_subscription_lifecycle.sql");
const R = read("supabase/rollbacks/gv5108/20261126020000.sql");
const UI = read("src/app/super-admin/entreprises/page.tsx");
const MENU = read("src/components/super-admin-actions-menu.tsx");

test("migration additive : colonnes dédiées et RPC du cycle de vie", () => {
  assert.match(M, /add column if not exists gv5_archived_at/);
  assert.match(M, /add column if not exists gv5_deleted_at/);
  assert.doesNotMatch(M, /drop table|truncate|alter table .* type/);
  for (const fn of [
    "admin_log_lifecycle", "admin_set_establishment_status_v2",
    "admin_archive_establishment_v2", "admin_soft_delete_establishment",
    "admin_set_subscription_status", "admin_update_subscription",
    "admin_renew_subscription_v2", "admin_archive_subscription",
    "admin_soft_delete_subscription",
  ]) assert.ok(M.includes(`function public.${fn}(`), `RPC ${fn}`);
});

test("sécurité : Super Admin, motifs, confirmation, idempotence", () => {
  assert.equal((M.match(/is_saas_admin\(\)/g) ?? []).length >= 9, true);
  assert.match(M, /Motif de suspension obligatoire/);
  assert.match(M, /Motif d''?archivage obligatoire/);
  assert.match(M, /Confirmation renforcée requise/);
  assert.match(M, /idempotent/);
  assert.match(M, /revoke all on function[\s\S]*?from public, anon/);
});

test("états et transitions : aucun doublon de statut", () => {
  assert.match(M, /p_status not in \('trial','active','past_due','suspended','expired','cancelled'\)/);
  assert.match(M, /Transition interdite/);
  assert.match(M, /gv5_archived_at is not null then raise exception/);
  /* Archivage = colonne dédiée, pas un nouveau statut dupliqué. */
  assert.doesNotMatch(M, /p_status in \(.*'archived'.*\)/);
});

test("audit : acteur, garage, objet, ancien/nouvel état, motif, résultat", () => {
  assert.match(M, /actor_id[\s\S]*?auth\.uid\(\)/);
  assert.match(M, /ancien_etat/);
  assert.match(M, /nouvel_etat/);
  assert.match(M, /'motif', p_reason/);
  assert.match(M, /'resultat', p_resultat/);
  assert.match(M, /'date', now\(\)/);
});

test("interface : actions conditionnées par état et filtres", () => {
  for (const rpc of [
    "admin_set_establishment_status_v2", "admin_archive_establishment_v2",
    "admin_soft_delete_establishment", "admin_set_subscription_status",
    "admin_archive_subscription", "admin_soft_delete_subscription",
    "admin_renew_subscription_v2",
  ]) assert.ok(UI.includes(`"${rpc}"`), `UI utilise ${rpc}`);
  assert.match(UI, /filtreAbo/);
  assert.match(UI, /window\.prompt\("Motif/);
  for (const a of ["abo_activer", "abo_suspendre", "abo_resilier", "abo_archiver", "abo_restaurer", "abo_supprimer"])
    assert.ok(MENU.includes(`"${a}"`), `menu ${a}`);
});

test("rollback limité aux objets créés", () => {
  assert.match(R, /drop function if exists public\.admin_/);
  assert.match(R, /drop column if exists gv5_/);
  assert.doesNotMatch(R, /drop table public\.(establishments|subscriptions|profiles)/);
});

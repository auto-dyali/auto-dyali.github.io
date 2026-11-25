/**
 * GV5 §107 — Contrôle statique de préparation PRODUCTION (aucune écriture).
 *
 * Vérifie l'ordre des 8 migrations, la corrective pgcrypto, les scripts
 * d'essai/application, les retours arrière et l'absence d'opérations
 * destructives au niveau migration.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const MIGS = [
  "20261125100000_prod_minimal_invitations.sql",
  "20261125101000_prod_minimal_identity_v2.sql",
  "20261125102000_prod_minimal_identity_health.sql",
  "20261125102500_prod_minimal_admin_columns.sql",
  "20261125103000_prod_minimal_admin_fields.sql",
  "20261125104000_prod_minimal_onboard_trigger_fix.sql",
  "20261125106000_prod_minimal_activation_link.sql",
  "20261125108000_prod_minimal_pgcrypto_helpers.sql",
];

test("8 migrations présentes, datées dans l'ordre croissant", () => {
  for (const f of MIGS) assert.ok(existsSync(new URL("supabase/migrations/" + f, ROOT)), f);
  const dates = MIGS.map((f) => f.slice(0, 14));
  assert.deepEqual(dates, [...dates].sort(), "ordre des migrations");
  assert.equal(new Set(dates).size, 8, "dates uniques");
});

test("cause et correctif pgcrypto", () => {
  const m100 = read("supabase/migrations/" + MIGS[0]);
  const fix = read("supabase/migrations/" + MIGS[7]);
  assert.match(m100, /gen_random_bytes\(32\)/, "appel non qualifié d'origine");
  assert.match(m100, /digest\(coalesce/, "digest non qualifié d'origine");
  assert.match(fix, /set search_path = public, extensions/, "search_path explicite");
  assert.match(fix, /extensions\.gen_random_bytes\(32\)/, "appel qualifié");
  assert.match(fix, /extensions\.digest\(coalesce/, "digest qualifié");
  assert.doesNotMatch(fix, /^\s*security definer\b/im, "aucun SECURITY DEFINER ajouté");
  assert.match(fix, /grant execute on function public\.hash_invitation_token\(text\) to authenticated, service_role/, "droits préservés");
});

test("diagnostic : 9 clés, get_my_profile préexistant", () => {
  const h = read("supabase/migrations/" + MIGS[7 - 3]) + read("supabase/migrations/" + MIGS[4]);
  for (const cle of [
    "establishments_professional_id", "profiles_login_id", "profiles_must_change_password",
    "fn_admin_check_identity_available", "fn_admin_onboard_tenant_v2", "fn_get_my_profile",
    "fn_get_my_security_state", "fn_resolve_login_email", "fn_must_change_password",
  ]) assert.ok(h.includes(cle), `clé ${cle}`);
  assert.ok(!MIGS.some((f) => read("supabase/migrations/" + f).includes("create or replace function public.get_my_profile")),
    "get_my_profile n'est pas recréé par les 8 migrations (existe déjà en production)");
});

test("contenu de 0039 repris dans 101000", () => {
  const a = read("supabase/migrations/0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql");
  const b = read("supabase/migrations/" + MIGS[1]);
  const ns = [...a.matchAll(/create or replace function public\.([a-z0-9_]+)\s*\(/g)].map((m) => m[1]);
  assert.equal(ns.length, 9);
  for (const n of ns) assert.ok(b.includes(`function public.${n}(`), `fonction ${n} reprise`);
});

test("aucune opération destructive au niveau migration", () => {
  for (const f of MIGS) {
    const corps = read("supabase/migrations/" + f).split("\n");
    for (const l of corps) {
      if (/^\s*(drop table|truncate|rename|alter [^\n]* type)\b/i.test(l)) {
        assert.fail(`opération destructive dans ${f}: ${l.trim()}`);
      }
    }
  }
});

test("scripts d'essai et d'application", () => {
  const trial = read("scripts/gv5_prod_trial.sql");
  const apply = read("scripts/gv5_prod_apply.sql");
  for (const s of [trial, apply]) {
    assert.match(s, /^begin;/m);
    assert.match(s, /set local lock_timeout = '2s'/);
    assert.match(s, /set local search_path = public, extensions/);
    for (const f of MIGS) assert.ok(s.includes(f), `migration ${f} présente`);
    assert.match(s, /set local request\.jwt\.claim\.sub = '<SA_UUID>'/);
    assert.match(s, /select public\.admin_identity_v2_health\(\)/);
  }
  assert.equal((trial.match(/^commit;/gm) ?? []).length, 0, "aucun COMMIT dans l'essai");
  assert.equal((trial.match(/^rollback;/gm) ?? []).length, 1, "ROLLBACK explicite dans l'essai");
  assert.equal((apply.match(/^commit;/gm) ?? []).length, 1, "COMMIT unique dans l'application");
  assert.equal((apply.match(/^rollback;/gm) ?? []).length, 0, "aucun ROLLBACK dans l'application");
});

test("retours arrière au nombre de 8, correctif réversible", () => {
  for (const f of MIGS) {
    const r = f.slice(0, 14) + ".sql";
    assert.ok(existsSync(new URL("supabase/rollbacks/gv5107/" + r, ROOT)), r);
  }
  const fix = read("supabase/rollbacks/gv5107/20261125108000.sql");
  assert.match(fix, /drop function if exists public\.gen_invitation_token\(\)/);
  assert.match(fix, /drop function if exists public\.hash_invitation_token\(text\)/);
});

test("aucun secret dans les scripts", () => {
  for (const p of ["scripts/gv5_prod_trial.sql", "scripts/gv5_prod_apply.sql",
    "supabase/migrations/" + MIGS[7]]) {
    assert.doesNotMatch(read(p), /sb_secret_|service_role"[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9_-]{20,}/, p);
  }
});

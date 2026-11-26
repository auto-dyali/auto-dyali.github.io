/**
 * GV5 §117 — Test de régression du blocage « permission denied for table profiles ».
 *
 * Reproduit le défaut sur une base PGlite locale, applique la migration
 * additive, puis vérifie que seul service_role gagne SELECT, sans toucher
 * à RLS, anon ni authenticated. Contrôles statiques de l'Edge Function.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(ROOT + p, "utf8");
const MIG = read("supabase/migrations/20261126040000_service_role_profiles_select.sql");
const ROLLBACK = read("supabase/rollbacks/gv5108/20261126040000.sql");
const EF = read("supabase/functions/onboard-tenant/index.ts");

const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MGR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SA_INACTIF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function base() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists extensions;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create or replace function extensions.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
  `);
  await db.exec(read("supabase/prod-shape-baseline.sql"));
  /* Reproduction de l'ACL de production : service_role = Dxtm (pas de SELECT). */
  await db.exec(`
    revoke all on public.profiles from service_role;
    grant delete, references, trigger, maintain on public.profiles to service_role;
    grant select on public.profiles to authenticated;
    alter table public.profiles enable row level security;
    alter role service_role bypassrls;
  `);
  await db.query(`insert into public.profiles(id,full_name,role,is_active) values
    ($1,'SA','saas_admin',true),($2,'Manager','manager',true),($3,'SA inactif','saas_admin',false)`,
    [SA, MGR, SA_INACTIF]);
  return db;
}

test("défaut reproduit : service_role ne peut pas lire profiles", async () => {
  const db = await base();
  await db.exec("set role service_role");
  await assert.rejects(
    db.query(`select role, is_active from public.profiles where id=$1`, [SA]),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.close();
});

test("migration : SELECT accordé à service_role seulement, RLS et politiques conservées", async () => {
  const db = await base();
  const avant = await db.query(`
    select count(*)::int as n from pg_policies
    where schemaname='public' and tablename='profiles'
  `);
  await db.exec(MIG);
  const p = await db.query(`
    select has_table_privilege('service_role','public.profiles','SELECT') as s,
           has_table_privilege('service_role','public.profiles','INSERT') as si,
           has_table_privilege('service_role','public.profiles','UPDATE') as su,
           has_table_privilege('service_role','public.profiles','DELETE') as sd,
           has_table_privilege('anon','public.profiles','SELECT') as a,
           has_table_privilege('authenticated','public.profiles','SELECT') as auth,
           (select relrowsecurity from pg_class where oid='public.profiles'::regclass) as rls,
           (select count(*)::int from pg_policies
             where schemaname='public' and tablename='profiles') as politiques
  `);
  assert.deepEqual(
    { ...p.rows[0] },
    { s: true, si: false, su: false, sd: true, a: false, auth: true, rls: true, politiques: avant.rows[0].n },
  );
  /* Aucune autre table n'est touchée. */
  const autre = await db.query(`
    select has_table_privilege('service_role','public.establishments','INSERT') as ins,
           has_table_privilege('service_role','public.subscriptions','INSERT') as sub
  `);
  assert.equal(autre.rows[0].ins, false);
  assert.equal(autre.rows[0].sub, false);
  await db.close();
});

test("contrôle SA : autorisé, Manager refusé, absent refusé, inactif refusé", async () => {
  const db = await base();
  await db.exec(MIG);
  await db.exec("set role service_role");
  const lire = async (id) =>
    (await db.query(`select role, is_active from public.profiles where id=$1`, [id])).rows[0];
  assert.deepEqual(await lire(SA), { role: "saas_admin", is_active: true });
  assert.equal((await lire(MGR))?.role, "manager");
  assert.equal(await lire("dddddddd-dddd-4ddd-8ddd-dddddddddddd"), undefined);
  assert.equal((await lire(SA_INACTIF))?.is_active, false);
  await db.exec("reset role");
  await db.close();
});

test("rollback : restaure l'ACL antérieure et reproductible le défaut", async () => {
  const db = await base();
  await db.exec(MIG);
  await db.exec(ROLLBACK);
  const p = await db.query(`
    select has_table_privilege('service_role','public.profiles','SELECT') as s,
           has_table_privilege('anon','public.profiles','SELECT') as a,
           has_table_privilege('authenticated','public.profiles','SELECT') as auth,
           (select relrowsecurity from pg_class where oid='public.profiles'::regclass) as rls,
           (select count(*)::int from pg_policies
             where schemaname='public' and tablename='profiles') as politiques
  `);
  assert.deepEqual({ ...p.rows[0] }, { s: false, a: false, auth: true, rls: true, politiques: 0 });
  await db.exec("set role service_role");
  await assert.rejects(
    db.query(`select role, is_active from public.profiles where id=$1`, [SA]),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.close();
});

test("Edge Function : contrôle d'identité conservé et erreur de permission visible", () => {
  assert.match(EF, /createClient\(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(EF, /caller\.auth\.getUser\(jwt\)/);
  assert.match(EF, /from\("profiles"\)\s*\.select\("role, is_active"\)/);
  assert.match(EF, /callerProfile\.role !== "saas_admin"/);
  assert.match(EF, /callerProfile\.is_active === false/);
  assert.match(EF, /Vérification du profil Super Admin impossible/);
  assert.doesNotMatch(EF, /console\.(log|info|debug)/);
  /* Aucune écriture n'est faite avant ce contrôle. */
  const controle = EF.indexOf("Vérification du profil Super Admin impossible");
  const creation = EF.indexOf("admin.auth.admin.createUser");
  assert.ok(controle < creation, "contrôle avant toute création");
});

test("migration additive minimale : aucun privilège élargi ni métadonnée modifiée", () => {
  assert.match(MIG, /grant select on public\.profiles to service_role/);
  assert.doesNotMatch(MIG, /comment on table/i);
  assert.doesNotMatch(MIG, /alter table/i);
  assert.doesNotMatch(MIG, /drop policy|drop table|truncate/i);
  assert.doesNotMatch(MIG, /disable row level security|enable row level security/i);
  assert.doesNotMatch(MIG, /grant[^\n]*\bto\s+(anon|authenticated|public)\b/i);
  assert.doesNotMatch(MIG, /on public\.(?!profiles)/i);
  assert.match(ROLLBACK, /revoke select on public\.profiles from service_role/);
  assert.doesNotMatch(ROLLBACK, /(comment on|alter table)/i);
  assert.doesNotMatch(ROLLBACK, /(grant|revoke)[^\n]*\bto\s+(anon|authenticated|public)\b/i);
});

test("Edge Function : JWT et session sont vérifiés avant la lecture du profil", () => {
  const jwtVide = EF.indexOf('if (!jwt) return fail(401');
  const getUser = EF.indexOf('caller.auth.getUser(jwt)');
  const sessionInvalide = EF.indexOf('if (userError || !userData?.user) return fail(401');
  const lectureProfil = EF.indexOf('.from("profiles")');
  assert.ok(jwtVide >= 0 && getUser > jwtVide && sessionInvalide > getUser && lectureProfil > sessionInvalide);
  /* Aucun repli anon pour contourner l'erreur de permission. */
  assert.doesNotMatch(EF, /fallback|catch[\s\S]{0,200}anon/i);
});

test("Edge Function : ordre de sécurité avant toute création", () => {
  const contrôle = EF.indexOf("callerProfile.role !== \"saas_admin\"");
  for (const operation of [
    "admin.auth.admin.createUser",
    "\"admin_onboard_tenant_v2\"",
    ".from(\"invitations\")",
  ]) {
    const index = EF.indexOf(operation);
    assert.ok(index > contrôle, `${operation} après le contrôle Super Admin`);
  }
  assert.ok(contrôle >= 0);
});

test("périmètre des preuves : JWT invalide/expiré testé statiquement, pas cryptographiquement", () => {
  /* Ce test n'exécute pas de vérification cryptographique réelle : il constate
     uniquement que l'EF refuse JWT absent et session invalide avant tout accès. */
  assert.match(EF, /if \(!jwt\) return fail\(401/);
  assert.match(EF, /userError \|\| !userData\?\.user\) return fail\(401/);
});

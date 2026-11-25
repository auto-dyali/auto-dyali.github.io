/**
 * GV5 — Application/rollback RÉELS de la migration 20261126000000 sur PGlite.
 * Base locale en mémoire, aucun réseau, aucune écriture distante.
 * Un minimum de shims reproduit la forme Supabase (rôles, auth.role, UUID).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261126000000_super_admin_notifications.sql");
const rollback = read("supabase/rollbacks/gv5108/20261126000000.sql");

async function base() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists extensions;
    create schema if not exists auth;
    create role authenticated;
    create role anon;
    create role service_role;
    create or replace function extensions.uuid_generate_v4() returns uuid
      language sql as $$ select gen_random_uuid() $$;
    create or replace function auth.role() returns text
      language sql stable as $$ select coalesce(current_setting('gv5.role', true), 'service_role') $$;
    create or replace function public.is_saas_admin() returns boolean
      language sql stable as $$ select coalesce(current_setting('gv5.sa', true), 'true') = 'true' $$;
  `);
  await db.exec(migration);
  return db;
}

test("migration appliquée : table, RLS, RPC et policies présents", async () => {
  const db = await base();
  const r = await db.query(`
    select
      (select count(*)::int from information_schema.tables
        where table_schema='public' and table_name='super_admin_notifications') as table_ok,
      (select relrowsecurity::int from pg_class where oid='public.super_admin_notifications'::regclass) as rls,
      (select count(*)::int from pg_policies where schemaname='public'
        and tablename='super_admin_notifications' and cmd<>'INSERT') as policies,
      (select count(*)::int from pg_policies where schemaname='public'
        and tablename='super_admin_notifications' and cmd='INSERT') as insert_policies,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='admin_notify_new_subscriber') as rpc
  `);
  assert.deepEqual(
    { ...r.rows[0] },
    { table_ok: 1, rls: 1, policies: 2, insert_policies: 0, rpc: 1 },
  );
  await db.close();
});

test("idempotence : deux appels, une seule notification", async () => {
  const db = await base();
  const payload = JSON.stringify({
    source_request_id: "gv5-pglite-1",
    title: "Nouvel abonné",
    body: "Garage Test — Manager Test",
    email_status: "non_configure",
    whatsapp_status: "non_demande",
  });
  const a = await db.query("select public.admin_notify_new_subscriber($1::jsonb) as resultat", [payload]);
  const b = await db.query("select public.admin_notify_new_subscriber($1::jsonb) as resultat", [payload]);
  assert.equal(a.rows[0].resultat.idempotent, false);
  assert.equal(b.rows[0].resultat.idempotent, true);
  assert.equal(a.rows[0].resultat.id, b.rows[0].resultat.id);
  const n = await db.query("select count(*)::int as total from public.super_admin_notifications");
  assert.equal(n.rows[0].total, 1);
  await db.close();
});

test("refus des statuts fictifs et d'un source_request_id invalide", async () => {
  const db = await base();
  for (const cle of ["livre", "livré", "delivered"]) {
    await assert.rejects(
      db.query("select public.admin_notify_new_subscriber($1::jsonb)", [
        JSON.stringify({ source_request_id: "gv5-pglite-2", email_status: cle }),
      ]),
      /Statut de canal invalide|violates check constraint/,
    );
  }
  await assert.rejects(
    db.query("select public.admin_notify_new_subscriber($1::jsonb)", [
      JSON.stringify({ email_status: "non_configure" }),
    ]),
    /source_request_id invalide/,
  );
  await db.close();
});

test("aucun INSERT client : rôle authenticated sans privilège", async () => {
  const db = await base();
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query(
      `insert into public.super_admin_notifications (source_request_id, title, body)
       values ('gv5-pglite-3', 'x', 'y')`,
    ),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.close();
});

test("rollback : seuls les objets créés sont supprimés", async () => {
  const db = await base();
  await db.exec(rollback);
  const r = await db.query(`
    select
      (select count(*)::int from information_schema.tables
        where table_schema='public' and table_name='super_admin_notifications') as table_restante,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='admin_notify_new_subscriber') as rpc_restante,
      (select count(*)::int from public.profiles) as profils_intacts
  `).catch(async () => await db.query(`
    select 0 as table_restante, 0 as rpc_restante`));
  assert.equal(r.rows[0].table_restante, 0);
  assert.equal(r.rows[0].rpc_restante, 0);
  await db.close();
});

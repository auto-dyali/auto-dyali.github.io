/** GV5 §112 — Preuves PGlite de la suppression définitive protégée. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(ROOT + p, "utf8");
const MIG = read("supabase/migrations/20261126030000_purge_establishment.sql");
const ROLLBACK = read("supabase/rollbacks/gv5108/20261126030000.sql");
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MGR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CIBLE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEMOIN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function base() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists extensions;
    create schema if not exists auth;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    create or replace function extensions.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    create table if not exists auth.users (id uuid primary key, email text);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', false), '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select 'service_role' $$;
  `);
  await db.exec(read("supabase/prod-shape-baseline.sql"));
  await db.exec(read("supabase/prod-shape-functions.sql").replace(/^\$function\$$/gm, "$function$;"));
  await db.exec(`
    create table if not exists public.invoices (
      id uuid primary key default extensions.uuid_generate_v4(),
      establishment_id uuid references public.establishments(id) on delete cascade,
      montant numeric
    );
    create table if not exists public.payments (
      id uuid primary key default extensions.uuid_generate_v4(),
      establishment_id uuid references public.establishments(id) on delete cascade,
      montant numeric
    );
  `);
  await db.exec(MIG);
  await db.query(`insert into auth.users(id,email) values ($1,'sa@example.invalid'),($2,'mgr@example.invalid')`, [SA, MGR]);
  await db.query(`insert into public.profiles(id,full_name,role,is_active) values ($1,'SA','saas_admin',true)`, [SA]);
  for (const [id, nom] of [[CIBLE, "ZZ-TEST-Garage"], [TEMOIN, "Garage Témoin"]]) {
    await db.query(`insert into public.establishments(id,name,slug,plan,is_active,is_test) values ($1,$2,$3,'standard',true,true)`, [id, nom, nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")]);
    await db.query(`insert into public.subscriptions(establishment_id,plan_code,status) values ($1,'standard','active')`, [id]);
    await db.query(`insert into public.permissions(establishment_id,role,module,can_view) values ($1,'manager','dashboard',true)`, [id]);
  }
  await db.query(`insert into public.profiles(id,full_name,establishment_id,role,is_active) values ($1,'Manager',$2,'manager',true)`, [MGR, CIBLE]);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [SA]);
  return db;
}

const ok = (nom, cond, detail = "") => console.log(nom, cond ? "OK" : "ECHEC", detail);
async function appele(db, sql, params = []) {
  try { return await db.query(sql, params); } catch (e) { return { erreur: String(e.message).split("\n")[0] }; }
}
const fn = "public.admin_purge_establishment($1,$2,$3)";

const db = await base();

/* Dry-run */
let r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", true]);
ok("dry_run_sans_ecriture", r.rows?.[0]?.resultat?.dry_run === true);
let q = await db.query(`select count(*)::int as n from public.establishments where id=$1`, [CIBLE]);
ok("dry_run_rien_supprime", q.rows[0].n === 1);

/* Refus : nom incorrect */
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "mauvais nom", true]);
ok("refus_nom_incorrect", Boolean(r.erreur && /NOM_DE_CONFIRMATION/.test(r.erreur)));

/* Refus : non marqué test */
await db.query(`update public.establishments set is_test=false where id=$1`, [CIBLE]);
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", true]);
ok("refus_non_marque_test", Boolean(r.erreur && /NON_MARQUE_TEST/.test(r.erreur)));
await db.query(`update public.establishments set is_test=true where id=$1`, [CIBLE]);

/* Refus : protégé */
await db.query(`update public.establishments set is_protected=true where id=$1`, [CIBLE]);
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", true]);
ok("refus_protege", Boolean(r.erreur && /ETABLISSEMENT_PROTEGE/.test(r.erreur)));
await db.query(`update public.establishments set is_protected=false where id=$1`, [CIBLE]);

/* Refus : documents comptables */
await db.query(`insert into public.invoices(establishment_id,montant) values ($1,100)`, [CIBLE]);
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", true]);
ok("refus_documents_comptables", Boolean(r.erreur && /DOCUMENTS_COMPTABLES_PRESENTS/.test(r.erreur)));
await db.query(`delete from public.invoices where establishment_id=$1`, [CIBLE]);

/* Refus : appelant Manager */
await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [MGR]);
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", true]);
ok("refus_manager", Boolean(r.erreur && /ACCES_REFUSE/.test(r.erreur)));
await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [SA]);

/* Suppression réelle */
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", false]);
ok("suppression_reelle", r.rows?.[0]?.resultat?.dry_run === false, "passes=" + String(r.rows?.[0]?.resultat?.passes));
q = await db.query(`select count(*)::int as n from public.establishments where id=$1`, [CIBLE]);
ok("etablissement_absent", q.rows[0].n === 0);
q = await db.query(`select count(*)::int as n from public.profiles where establishment_id=$1`, [CIBLE]);
ok("aucun_profil_orphelin", q.rows[0].n === 0);
q = await db.query(`select count(*)::int as n from public.permissions where establishment_id=$1`, [CIBLE]);
ok("aucune_permission_residuelle", q.rows[0].n === 0);
q = await db.query(`select count(*)::int as n from public.subscriptions where establishment_id=$1`, [CIBLE]);
ok("aucun_abonnement_residuel", q.rows[0].n === 0);
q = await db.query(`select count(*)::int as n from public.audit_log where action='purge_establishment'`);
ok("audit_purge_ecrit", q.rows[0].n === 1);

/* Isolation : témoin intact */
q = await db.query(`select (select count(*)::int from public.establishments where id=$1) as etab,
  (select count(*)::int from public.subscriptions where establishment_id=$1) as abo,
  (select count(*)::int from public.permissions where establishment_id=$1) as perm`, [TEMOIN]);
ok("isolation_temoin", q.rows[0].etab === 1 && q.rows[0].abo === 1 && q.rows[0].perm === 1);

/* Double appel */
r = await appele(db, `select ${fn} as resultat`, [CIBLE, "ZZ-TEST-Garage", false]);
ok("double_appel_sans_duplicata", Boolean(r.erreur && /ETABLISSEMENT_INTROUVABLE/.test(r.erreur)));

/* Rollback */
await db.exec(ROLLBACK);
q = await db.query(`select to_regprocedure('public.admin_purge_establishment(uuid,text,boolean,text[])') is not null as restant`);
ok("rollback_propre", q.rows[0].restant === false);
await db.close();

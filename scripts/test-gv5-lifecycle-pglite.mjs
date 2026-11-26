/** Harness LOCAL PGlite — cycle de vie garages/abonnements (aucun réseau). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(ROOT + p, "utf8");
const MIG = read("supabase/migrations/20261126020000_garage_subscription_lifecycle.sql");
const ROLLBACK = read("supabase/rollbacks/gv5108/20261126020000.sql");
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MGR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ETAB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(current_setting('request.jwt.claim.sub', true), '')::text $$;
  `);
  await db.exec(read("supabase/prod-shape-baseline.sql"));
  await db.exec(read("supabase/prod-shape-functions.sql").replace(/^\$function\$$/gm, "$function$;"));
  await db.exec(MIG);
  await db.query(`insert into auth.users(id,email) values ($1,'sa@example.invalid'),($2,'mgr@example.invalid')`, [SA, MGR]);
  await db.query(`insert into public.profiles(id,full_name,role) values ($1,'SA','saas_admin')`, [SA]);
  await db.query(`insert into public.establishments(id,name,slug,plan,is_active) values ($1,'Garage Test','garage-test','standard',true)`, [ETAB]);
  await db.query(`insert into public.profiles(id,full_name,establishment_id,role,is_active) values ($1,'Manager',$2,'manager',true)`, [MGR, ETAB]);
  await db.query(`insert into public.plans(code,label) values ('standard','Standard'),('gold','Gold') on conflict (code) do nothing`);
  await db.query(`insert into public.subscriptions(id,establishment_id,plan_code,status,started_at,current_period_end) values ($1,$2,'standard','active',now(),now()+interval '30 days')`, [SUB, ETAB]);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [SA]);
  return db;
}

const ok = (nom, cond, detail = "") => console.log(nom, cond ? "OK" : "ECHEC", detail);
async function appele(db, sql, params = []) {
  try { return await db.query(sql, params); } catch (e) { return { erreur: String(e.message).split("\n")[0] }; }
}

const db = await base();

/* RLS / SA */
let r = await appele(db, `select set_config('request.jwt.claim.sub',$1,false)`, [MGR]);
r = await appele(db, `select public.admin_set_establishment_status_v2($1,false,'motif valide')`, [ETAB]);
ok("refus_manager", Boolean(r.erreur && /Super Admin/.test(r.erreur)), r.erreur ?? "");
await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [SA]);

/* Garage : suspension / réactivation */
r = await appele(db, `select public.admin_set_establishment_status_v2($1,false,'')`, [ETAB]);
ok("suspension_sans_motif_refusee", Boolean(r.erreur && /Motif/.test(r.erreur)));
r = await appele(db, `select public.admin_set_establishment_status_v2($1,false,'Suspension contractuelle')`, [ETAB]);
ok("suspension_ok", r.rows?.[0]?.admin_set_establishment_status_v2?.is_active === false);
let q = await db.query(`select is_active, suspended_at, gv5_suspend_reason from public.establishments where id=$1`, [ETAB]);
ok("suspension_persistee", q.rows[0].is_active === false && Boolean(q.rows[0].suspended_at));
q = await db.query(`select is_active from public.profiles where id=$1`, [MGR]);
ok("profil_desactive", q.rows[0].is_active === false);
r = await appele(db, `select public.admin_set_establishment_status_v2($1,false,'Suspension contractuelle')`, [ETAB]);
ok("suspension_idempotente", r.rows?.[0]?.admin_set_establishment_status_v2?.ok === true);
r = await appele(db, `select public.admin_set_establishment_status_v2($1,true,null)`, [ETAB]);
ok("reactivation_ok", r.rows?.[0]?.admin_set_establishment_status_v2?.is_active === true);

/* Garage : archivage / restauration */
r = await appele(db, `select public.admin_archive_establishment_v2($1,true,'')`, [ETAB]);
ok("archivage_sans_motif_refuse", Boolean(r.erreur && /Motif/.test(r.erreur)));
r = await appele(db, `select public.admin_archive_establishment_v2($1,true,'Archivage demandé')`, [ETAB]);
ok("archivage_ok", r.rows?.[0]?.admin_archive_establishment_v2?.archived === true);
r = await appele(db, `select public.admin_archive_establishment_v2($1,true,'Archivage demandé')`, [ETAB]);
ok("archivage_idempotent", r.rows?.[0]?.admin_archive_establishment_v2?.idempotent === true);
r = await appele(db, `select public.admin_archive_establishment_v2($1,false,'Restauration demandée')`, [ETAB]);
ok("restauration_ok", r.rows?.[0]?.admin_archive_establishment_v2?.archived === false);

/* Garage : suppression logique protégée */
r = await appele(db, `select public.admin_soft_delete_establishment($1,'motif valide','NON')`, [ETAB]);
ok("confirmation_requise", Boolean(r.erreur && /Confirmation/.test(r.erreur)));
r = await appele(db, `select public.admin_soft_delete_establishment($1,'Motif de suppression','SUPPRIMER')`, [ETAB]);
ok("suppression_refusee_si_archive_absent", Boolean(r.erreur && /Archiver/.test(r.erreur)));
r = await appele(db, `select public.admin_archive_establishment_v2($1,true,'Archivage avant suppression')`, [ETAB]);
r = await appele(db, `select public.admin_soft_delete_establishment($1,'Motif de suppression','SUPPRIMER')`, [ETAB]);
ok("suppression_refusee_si_abonnement_actif", Boolean(r.erreur && /clôtur/.test(r.erreur)));
await db.query(`update public.subscriptions set status='cancelled' where id=$1`, [SUB]);
r = await appele(db, `select public.admin_soft_delete_establishment($1,'Motif de suppression','SUPPRIMER')`, [ETAB]);
ok("suppression_logique_ok", r.rows?.[0]?.admin_soft_delete_establishment?.mode === "logique");
q = await db.query(`select count(*)::int as n from public.establishments where id=$1`, [ETAB]);
ok("garage_conserve", q.rows[0].n === 1);

/* Abonnement : transitions et idempotence */
r = await appele(db, `select public.admin_set_subscription_status($1,'cancelled','Clôture demandée')`, [SUB]);
ok("transition_active_vers_resilie", r.rows?.[0]?.admin_set_subscription_status?.status === "cancelled");
r = await appele(db, `select public.admin_set_subscription_status($1,'active','Reactivation demandée')`, [SUB]);
ok("transition_interdite_resilie_vers_actif", Boolean(r.erreur && /Transition interdite/.test(r.erreur)));
r = await appele(db, `select public.admin_set_subscription_status($1,'cancelled','Clôture demandée')`, [SUB]);
ok("idempotence_statut", r.rows?.[0]?.admin_set_subscription_status?.idempotent === true);

/* Abonnement : modification, renouvellement, archivage */
r = await appele(db, `select public.admin_update_subscription($1,'gold',null,null,null,'')`, [SUB]);
ok("modification_sans_motif_refusee", Boolean(r.erreur && /Motif/.test(r.erreur)));
r = await appele(db, `select public.admin_update_subscription($1,'gold',null,null,null,'Changement de formule')`, [SUB]);
ok("modification_formule_ok", r.rows?.[0]?.admin_update_subscription?.abonnement?.plan_code === "gold");
r = await appele(db, `select public.admin_update_subscription($1,'inconnu',null,null,null,'Changement de formule')`, [SUB]);
ok("forfait_inconnu_refuse", Boolean(r.erreur && /Forfait inconnu/.test(r.erreur)));
const avant = (await db.query(`select current_period_end from public.subscriptions where id=$1`, [SUB])).rows[0].current_period_end;
await db.query(`update public.subscriptions set status='active' where id=$1`, [SUB]);
r = await appele(db, `select public.admin_renew_subscription_v2($1,12,'Renouvellement annuel')`, [ETAB]);
const apres = (await db.query(`select current_period_end from public.subscriptions where id=$1`, [SUB])).rows[0].current_period_end;
ok("renouvellement_ok", new Date(apres) > new Date(avant));
await db.query(`update public.subscriptions set status='cancelled' where id=$1`, [SUB]);
r = await appele(db, `select public.admin_archive_subscription($1,true,'Archivage contrat')`, [SUB]);
ok("archivage_abonnement_ok", r.rows?.[0]?.admin_archive_subscription?.archived === true);
r = await appele(db, `select public.admin_soft_delete_subscription($1,'Suppression logique','SUPPRIMER')`, [SUB]);
ok("suppression_logique_abonnement_ok", r.rows?.[0]?.admin_soft_delete_subscription?.mode === "logique");

/* Audit */
q = await db.query(`select count(*)::int as n from public.audit_log where action like 'establishment_%' or action like 'subscription_%'`);
ok("journal_audit_rempli", q.rows[0].n >= 8, "lignes=" + q.rows[0].n);
q = await db.query(`select payload_json from public.audit_log where action like '%archive%' limit 1`);
ok("audit_contient_motif", JSON.stringify(q.rows[0]?.payload_json ?? {}).includes("motif"));

/* Rollback */
await db.exec(ROLLBACK);
q = await db.query(`select to_regprocedure('public.admin_archive_subscription(uuid,boolean,text)') is not null as restant,
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='establishments' and column_name='gv5_archived_at') as colonne`);
ok("rollback_propre", q.rows[0].restant === false && q.rows[0].colonne === 0);
await db.close();

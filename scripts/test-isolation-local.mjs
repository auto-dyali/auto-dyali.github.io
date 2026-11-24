/**
 * GV5 §105 — Test d'isolation A/B contre un Supabase LOCAL réel.
 *
 * Aucun JWT forgé : les deux Managers se connectent avec leur mot de passe
 * via Supabase Auth, puis leurs jetons de session sont utilisés tels quels.
 * La clé service_role ne sert qu'à préparer les données de test.
 *
 * Le script est exécuté par .github/workflows/migrations-real.yml après
 * `supabase start` / `supabase db reset` (donc sur une base vierge).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const URL = (process.env.SUPABASE_URL ?? process.env.API_EXTERNAL_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? process.env.API_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? process.env.API_SERVICE_ROLE_KEY ?? "";

if (!KEY || !SERVICE) {
  console.error("Variables locales absentes. Noms disponibles: " + Object.keys(process.env).filter(k=>/KEY|SUPABASE|API_/.test(k)).sort().join(","));
  process.exit(2);
}

const adminHeaders = { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const publicHeaders = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };
const resultat = { url: URL.replace(/^https?:\/\//, ""), etapes: [] };

async function creerManager(lettre) {
  const email = `iso-${lettre.toLowerCase()}@gv5.local`;
  const password = `IsoTest${lettre}1!`;
  const u = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!u.ok) throw new Error(`création user ${lettre}: ${u.status} ${(await u.text()).slice(0, 200)}`);
  const user = await u.json();
  const userId = user.id ?? user.user?.id;

  const etabId = randomUUID();
  const slug = `iso-${lettre.toLowerCase()}-${Date.now()}`;
  const e = await fetch(`${URL}/rest/v1/establishments`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ id: etabId, name: `Garage ISO ${lettre}`, slug, plan: "standard", is_active: true }),
  });
  if (!e.ok) throw new Error(`création établissement ${lettre}: ${e.status} ${(await e.text()).slice(0, 200)}`);

  const p = await fetch(`${URL}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ id: userId, full_name: `Manager ISO ${lettre}`, role: "manager", establishment_id: etabId, is_active: true }),
  });
  if (!p.ok) throw new Error(`création profil ${lettre}: ${p.status} ${(await p.text()).slice(0, 200)}`);

  const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`connexion ${lettre}: ${login.status}`);
  const token = (await login.json()).access_token;
  return { lettre, userId, etabId, headers: { ...publicHeaders, Authorization: `Bearer ${token}` } };
}

try {
  const A = await creerManager("A");
  const B = await creerManager("B");
  resultat.etapes.push("2 établissements + 2 Managers créés via Auth réelle");

  for (const [acteur, cible] of [[A, B], [B, A]]) {
    const visibles = await fetch(`${URL}/rest/v1/establishments?select=id`, { headers: acteur.headers });
    const lignes = await visibles.json();
    assert.equal(lignes.length, 1, `${acteur.lettre} doit voir exactement son établissement`);
    assert.equal(lignes[0].id, acteur.etabId, `${acteur.lettre} voit le mauvais établissement`);

    const intrusion = await fetch(`${URL}/rest/v1/establishments?select=id&id=eq.${cible.etabId}`, { headers: acteur.headers });
    assert.deepEqual(await intrusion.json(), [], `${acteur.lettre} a lu l'établissement ${cible.lettre}`);

    const profils = await fetch(`${URL}/rest/v1/profiles?select=id,role`, { headers: acteur.headers });
    const rows = await profils.json();
    assert.equal(rows.length, 1, `${acteur.lettre} ne doit voir que son profil`);

    const ecriture = await fetch(`${URL}/rest/v1/establishments?id=eq.${cible.etabId}`, {
      method: "PATCH", headers: { ...acteur.headers, Prefer: "return=representation" },
      body: JSON.stringify({ name: "HACK-ISO" }),
    });
    assert.deepEqual(await ecriture.json(), [], `${acteur.lettre} a modifié l'établissement ${cible.lettre}`);

    const rpc = await fetch(`${URL}/rest/v1/rpc/admin_onboard_tenant_v2`, {
      method: "POST", headers: acteur.headers, body: JSON.stringify({ p_request_id: "hack" }),
    });
    assert.ok(rpc.status >= 400, `${acteur.lettre} a appelé une RPC admin`);
    resultat.etapes.push(`${acteur.lettre}: 1 établissement propre, 0 sur ${cible.lettre}, RPC admin refusée (${rpc.status})`);
  }

  const anon = await fetch(`${URL}/rest/v1/profiles?select=id`, { headers: publicHeaders });
  assert.deepEqual(await anon.json(), [], "un anonyme ne doit lire aucun profil");
  resultat.etapes.push("anonyme: 0 profil");

  console.log(JSON.stringify(resultat, null, 2));
} catch (e) {
  console.error("ISOLATION_FAILED", e instanceof Error ? e.message : String(e));
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(1);
}

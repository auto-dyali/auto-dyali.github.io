/**
 * AUTO DYALI — GV5 §85 — Contrôle de préparation d'un environnement Supabase.
 *
 * LECTURE SEULE : aucune écriture, aucune migration, aucun secret affiché.
 * Vérifie la présence des objets nécessaires à l'onboarding Super Admin.
 *
 *   GV585_URL=https://... GV585_KEY=sb_publishable_... node scripts/check-production-readiness.mjs
 */

const url = process.env.GV585_URL;
const key = process.env.GV585_KEY;
if (!url || !key) {
  console.log('Contrôle ignoré : GV585_URL et GV585_KEY requis (clé publishable publique).');
  console.log('Aucun secret n\'est demandé ni affiché.');
  process.exit(0);
}

const h = { 'Content-Type': 'application/json', apikey: key };
const RPCS = [
  'admin_check_identity_available',
  'admin_onboard_tenant_v2',
  'get_my_security_state',
  'resolve_login_email',
  'must_change_password',
  'has_feature',
  'admin_identity_v2_health',
  'admin_get_abonne_details',
  'admin_set_permissions',
  'admin_record_delivery',
  'admin_find_onboarding_request',
  'admin_purge_establishment',
  'submit_pre_purchase_request',
  'admin_record_billing_event',
];
const COLUMNS = [
  ['establishments', 'professional_id'],
  ['profiles', 'login_id'],
  ['profiles', 'must_change_password'],
  ['onboarding_requests', 'invitation_id'],
  ['products', 'brand'],
  ['products', 'manufacturer_ref'],
  ['products', 'image_url'],
];
const TABLES = ['invitations', 'pre_purchase_requests', 'saas_billing_events'];

async function rpcExiste(nom) {
  const r = await fetch(`${url}/rest/v1/rpc/${nom}`, { method: 'POST', headers: h, body: '{}' });
  return r.status !== 404;
}
async function colonneExiste(table, colonne) {
  const r = await fetch(`${url}/rest/v1/${table}?select=${colonne}&limit=1`, { headers: h });
  const texte = await r.text();
  return r.status !== 400 || !texte.includes('42703');
}
async function tableExiste(table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: h });
  const texte = await r.text();
  return r.status !== 404 || !texte.includes('PGRST205');
}

let ok = 0;
let total = 0;
for (const nom of RPCS) {
  const present = await rpcExiste(nom);
  total++; if (present) ok++;
  console.log(`${present ? 'OK      ' : 'MANQUANT'} RPC ${nom}`);
}
for (const [table, colonne] of COLUMNS) {
  const present = await colonneExiste(table, colonne);
  total++; if (present) ok++;
  console.log(`${present ? 'OK      ' : 'MANQUANT'} COLONNE ${table}.${colonne}`);
}
for (const table of TABLES) {
  const present = await tableExiste(table);
  total++; if (present) ok++;
  console.log(`${present ? 'OK      ' : 'MANQUANT'} TABLE ${table}`);
}
console.log(`\nPréparation : ${ok}/${total} objets présents (${Math.round((ok / total) * 100)} %).`);
console.log('Ce contrôle ne vérifie ni PITR, ni sauvegardes, ni secrets, ni versions d\'Edge Functions.');

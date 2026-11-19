/**
 * AUTO DYALI — GV5 §81 — Configuration des tarifs des 3 formules.
 *
 * Aucun prix n'est codé en dur : le propriétaire fournit les montants via
 * variables d'environnement. Le script lit les limites existantes (max_users,
 * max_sites, storage_mb, trial_days) et ne modifie QUE les champs fournis.
 * Aucun secret n'est affiché ni écrit dans un fichier.
 *
 *   GV581_URL=... GV581_KEY=... GV581_TOKEN=<JWT Super Admin> \
 *   GV581_STANDARD_MENSUEL=... GV581_STANDARD_ANNUEL=... \
 *   GV581_SILVER_MENSUEL=... GV581_SILVER_ANNUEL=... \
 *   GV581_GOLD_MENSUEL=... GV581_GOLD_ANNUEL=... \
 *   node scripts/configure-plans.mjs
 */

const url = process.env.GV581_URL;
const key = process.env.GV581_KEY;
const token = process.env.GV581_TOKEN;

if (!url || !key || !token) {
  console.log('Configuration non lancée : GV581_URL, GV581_KEY et GV581_TOKEN requis.');
  console.log('Aucun prix par défaut n\'est appliqué : la décision tarifaire appartient au propriétaire.');
  process.exit(0);
}

const h = { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` };
const codes = ['standard', 'silver', 'gold'];
const envPrix = (code, periode) => process.env[`GV581_${code.toUpperCase()}_${periode}`];

const plans = await fetch(`${url}/rest/v1/plans?select=code,price_monthly,price_yearly,max_users,max_sites,storage_mb,trial_days&is_active=eq.true`, { headers: h })
  .then((r) => r.json());

for (const code of codes) {
  const plan = plans.find((p) => p.code === code);
  if (!plan) { console.log(`${code}: formule active introuvable — ignorée`); continue; }
  const mensuel = envPrix(code, 'MENSUEL');
  const annuel = envPrix(code, 'ANNUEL');
  if (!mensuel && !annuel) { console.log(`${code}: aucun prix fourni — inchangé`); continue; }
  const r = await fetch(`${url}/rest/v1/rpc/admin_save_plan`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      p_code: code,
      p_price_monthly: mensuel ? Number(mensuel) : Number(plan.price_monthly ?? 0),
      p_price_yearly: annuel ? Number(annuel) : Number(plan.price_yearly ?? 0),
      p_trial_days: Number(plan.trial_days ?? 14),
      p_max_users: Number(plan.max_users ?? 1),
      p_max_sites: Number(plan.max_sites ?? 1),
      p_storage_mb: Number(plan.storage_mb ?? 1024),
    }),
  });
  console.log(`${code}: ${r.status} ${(await r.text()).slice(0, 120)}`);
}
console.log('Les limites existantes et les essais sont préservés. Aucun secret n\'a été affiché.');

/**
 * AUTO DYALI — GV5 §78 — Contrôle de préparation commerciale (LECTURE SEULE).
 *
 * Vérifie les prérequis mesurables de la commercialisation sans jamais
 * modifier la base, ni afficher de secret. Les identifiants de lecture sont
 * fournis par l'environnement (aucune valeur codée en dur).
 *
 *   GV578_STAGING_URL=... GV578_STAGING_KEY=... node scripts/check-commercial-readiness.mjs
 */

const url = process.env.GV578_STAGING_URL;
const key = process.env.GV578_STAGING_KEY;

if (!url || !key) {
  console.log("Contrôle ignoré : GV578_STAGING_URL / GV578_STAGING_KEY non fournis.");
  console.log("Aucune valeur secrète n'est demandée ni stockée par ce script.");
  process.exit(0);
}

// Lecture sous le rôle authentifié quand un jeton est fourni : sinon les
// politiques RLS filtrent les lignes et le contrôle perd tout sens.
const token = process.env.GV578_STAGING_TOKEN;
const headers = {
  apikey: key,
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function lire(table, select) {
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}`, { headers });
  if (!r.ok) return { erreur: `${r.status} ${(await r.text()).slice(0, 120)}` };
  return { lignes: await r.json() };
}

const plans = await lire("plans", "code,label,price_monthly,price_yearly,trial_days,is_active");
const paiements = await lire("payments", "id");
const factures = await lire("invoices", "id");
const abonnements = await lire("subscriptions", "id,status");

const resultats = [];
if (plans.erreur) resultats.push(["Formules", "ERREUR", plans.erreur]);
else {
  const actifs = plans.lignes.filter((p) => p.is_active);
  const prix = actifs.filter((p) => Number(p.price_monthly) > 0 && Number(p.price_yearly) > 0);
  resultats.push([
    "Offres et formules",
    prix.length === actifs.length && actifs.length > 0 ? "OK" : "MANQUANT",
    `${prix.length}/${actifs.length} formule(s) avec prix mensuel ET annuel renseignés`,
  ]);
  const essais = actifs.filter((p) => Number(p.trial_days) >= 0);
  resultats.push([
    "Périodes d'essai",
    essais.length === actifs.length ? "OK" : "MANQUANT",
    `${essais.length}/${actifs.length} formule(s) avec durée d'essai définie`,
  ]);
}
resultats.push([
  "Paiements enregistrés",
  paiements.erreur ? "ERREUR" : paiements.lignes.length > 0 ? "OK" : "MANQUANT",
  paiements.erreur ?? `${paiements.lignes.length} paiement(s) — aucun fournisseur connecté`,
]);
resultats.push([
  "Factures émises",
  factures.erreur ? "ERREUR" : factures.lignes.length > 0 ? "OK" : "MANQUANT",
  factures.erreur ?? `${factures.lignes.length} facture(s)`,
]);
resultats.push([
  "Abonnements suivis",
  abonnements.erreur ? "ERREUR" : abonnements.lignes.length > 0 ? "OK" : "MANQUANT",
  abonnements.erreur ?? `${abonnements.lignes.length} abonnement(s)`,
]);

for (const [nom, etat, detail] of resultats) {
  console.log(`${etat.padEnd(9)} ${nom.padEnd(24)} ${detail}`);
}
const ok = resultats.filter((r) => r[1] === "OK").length;
console.log(`\nPrérequis mesurables : ${ok}/${resultats.length} (${Math.round((ok / resultats.length) * 100)} %)`);
console.log("Non mesurable ici : secrets prestataires, webhooks signés, destinataire autorisé, PITR.");

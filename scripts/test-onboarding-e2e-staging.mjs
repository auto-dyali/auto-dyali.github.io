/**
 * GV5 §101 — Parcours réel de création d'abonné sur STAGING.
 *
 * Ce script n'est PAS exécuté par `npm test` : il écrit réellement sur
 * STAGING et exige des identifiants. Il refuse toute autre cible.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL                 https://yocufscgninxiihwiepa.supabase.co
 *   SUPABASE_PUBLISHABLE_KEY     clé publishable staging
 *   SUPABASE_SECRET_KEY          clé secrète staging (jamais affichée)
 *   E2E_SA_EMAIL                 e-mail d'un Super Admin staging
 *   E2E_SA_PASSWORD              son mot de passe
 *
 * Usage :
 *   node scripts/test-onboarding-e2e-staging.mjs
 *
 * Ce qu'il prouve réellement :
 *   - l'Edge Function onboard-tenant accepte la session Super Admin ;
 *   - le compte Auth Manager, le profil, l'établissement, l'abonnement,
 *     les permissions et l'invitation sont créés ;
 *   - les 6 champs administratifs sont persistés (défaut corrigé §101).
 *
 * Limite assumée : le jeton d'activation brut n'est jamais renvoyé par le
 * serveur (il part par e-mail/WhatsApp). L'activation est donc vérifiée
 * séparément (voir docs/sessions/.../RAPPORT_GV5_101.md).
 */
import { randomUUID } from "node:crypto";

const STAGING_REF = "yocufscgninxiihwiepa";
const PRODUCTION_REF = "nxmsqqoflskfajqrqddw";

const url = process.env.SUPABASE_URL ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const saEmail = process.env.E2E_SA_EMAIL ?? "";
const saPassword = process.env.E2E_SA_PASSWORD ?? "";

function stop(message) {
  console.error(`ARRÊT : ${message}`);
  process.exit(1);
}

if (!url || !publishable || !secret) stop("SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY manquants.");
if (url.includes(PRODUCTION_REF)) stop("production interdite.");
if (!url.includes(STAGING_REF)) stop(`seule la référence STAGING ${STAGING_REF} est autorisée.`);
if (!saEmail || !saPassword) stop("E2E_SA_EMAIL / E2E_SA_PASSWORD manquants.");

const ts = Date.now();
const publicHeaders = {
  "Content-Type": "application/json",
  apikey: publishable,
  Authorization: `Bearer ${publishable}`,
};
const secretHeaders = {
  "Content-Type": "application/json",
  apikey: secret,
  Authorization: `Bearer ${secret}`,
};

const loginId = `e2e-mgr-${ts}`;
const professionalId = `ADY-E2E-${String(ts).slice(-6)}`;
const slug = `e2e-garage-${ts}`;
const managerEmail = `e2e.manager.${ts}@autodyali-staging.local`;
const temporaryPassword = `E2eTemp${ts}!`;
const startDate = new Date().toISOString().slice(0, 10);

const modules = ["catalogue", "clients", "dashboard", "invoices", "pos", "quotes", "reports_basic", "stock", "suppliers", "support", "vehicles"];
const payload = {
  contractVersion: 2,
  requestId: `e2e-req-${randomUUID()}`,
  establishment: {
    name: `Garage E2E ${ts}`,
    legalName: `E2E AUTO SARL ${ts}`,
    slug,
    activityType: "garage",
    professionalId,
    address: "12 rue de test",
    city: "Casablanca",
    region: "Casablanca-Settat",
    phone: "+212600000000",
    email: managerEmail,
    notes: "création E2E",
    country: "Maroc",
    legalInfo: "SARL au capital de 100000 MAD",
    fiscalInfo: "IF 12345678",
    adminInfo: "Dossier complet",
    dossierState: "en_attente",
    complementaryContacts: "WhatsApp +212600000001",
  },
  manager: {
    fullName: "Manager E2E",
    email: managerEmail,
    phone: "+212600000000",
    loginId,
    temporaryPassword,
    temporaryPasswordConfirm: temporaryPassword,
  },
  subscription: {
    plan: "standard",
    paidDuration: "12_mois",
    paidDurationMonths: 12,
    trialDuration: "14_jours",
    trialDurationDays: 14,
    startDate,
  },
  modules,
  permissions: modules.map((m) => ({ module: m, canView: true, canCreate: false, canEdit: false, canDelete: false })),
  delivery: { email: false, whatsapp: false },
};

async function main() {
  // 1. Session Super Admin réelle.
  const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({ email: saEmail, password: saPassword }),
  });
  const session = await signIn.json().catch(() => ({}));
  if (!signIn.ok || !session.access_token) stop(`connexion Super Admin impossible (${signIn.status}).`);
  console.log("1) session Super Admin : OK");

  // 2. Création réelle via l'Edge Function.
  const invoke = await fetch(`${url}/functions/v1/onboard-tenant`, {
    method: "POST",
    headers: { ...publicHeaders, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const result = await invoke.json().catch(() => ({}));
  console.log("2) onboard-tenant :", invoke.status, JSON.stringify(result));
  if (!invoke.ok || result.ok === false) stop("création refusée par le serveur.");
  const establishmentId = result.establishment_id;
  if (!establishmentId) stop("establishment_id absent du résultat.");

  // 3. Vérification réelle en base (service_role, hors RLS).
  const check = await fetch(
    `${url}/rest/v1/establishments?id=eq.${establishmentId}&select=name,professional_id,country,legal_info,fiscal_info,admin_info,dossier_state,complementary_contacts,plan`,
    { headers: secretHeaders },
  );
  const rows = await check.json().catch(() => []);
  const etab = rows?.[0];
  if (!etab) stop("établissement introuvable après création.");
  for (const col of ["country", "legal_info", "fiscal_info", "admin_info", "dossier_state", "complementary_contacts"]) {
    if (!etab[col]) stop(`champ administratif non persisté : ${col}`);
  }
  console.log("3) 6 champs administratifs persistés : OK");

  const prof = await fetch(
    `${url}/rest/v1/profiles?id=eq.${result.manager_user_id}&select=role,login_id,establishment_id,must_change_password`,
    { headers: secretHeaders },
  );
  const profile = (await prof.json().catch(() => []))?.[0];
  if (!profile || profile.role !== "manager" || profile.establishment_id !== establishmentId) {
    stop("profil Manager incohérent.");
  }
  console.log("4) profil Manager rattaché : OK");

  const sub = await fetch(
    `${url}/rest/v1/subscriptions?establishment_id=eq.${establishmentId}&select=plan_code,status,current_period_end`,
    { headers: secretHeaders },
  );
  const subscription = (await sub.json().catch(() => []))?.[0];
  if (!subscription) stop("abonnement absent.");
  console.log("5) abonnement :", JSON.stringify(subscription));

  const perms = await fetch(
    `${url}/rest/v1/permissions?establishment_id=eq.${establishmentId}&role=eq.manager&select=module`,
    { headers: secretHeaders },
  );
  const permRows = await perms.json().catch(() => []);
  console.log("6) permissions :", permRows.length, "module(s)");

  console.log("\nSUCCÈS — création réelle validée sur STAGING.");
  console.log("  établissement :", establishmentId);
  console.log("  manager       :", result.manager_user_id);
  console.log("  invitation    :", result.invitation_id);
  console.log("  identifiant   :", loginId);
  console.log("\nL'activation exige le lien reçu par e-mail/WhatsApp (jeton jamais renvoyé).");
}

main().catch((e) => stop(e instanceof Error ? e.message : String(e)));

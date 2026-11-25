/**
 * GV5 §105 — Activation Manager de bout en bout sur Supabase LOCAL.
 *
 * Le lien d'activation est récupéré depuis la boîte de capture Inbucket de la
 * pile locale. Le jeton n'est jamais affiché ni écrit dans un artefact :
 * seul le fait qu'un lien valide a été trouvé est journalisé.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SUP = (process.env.SUPABASE_URL ?? process.env.API_EXTERNAL_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? process.env.API_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? process.env.API_SERVICE_ROLE_KEY ?? "";
const APP = "http://127.0.0.1:3000";
const DIR = "docs/sessions/session-1/gv5-105/preuves";
mkdirSync(DIR, { recursive: true });
const out = { etapes: [] };

if (!KEY || !SERVICE) {
  console.error("Variables Supabase locales absentes. Noms disponibles: " + Object.keys(process.env).filter(k=>/KEY|SUPABASE|API_/.test(k)).sort().join(","));
  process.exit(2);
}

const adminHeaders = { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const ts = Date.now();
const saEmail = `sa-gv5105@gv5.local`;
const saPassword = "SaGv5105Test!";
const managerEmail = `activate-${ts}@gv5.local`;
const managerPassword = `Activate${ts}!`;

async function creerSuperAdmin() {
  const u = await fetch(`${SUP}/auth/v1/admin/users`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ email: saEmail, password: saPassword, email_confirm: true }),
  });
  let id;
  if (u.ok) { const j = await u.json(); id = j.id ?? j.user?.id; }
  else {
    const liste = await fetch(`${SUP}/auth/v1/admin/users?filter=email.eq.${saEmail}`, { headers: adminHeaders });
    const j = await liste.json();
    id = j.users?.[0]?.id;
  }
  if (!id) throw new Error("Super Admin local introuvable/créable");
  const patch = await fetch(`${SUP}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH", headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ role: "saas_admin", is_active: true, full_name: "SA E2E" }),
  });
  if (!patch.ok) console.log("PATCH profil SA:", patch.status, (await patch.text()).slice(0, 200));
}

async function recupererLienActivation() {
  // Mailpit (pile Supabase locale) : API publique, sans secret.
  for (let essai = 0; essai < 30; essai++) {
    const rep = await fetch("http://127.0.0.1:54324/api/v1/messages?limit=50");
    if (rep.ok) {
      const brut = await rep.json();
      const msgs = Array.isArray(brut) ? brut : (brut.messages ?? []);
      if (essai === 0) {
        out.captureDiagnostic = {
          messages: Array.isArray(msgs) ? msgs.length : "format inattendu",
          destinataires: Array.isArray(msgs) ? msgs.slice(0, 3).map((m) => (m.To ?? []).map((d) => d.Address)) : [],
        };
      }
      const msg = Array.isArray(msgs)
        ? msgs.find((m) => (m.To ?? []).some((d) => d.Address === managerEmail))
        : null;
      if (msg) {
        const detail = await fetch(`http://127.0.0.1:54324/api/v1/message/${encodeURIComponent(msg.ID)}`);
        const corp = await detail.text();
        const m = corp.match(/token=([a-f0-9=\r\n]{60,140})/i);
        if (m) {
          const jeton = m[1].replace(/=\r?\n/g, "").replace(/\s/g, "").slice(0, 64);
          if (/^[a-f0-9]{64}$/i.test(jeton)) return `${APP}/activer/?token=${jeton}`;
        }
        out.captureDiagnostic = {
          messages: msgs.length,
          tailleMessage: corp.length,
          contientActiver: /activer/i.test(corp),
          extrait: corp.slice(0, 160).replace(/token=[a-f0-9]+/i, "token=***"),
        };
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("aucun lien d'activation capturé");
}

const browser = await chromium.launch({ headless: true });
try {
  await creerSuperAdmin();
  out.etapes.push("Super Admin local prêt");

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${APP}/connexion/`, { waitUntil: "networkidle" });
  await page.locator('input[type="text"]').fill(saEmail);
  await page.locator('input[type="password"]').first().fill(saPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  try {
    await page.waitForURL("**/super-admin/**", { timeout: 25000 });
  } catch (e) {
    out.loginDiagnostic = (await page.locator("body").innerText()).slice(0, 500);
    out.loginUrl = page.url();
    throw e;
  }
  out.etapes.push("connexion Super Admin OK");

  await page.goto(`${APP}/super-admin/onboarding/`, { waitUntil: "networkidle" });
  await page.getByText("Identification de l'entreprise").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Générer" }).click();
  const set = (l, v) => page.locator(`input[aria-label="${l}"]`).fill(v);
  await set("Raison sociale", `Activation 105 ${ts}`);
  await set("Nom commercial", `Activation 105 ${ts}`);
  await set("Slug (URL interne)", `activation-105-${ts}`);
  await set("Type / activité de l'établissement", "Garage automobile");
  await set("Adresse", "1 rue Activation");
  await page.locator('input[placeholder="Nom de la ville…"]').fill("Rabat");
  await set("Téléphone professionnel", "+212600000111");
  await set("Adresse e-mail professionnelle", managerEmail);
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByText("Création du Manager").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Générer" }).click();
  await set("Prénom", "Activate");
  await set("Nom", `Test ${ts}`);
  await set("Téléphone", "+212600000112");
  await set("E-mail professionnel", managerEmail);
  await set("Mot de passe temporaire", managerPassword);
  await set("Confirmer le mot de passe", managerPassword);
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByText("Formule, abonnement et période").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByText("Modules & permissions").first().waitFor({ timeout: 15000 });
  await page.getByRole("checkbox", { name: "dashboard" }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByText("Identification et invitation").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Suivant" }).click();
  const waitCreate = page.waitForResponse(
    (r) => r.url().includes("functions/v1/onboard-tenant") && r.request().method() === "POST",
    { timeout: 25000 },
  );
  await page.getByRole("button", { name: "Créer l'abonné" }).click();
  const respCreate = await waitCreate;
  out.creation = { statut: respCreate.status(), reponse: (await respCreate.text()).slice(0, 800) };
  await page.getByText("Création confirmée").waitFor({ timeout: 15000 });
  out.etapes.push("établissement + Manager créés via l'interface");

  // Envoi via le fournisseur SMTP local (send-invitation, EMAIL_PROVIDER=smtp)
  // Envoi via la session Super Admin réelle obtenue dans le navigateur.
  const invitationId = out.creation.reponse.match(/"invitation_id":"([^"]+)"/)?.[1];
  if (!invitationId) throw new Error("invitation_id absent de la réponse de création");
  const tokenSA = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /auth-token/.test(x));
    return JSON.parse(localStorage.getItem(k)).access_token;
  });
  const envoi = await fetch(`${SUP}/functions/v1/send-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${tokenSA}` },
    body: JSON.stringify({ invitationId, channels: ["email"], requestId: crypto.randomUUID() }),
  });
  out.envoi = { statut: envoi.status, reponse: (await envoi.text()).slice(0, 600) };
  const lien = await recupererLienActivation();
  out.etapes.push("invitation envoyée via SMTP local et capturée (jeton non journalisé)");

  // Activation réelle
  const activation = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await activation.goto(lien, { waitUntil: "networkidle" });
  await activation.waitForTimeout(1200);
  const champs = activation.locator('input[type="password"]');
  await champs.nth(0).fill("ManagerActivated105!");
  await champs.nth(1).fill("ManagerActivated105!");
  await activation.getByRole("button", { name: /Activer|Valider|définir/i }).first().click();
  await activation.waitForTimeout(2500);
  out.etapes.push("mot de passe défini via le lien d'activation");

  // Connexion Manager et isolation
  const mgr = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await mgr.goto(`${APP}/connexion/`, { waitUntil: "networkidle" });
  await mgr.locator('input[type="text"]').fill(managerEmail);
  await mgr.locator('input[type="password"]').first().fill("ManagerActivated105!");
  await mgr.getByRole("button", { name: "Se connecter" }).click();
  await mgr.waitForURL("**/tableau-de-bord/**", { timeout: 25000 });
  const iso = await mgr.evaluate(async ({ SUP, KEY }) => {
    const k = Object.keys(localStorage).find((x) => /auth-token/.test(x));
    const tok = JSON.parse(localStorage.getItem(k)).access_token;
    const h = { apikey: KEY, Authorization: `Bearer ${tok}` };
    const a = await fetch(`${SUP}/rest/v1/establishments?select=id`, { headers: h });
    return { visibles: (await a.json()).length };
  }, { SUP, KEY });
  out.etapes.push(`connexion Manager OK, ${iso.visibles} établissement visible`);
  await mgr.screenshot({ path: `${DIR}/activation-manager-connecte.png` });

  writeFileSync(`${DIR}/activation-local-result.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error("ACTIVATION_FAILED", e instanceof Error ? e.message : String(e));
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}

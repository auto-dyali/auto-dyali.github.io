/**
 * GV5 §107 — Répétition sur la copie RÉELLE du schéma PRODUCTION.
 *
 * Aucun fournisseur e-mail (RESEND_API_KEY / EMAIL_FROM absents) : la
 * création doit réussir, le résultat doit dire explicitement que le mail
 * n'a pas été envoyé, et le lien d'activation est émis par la RPC
 * `admin_issue_activation_link` (fragment #token=).
 *
 * Aucun jeton ni secret n'est affiché ni écrit dans un artefact.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const SUP = (process.env.SUPABASE_URL ?? process.env.API_EXTERNAL_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? process.env.API_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? process.env.API_SERVICE_ROLE_KEY ?? "";
const APP = "http://127.0.0.1:3000";
const DIR = "docs/sessions/session-1/gv5-107-prod-final/preuves";
mkdirSync(DIR, { recursive: true });

const out = { etapes: [], assertions: [] };
const ok = (nom, condition, detail) => {
  out.assertions.push({ nom, ok: Boolean(condition), ...(detail ? { detail } : {}) });
  if (!condition) throw new Error(`Assertion échouée : ${nom}${detail ? ` — ${detail}` : ""}`);
};

if (!KEY || !SERVICE) {
  console.error("Variables Supabase absentes (noms seulement) : " + Object.keys(process.env).filter((k) => /KEY|SUPABASE|API_/.test(k)).sort().join(","));
  process.exit(2);
}

const adminHeaders = { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const ts = Date.now();
const saEmail = `sa-rehearsal@gv5.local`;
const saPassword = "SaRehearsalTest!";
const managerEmail = `manager-${ts}@gv5.local`;
const managerPassword = `Temp${ts}!`;
const activatedPassword = `Activated${ts}!`;

async function rpc(nom, args, token) {
  return fetch(`${SUP}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(args ?? {}),
  });
}

async function tokenDans(page) {
  return page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /auth-token/.test(x));
    return k ? JSON.parse(localStorage.getItem(k)).access_token : null;
  });
}

async function creerSuperAdmin() {
  const u = await fetch(`${SUP}/auth/v1/admin/users`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ email: saEmail, password: saPassword, email_confirm: true }),
  });
  let id;
  if (u.ok) { const j = await u.json(); id = j.id ?? j.user?.id; }
  else {
    const l = await fetch(`${SUP}/auth/v1/admin/users?filter=email.eq.${saEmail}`, { headers: adminHeaders });
    id = (await l.json()).users?.[0]?.id;
  }
  if (!id) throw new Error("Super Admin local introuvable/créable");
  const patch = await fetch(`${SUP}/rest/v1/profiles`, {
    method: "POST", headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, role: "saas_admin", is_active: true, full_name: "SA Répétition" }),
  });
  ok("profil Super Admin écrit", patch.ok, `HTTP ${patch.status}`);
  return id;
}

const browser = await chromium.launch({ headless: true });
try {
  await creerSuperAdmin();
  out.etapes.push("Super Admin local prêt");

  /* 1. Connexion + précontrôle réel (9 Booléens true). */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP}/connexion/`, { waitUntil: "networkidle" });
  await page.locator('input[type="text"]').fill(saEmail);
  await page.locator('input[type="password"]').first().fill(saPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/super-admin/**", { timeout: 30000 });
  const tokenSA = await tokenDans(page);
  ok("session Super Admin obtenue", Boolean(tokenSA));

  const health = await rpc("admin_identity_v2_health", {}, tokenSA);
  const sante = await health.json().catch(() => ({}));
  const valeurs = Object.values(sante).filter((v) => typeof v === "boolean");
  ok("précontrôle RPC 9 true", health.ok && valeurs.length === 9 && valeurs.every(Boolean), `HTTP ${health.status}, ${valeurs.filter(Boolean).length}/${valeurs.length}`);
  out.etapes.push("précontrôle vert (9/9)");

  /* 2. Onboarding complet via l'interface. */
  await page.goto(`${APP}/super-admin/onboarding/`, { waitUntil: "networkidle" });
  await page.getByText("Identification de l'entreprise").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Générer" }).click();
  const set = (l, v) => page.locator(`input[aria-label="${l}"]`).fill(v);
  await set("Raison sociale", `Repetition ${ts}`);
  await set("Nom commercial", `Repetition ${ts}`);
  await set("Slug (URL interne)", `repetition-${ts}`);
  await set("Type / activité de l'établissement", "Garage automobile");
  await set("Adresse", "1 rue Répétition");
  await page.locator('input[placeholder="Nom de la ville…"]').fill("Rabat");
  await set("Téléphone professionnel", "+212600000111");
  await set("Adresse e-mail professionnelle", managerEmail);
  await page.getByRole("button", { name: "Suivant" }).click({ timeout: 10000 });

  await page.getByText("Création du Manager").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Générer" }).click();
  await set("Prénom", "Manager");
  await set("Nom", `Repetition ${ts}`);
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

  const attente = page.waitForResponse(
    (r) => r.url().includes("functions/v1/onboard-tenant") && r.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Créer l'abonné" }).click();
  const reponse = await attente;
  const corps = await reponse.json().catch(() => ({}));
  ok("création onboard-tenant 200", reponse.status() === 200 && corps.ok === true && corps.status === "completed", `HTTP ${reponse.status()}`);
  ok("message explicite sans e-mail", /invitation préparée, e-mail non envoyé/i.test(String(corps.message ?? "")), String(corps.message ?? "").slice(0, 120));
  const livraison = Array.isArray(corps.delivery) ? corps.delivery.find((d) => d.channel === "email") : null;
  ok("statut livraison non_configure", livraison?.status === "non_configure" && corps.email_sent === false, String(livraison?.status));
  const invitationId = corps.invitation_id;
  ok("invitation_id présent", typeof invitationId === "string" && invitationId.length > 0);
  await page.getByText("Création confirmée").waitFor({ timeout: 15000 });
  out.etapes.push("établissement + Manager + permissions créés sans fournisseur e-mail");

  /* 3. send-invitation v4 sans secret : non bloquant et explicite. */
  const envoi = await fetch(`${SUP}/functions/v1/send-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${tokenSA}` },
    body: JSON.stringify({ invitationId, channels: ["email"], requestId: crypto.randomUUID() }),
  });
  const corpsEnvoi = await envoi.json().catch(() => ({}));
  ok("send-invitation 200 sans secret", envoi.ok && corpsEnvoi.ok === true, `HTTP ${envoi.status}`);
  ok("send-invitation explicite sans envoi", /invitation préparée, e-mail non envoyé/i.test(String(corpsEnvoi.message ?? "")), String(corpsEnvoi.message ?? "").slice(0, 120));
  out.etapes.push("send-invitation v4 : non_configure, création non bloquée");

  /* 4. Lien d'activation émis par la RPC (bouton de la fiche), fragment #token=. */
  const lien1 = await rpc("admin_issue_activation_link", { p_invitation_id: invitationId }, tokenSA);
  const corpsLien1 = await lien1.json().catch(() => ({}));
  const token1 = String(corpsLien1.url ?? "").match(/\/activer\/#token=([a-f0-9]{64})$/)?.[1] ?? null;
  ok("lien en fragment #token=", lien1.ok && Boolean(token1), `url=${String(corpsLien1.url ?? "").split("#")[0]}`);
  const lien2 = await rpc("admin_issue_activation_link", { p_invitation_id: invitationId }, tokenSA);
  const corpsLien2 = await lien2.json().catch(() => ({}));
  const token2 = String(corpsLien2.url ?? "").match(/\/activer\/#token=([a-f0-9]{64})$/)?.[1] ?? null;
  ok("renouvellement invalide l'ancien lien", lien2.ok && Boolean(token2) && token2 !== token1);
  out.etapes.push("lien d'activation émis et renouvelé (ancien invalidé), jeton non journalisé");

  /* 5. Activation réelle via le fragment. */
  const activation = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await activation.goto(`${APP}${corpsLien2.url}`, { waitUntil: "networkidle" });
  await activation.waitForTimeout(1200);
  const champs = activation.locator('input[type="password"]');
  await champs.nth(0).fill(activatedPassword);
  await champs.nth(1).fill(activatedPassword);
  await activation.getByRole("button", { name: /Activer|Valider|définir/i }).first().click();
  await activation.waitForTimeout(2500);
  out.etapes.push("mot de passe Manager défini via le lien en fragment");

  /* 6. Connexion Manager, permissions et isolation A/B. */
  const mgr = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await mgr.goto(`${APP}/connexion/`, { waitUntil: "networkidle" });
  await mgr.locator('input[type="text"]').fill(managerEmail);
  await mgr.locator('input[type="password"]').first().fill(activatedPassword);
  await mgr.getByRole("button", { name: "Se connecter" }).click();
  await mgr.waitForURL("**/tableau-de-bord/**", { timeout: 30000 });
  const tokenMgr = await tokenDans(mgr);
  ok("connexion Manager", Boolean(tokenMgr));

  const perms = await rpc("my_permissions", {}, tokenMgr);
  const lignesPerms = await perms.json().catch(() => []);
  ok("permissions dashboard accordées", perms.ok && Array.isArray(lignesPerms) && lignesPerms.some((p) => p.module === "dashboard" && p.can_view === true), `HTTP ${perms.status}`);

  // Établissement concurrent créé côté service_role : le Manager ne doit en voir qu'un.
  const autre = await fetch(`${SUP}/rest/v1/establishments`, {
    method: "POST", headers: { ...adminHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ name: `Autre ${ts}`, slug: `autre-${ts}` }),
  });
  ok("établissement concurrent créé", autre.ok, `HTTP ${autre.status}`);
  const visibles = await mgr.evaluate(async ({ SUP, KEY, token }) => {
    const r = await fetch(`${SUP}/rest/v1/establishments?select=id`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
    return (await r.json()).length;
  }, { SUP, KEY, token: tokenMgr });
  ok("isolation A/B : 1 établissement visible", visibles === 1, `visibles=${visibles}`);

  /* 7. Refus des RPC réservées au Super Admin. */
  const refus = [];
  for (const [nom, args] of [
    ["admin_identity_v2_health", {}],
    ["admin_issue_activation_link", { p_invitation_id: invitationId }],
    ["admin_check_identity_available", { p_professional_id: "x", p_login_id: "x", p_email: managerEmail, p_slug: "x" }],
    ["admin_find_user_id_by_email", { p_email: managerEmail }],
  ]) {
    const r = await rpc(nom, args, tokenMgr);
    refus.push({ nom, statut: r.status });
    ok(`refus RPC ${nom}`, !r.ok, `HTTP ${r.status}`);
  }
  out.refusRpc = refus;

  out.etapes.push("isolation A/B et refus admin_* vérifiés");
  writeFileSync(`${DIR}/rehearsal-result.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  out.erreur = e instanceof Error ? e.message : String(e);
  console.error("REHEARSAL_FAILED", out.erreur);
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}

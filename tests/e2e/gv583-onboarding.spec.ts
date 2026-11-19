import { test, expect, type Page } from '@playwright/test';

/** GV5 §83 — Création réelle GOLD + essai 110 j + 12 mois, puis preuves SQL/HTTP. */
const URL = 'https://yocufscgninxiihwiepa.supabase.co';
const KEY = 'sb_publishable_SkPOqfTxZ1drLBK8sxu83Q_6yr0OB7d';
const SHOTS = 'docs/audits/screenshots-83';
const uniq = Date.now();
const SOCIETE = `Garage Onboard ${uniq}`;
const PRO = `ADY-PRO-${String(uniq).slice(-6).toUpperCase()}`;
const LOGIN = `mgr.onboard.${uniq}`;
const EMAIL = `mgr.onboard.${uniq}@autodyali-staging.local`;

async function connexionSA(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
  await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 60000 });
}

async function remplirEtapes(page: Page, identifiantPro = PRO, arretEtape2 = false) {
  await page.goto('/super-admin/onboarding/');
  await expect(page.getByRole('heading', { name: /1. Identification/ })).toBeVisible({ timeout: 15000 });
  await page.getByLabel(/Raison sociale/).fill(`${SOCIETE} SARL`);
  await page.getByLabel(/Nom commercial/).fill(SOCIETE);
  await page.getByLabel(/Slug/).fill(`garage-onboard-${uniq}`);
  await page.getByLabel(/Identifiant professionnel/).fill(identifiantPro);
  await page.getByLabel(/Type \/ activité/).fill('Automobile');
  await page.locator('select').first().selectOption({ index: 1 });
  await page.getByLabel('Adresse', { exact: true }).fill('10 Rue Onboarding');
  await page.getByLabel(/Ville/).fill('Rabat');
  await page.getByLabel('Téléphone professionnel', { exact: true }).fill('+212600000183');
  await page.getByLabel('Adresse e-mail professionnelle', { exact: true }).fill(`contact.${uniq}@autodyali-staging.local`);
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByText('2. Création du Manager')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Prénom', { exact: true }).fill('Aziz');
  await page.getByLabel('Nom', { exact: true }).fill('Test');
  await page.getByLabel('Téléphone', { exact: true }).fill('+212600000184');
  await page.getByLabel('E-mail professionnel', { exact: true }).fill(EMAIL);
  await page.getByLabel(/Identifiant de connexion Manager/).fill(LOGIN);
  await page.locator('input[type="password"]').nth(0).fill('ManagerOnboard2026!');
  await page.locator('input[type="password"]').nth(1).fill('ManagerOnboard2026!');
  await page.getByRole('button', { name: 'Suivant' }).click();
  if (arretEtape2) {
    await expect(page.getByText(/Identifiant professionnel déjà utilisé/i).first()).toBeVisible({ timeout: 15000 });
    return;
  }

  await expect(page.getByText(/3. Formule, abonnement et période/)).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: 'GOLD' }).locator('..').getByRole('button', { name: /Sélectionner/ }).click();
  // Durée payante par défaut : 1 an (12 mois). Essai personnalisé 110 jours.
  await page.locator('select').nth(1).selectOption('personnalisee');
  await page.locator('input[type="number"][max="365"]').fill('110');
  await expect(page.getByText(/Fin d'essai/)).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: `${SHOTS}/01-abonnement-110j.png` });
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByRole('heading', { name: /4. Modules/ })).toBeVisible({ timeout: 15000 });
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Suivant' }).click();

  await expect(page.getByText(/5. Identification et invitation/)).toBeVisible({ timeout: 15000 });
  // Les deux canaux sont demandés ; les fournisseurs restent non configurés.
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByText(/6. Récapitulatif/)).toBeVisible({ timeout: 15000 });
}

test.describe('GV5 §83 — Onboarding GOLD / 110 jours', () => {
  test.beforeEach(() => test.setTimeout(180_000));

  test('création complète puis preuves serveur', async ({ page }) => {
    await connexionSA(page);
    await remplirEtapes(page);
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/02-recapitulatif.png` });
    await page.getByRole('button', { name: /Créer l'abonné/ }).click();
    await expect(page.getByRole('heading', { name: /Création confirmée/ })).toBeVisible({ timeout: 40000 });
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/03-creation-confirmee.png` });

    const token = await page.evaluate(() => {
      const raw = localStorage.getItem('sb-yocufscgninxiihwiepa-auth-token');
      return raw ? JSON.parse(raw)?.access_token ?? '' : '';
    });
    expect(token).toBeTruthy();
    const h = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token}` };
    const etab = await fetch(`${URL}/rest/v1/establishments?select=id,name,professional_id,plan,city&professional_id=eq.${PRO}`, { headers: h }).then((r) => r.json());
    expect(etab).toHaveLength(1);
    expect(etab[0].name).toBe(SOCIETE);
    expect(etab[0].plan).toBe('gold');
    const id = etab[0].id;
    const sub = await fetch(`${URL}/rest/v1/subscriptions?select=status,started_at,trial_ends_at,current_period_end&establishment_id=eq.${id}`, { headers: h }).then((r) => r.json());
    expect(sub).toHaveLength(1);
    const debut = new Date(sub[0].started_at);
    const finEssai = new Date(sub[0].trial_ends_at);
    const finPayee = new Date(sub[0].current_period_end);
    expect(Math.round((finEssai.getTime() - debut.getTime()) / 86400000)).toBe(110);
    expect(Math.round((finPayee.getTime() - debut.getTime()) / 86400000)).toBe(365);
    // Lecture via RPC SA : la table permissions est isolée par RLS.
    const details = await fetch(`${URL}/rest/v1/rpc/admin_get_abonne_details`, {
      method: 'POST', headers: h, body: JSON.stringify({ p_id: id }),
    }).then((r) => r.json());
    expect(Array.isArray(details.permissions)).toBe(true);
    expect(details.permissions.length).toBeGreaterThan(0);
    const perms = details.permissions;
    const inv = await fetch(`${URL}/rest/v1/invitations?select=id,email_status,whatsapp_status&establishment_id=eq.${id}`, { headers: h }).then((r) => r.json());
    expect(inv).toHaveLength(1);
    expect(inv[0].email_status).toBe('en_attente');
    expect(inv[0].whatsapp_status).toBe('en_attente');
    console.log('GV583_PREUVES', JSON.stringify({ etab: etab[0].name, plan: etab[0].plan, essaiJours: 110, payantJours: 365, permissions: perms.length, invitation: inv[0] }));
  });

  test('doublon d’identifiant professionnel refusé', async ({ page }) => {
    // Créer d'abord un établissement synthétique avec un identifiant connu.
    const sa = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify({ email: 'superadmin.ui@autodyali-staging.local', password: 'SuperAdminUI2026!' }),
    }).then((r) => r.json());
    const doublon = `ADY-PRO-${String(Date.now()).slice(-6).toUpperCase()}`;
    const cree = await fetch(`${URL}/rest/v1/establishments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${sa.access_token}`, Prefer: 'return=representation' },
      body: JSON.stringify({ name: `Doublon ${doublon}`, slug: `doublon-${doublon.toLowerCase()}`, professional_id: doublon, currency: 'MAD', timezone: 'Africa/Casablanca', plan: 'standard', is_active: true }),
    });
    expect(cree.status).toBe(201);
    await connexionSA(page);
    // Remplir le parcours avec l'identifiant déjà utilisé.
    await remplirEtapes(page, doublon, true);
    // Le contrôle d'unicité serveur bloque la navigation vers l'étape 3.
  });
});

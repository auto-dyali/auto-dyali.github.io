import { test, expect, type Page } from '@playwright/test';

/** GV5 §79 — Parcours RÉEL demande publique → Super Admin (staging, aucun mock). */
const SHOTS = 'docs/audits/screenshots-79';
const SA = 'superadmin.ui@autodyali-staging.local';
const SA_PW = 'SuperAdminUI2026!';

async function loginSA(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill(SA);
  await page.getByPlaceholder(/mot de passe/i).fill(SA_PW);
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
}

test.describe('GV5 §79 — Demandes de souscription', () => {
  test.beforeEach(() => test.setTimeout(90_000));

  test('connexion : bouton principal et CTA premium « Demander une souscription »', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion/');
    await expect(page.getByRole('button', { name: /Se connecter/ })).toBeVisible();
    const cta = page.getByRole('link', { name: /Demander une souscription/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveClass(/sa3d-btn/);
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/01-connexion-desktop.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/connexion/');
    await expect(cta).toBeVisible();
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement).toBeLessThanOrEqual(2);
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/02-connexion-mobile-390.png` });
  });

  test('soumission publique réelle puis traitement Super Admin historisé', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const uniq = Date.now();
    const societe = `Garage Souscription ${uniq}`;

    await page.goto('/pre-achat/');
    await expect(page.getByRole('heading', { name: /formulaire de pré-achat/i })).toBeVisible();
    await page.getByLabel(/Nom commercial/).fill(societe);
    await page.getByLabel(/Raison sociale/).fill(`${societe} SARL`);
    await page.getByLabel(/Secteur/).fill('Automobile');
    await page.getByLabel(/Métier automobile/).selectOption({ index: 1 });
    await page.getByLabel(/Adresse/).fill('12 Rue de la Souscription');
    await page.getByLabel(/Ville/).fill('Rabat');
    await page.getByLabel(/Téléphone professionnel/).fill('+212600000079');
    await page.getByLabel(/E-mail professionnel/).fill(`souscription.${uniq}@autodyali-staging.local`);
    await page.getByLabel(/Nom du Manager/).fill('Manager Souscription');
    await page.getByLabel(/Forfait choisi/).selectOption('standard');
    await page.getByLabel(/Période/).selectOption('mensuel');
    await page.getByLabel(/Nombre d.utilisateurs/).fill('8');
    await page.getByLabel(/Nombre d.établissements/).fill('2');
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.getByRole('button', { name: /Soumettre la demande/ }).click();
    await expect(page.getByText(/demande enregistrée|référence|soumis/i).first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/03-demande-publique-confirmee.png` });

    await loginSA(page);
    await page.goto('/super-admin/pre-achats/');
    await expect(page.getByRole('heading', { name: /Pré-achats/i })).toBeVisible();
    await page.getByPlaceholder(/Entreprise, email/i).fill(societe);
    const ligne = page.getByRole('row').filter({ hasText: societe });
    await expect(ligne).toBeVisible({ timeout: 15000 });
    await ligne.getByRole('button', { name: 'Ouvrir' }).click();
    await expect(page.getByText('Historique de la demande')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/04-demande-super-admin.png` });

    const avant = await page.getByText(/submission/).count();
    await page.getByRole('button', { name: /En attente de vérification/ }).click();
    await expect(page.getByText(/Décision enregistrée/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/status_change/).first()).toBeVisible({ timeout: 15000 });
    const apres = await page.getByText(/status_change/).count();
    expect(apres).toBeGreaterThanOrEqual(avant);
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/05-decision-historisee.png` });
  });
});

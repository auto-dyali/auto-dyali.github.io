import { test, expect } from '@playwright/test';

test.beforeEach(() => test.setTimeout(90_000));
// GV5 §72 — Activation du Manager depuis la vraie page /activer/ (staging).
const TOKEN = '155f29b94fa23ee8bdc8cfd462dcadac2cbc546560198a221951873b8f17ce5d';

test('activation Manager depuis l’interface /activer/', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/activer/?token=${TOKEN}`);
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText();
  console.log('ACTIVATION_PAGE', body.slice(0, 600));
  expect(body).not.toContain('invalide');
  // Remplir le mot de passe choisi par le Manager
  const pwds = page.locator('input[type="password"]');
  console.log('PWD_COUNT', await pwds.count());
  if (await pwds.count() >= 2) {
    await pwds.nth(0).fill('ManagerFinal2026!');
    await pwds.nth(1).fill('ManagerFinal2026!');
    const btn = page.getByRole('button', { name: /activer|définir|valider/i }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(3000);
      console.log('AFTER_ACTIVATE', (await page.locator('body').innerText()).slice(0, 500));
    }
  }
});

test('connexion Manager avec son identifiant de connexion (staging)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('mgr.interface.1795014089951');
  await page.getByPlaceholder(/mot de passe/i).fill('ManagerFinal2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  // La connexion est une navigation SPA : on attend l'état réel plutôt qu'un
  // délai fixe (la cause des échecs intermittents était la lecture de page.url()
  // avant la fin de la navigation, alors que le tableau de bord était déjà rendu).
  await expect(page).toHaveURL(/\/tableau-de-bord/, { timeout: 20000 });
  const url = page.url();
  const body = (await page.locator('body').innerText()).slice(0, 400);
  console.log('MANAGER_LOGIN_URL', url);
  console.log('MANAGER_LOGIN_BODY', body);
});

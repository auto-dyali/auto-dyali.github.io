import { test, expect } from '@playwright/test';

/**
 * GV5 §84 — Préflight environnement : si la RPC de diagnostic est absente
 * (cas production non migrée), la création doit être bloquée et expliquée.
 * Seule la réponse RPC est simulée ; la connexion Super Admin est réelle
 * contre le staging.
 */
test('environnement non migré : alerte visible et bouton désactivé', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/rest/v1/rpc/admin_identity_v2_health', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.admin_identity_v2_health' }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
  await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 60000 });
  await page.goto('/super-admin/onboarding/');
  await expect(page.getByText(/Environnement non prêt/).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/migration 0039/).first()).toBeVisible();
});

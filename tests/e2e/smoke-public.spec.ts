import { test, expect } from '@playwright/test';

/**
 * Smoke tests locaux (pages publiques) — aucune donnée de production, aucune mutation RPC.
 * Ces tests valident le rendu de base et l'absence d'erreurs de navigation évidentes.
 * L'exécution complète nécessite @playwright/test + navigateurs installés localement.
 */
test.describe('Smoke public', () => {
  test('page connexion répond et affiche un formulaire', async ({ page }) => {
    await page.goto('/connexion/');
    await expect(page).toHaveURL(/connexion/);
    await expect(page.locator('form')).toBeVisible();
  });

  test('page mot de passe oublié répond', async ({ page }) => {
    await page.goto('/mot-de-passe-oublie/');
    await expect(page).toHaveURL(/mot-de-passe-oublie/);
  });
});

import { test, expect } from '@playwright/test';

// GV5 §73 — Espace Abonnés unifié (staging Supabase, vraie interface).
test.describe('GV5 §73 — Abonnés unifié', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
    await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
  });

  test('ComboBox Actions compacte (<= 25mm) et menu au clic', async ({ page }) => {
    await page.goto('/super-admin/entreprises/');
    await page.waitForTimeout(2000);
    const combo = page.getByRole('button', { name: /Actions pour/ }).first();
    await expect(combo).toBeVisible({ timeout: 10000 });
    const box = await combo.boundingBox();
    const h = box?.height ?? 0;
    console.log('COMBO_HEIGHT_PX', h, 'MM', (h * 25.4 / 96).toFixed(1));
    expect(h).toBeLessThanOrEqual(95); // 25 mm ≈ 94.5 px à 96 dpi
    // Le menu est fermé au départ
    expect(await page.getByRole('menu', { name: /Actions pour/ }).count()).toBe(0);
    await combo.click();
    await expect(page.getByRole('menu').first()).toBeVisible();
    for (const a of ['Consulter','Modifier','Renouveler']) {
      await expect(page.getByRole('menuitem', { name: a }).first()).toBeVisible();
    }
  });

  test('Fiche unifiée : 5 onglets et modification préremplie', async ({ page }) => {
    await page.goto('/super-admin/entreprises/');
    await page.waitForTimeout(2000);
    const combo = page.getByRole('button', { name: /Actions pour/ }).first();
    await combo.click();
    await page.getByRole('menuitem', { name: 'Consulter' }).first().click();
    await expect(page.getByRole('dialog', { name: /Fiche/ })).toBeVisible();
    const nav = page.getByRole('tablist', { name: /Espaces de la fiche abonné/ });
    for (const t of ['Établissement','Manager','Abonnement','Modules & droits','Invitations & historique']) {
      await expect(nav.getByRole('tab', { name: t })).toBeVisible();
    }
    // Les champs sont préremplis (modification, pas recréation)
    await expect(page.getByRole('dialog').getByText('Chargement de la fiche')).toHaveCount(0, { timeout: 15000 });
    const nom = page.getByRole('textbox', { name: 'Nom commercial' });
    expect((await nom.inputValue()).length).toBeGreaterThan(0);
    await nav.getByRole('tab', { name: 'Invitations & historique' }).click();
    await expect(page.getByRole('dialog').getByText("Journal d'audit")).toBeVisible();
  });

  test('archiver puis restaurer un abonné (logique, réversible)', async ({ page }) => {
    page.on('dialog', d => void d.accept());
    await page.goto('/super-admin/entreprises/');
    await page.waitForTimeout(2000);
    const combo = page.getByRole('button', { name: /Actions pour/ }).first();
    await combo.click();
    await expect(page.getByRole('menuitem', { name: 'Archiver' }).first()).toBeVisible();
    await page.getByRole('menuitem', { name: 'Archiver' }).first().click();
    await page.waitForTimeout(2500);
    // Après archivage, l'action Restaurer doit apparaître
    const combo2 = page.getByRole('button', { name: /Actions pour/ }).first();
    await combo2.click();
    await expect(page.getByRole('menuitem', { name: 'Restaurer' }).first()).toBeVisible();
    await page.getByRole('menuitem', { name: 'Restaurer' }).first().click();
    await page.waitForTimeout(2500);
    // Vérifier UNIQUEMENT la ligne traitée : d'autres comptes de test peuvent
    // rester archivés en staging (contrôle global incorrect en §73).
    const ligne = page.getByRole('row').nth(1);
    await expect(ligne.getByText('Archivé', { exact: true })).toHaveCount(0);
  });

  test('responsive mobile : ComboBox visible et compacte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/super-admin/entreprises/');
    await page.waitForTimeout(2000);
    const combo = page.getByRole('button', { name: /Actions pour/ }).first();
    await expect(combo).toBeVisible();
    const box = await combo.boundingBox();
    expect((box?.height ?? 0)).toBeLessThanOrEqual(95);
  });
});

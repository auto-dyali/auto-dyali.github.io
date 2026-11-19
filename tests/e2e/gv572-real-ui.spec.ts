import { test, expect } from '@playwright/test';

// GV5 §72 — Test RÉEL depuis l'interface Super Admin contre le staging Supabase.
// Aucun mock réseau : vraie connexion Supabase Auth + RPC.
const SA_EMAIL = 'superadmin.ui@autodyali-staging.local';
const SA_PASSWORD = 'SuperAdminUI2026!';

test.describe('GV5 §72 — Parcours réel Super Admin (staging)', () => {
  test('connexion Super Admin réelle et accès aux 11 sections', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill(SA_EMAIL);
    await page.getByPlaceholder(/mot de passe/i).fill(SA_PASSWORD);
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
    // Vérifier les 11 sections dans la sidebar
    const nav = page.locator('aside[aria-label="Navigation Super Admin"]');
    await expect(nav.getByRole('link', { name: /Vue générale/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Abonnés professionnels/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Utilisateurs/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Abonnements & formules/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /CRM commercial/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Finance & facturation/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Support & assistance/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Intégrations & API/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Sécurité & permissions/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Journal d.activit/ }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Système & paramètres/ }).first()).toBeVisible();
  });
  test('PARCOURS P0 : créer un abonné depuis l’interface Super Admin', async ({ page }) => {
    // Durée mesurée ~42 s quand le serveur de dev démarre à froid sous charge.
    // L'EF répond 200 en <1 s : le délai vient du rendu frontend, pas du backend.
    test.setTimeout(90_000);
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('BROWSER_ERR', m.text().slice(0, 300));
    });
    page.on('response', (r) => {
      if (r.url().includes('/functions/v1/')) console.log('FN_RESP', r.status(), r.url().split('/').pop());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const uniq = Date.now();
    // Connexion réelle
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill(SA_EMAIL);
    await page.getByPlaceholder(/mot de passe/i).fill(SA_PASSWORD);
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });

    // Aller à l'onboarding
    await page.goto('/super-admin/onboarding/');
    await expect(page.getByRole('heading', { name: /1. Identification de l.entreprise/ })).toBeVisible({ timeout: 10000 });

    // Étape 1 — Établissement
    await page.getByPlaceholder('Garage Atlas SARL').fill('Garage Interface Test SARL');
    await page.getByPlaceholder('Garage Atlas', { exact: true }).fill('Garage Interface Test');
    await page.getByPlaceholder('garage-atlas').fill(`garage-interface-test-${uniq}`);
    // Identifiant professionnel : cliquer Générer
    await page.getByRole('button', { name: 'Générer' }).first().click();
    await page.locator('input[placeholder*="carrosserie"]').fill('Mécanique générale');
    await page.locator('input[placeholder*="Rue de la"]').fill('10 Boulevard Test');
    await page.getByPlaceholder('Casablanca').first().fill('Rabat');
    await page.getByPlaceholder('Casablanca-Settat').fill('Rabat-Salé');
    await page.getByPlaceholder('contact@garage.com').fill('contact@garage-interface-test.local');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForTimeout(3000);

    // Étape 2 — Manager
    await expect(page.getByText('2. Création du Manager')).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Ahmed', { exact: true }).fill('Manager');
    await page.getByPlaceholder('Naji', { exact: true }).fill('Interface Test');
    await page.getByPlaceholder('ahmed.naji@garage.com').fill(`manager.interface.${uniq}@garage-interface-test.local`);
    await page.getByPlaceholder('+212 6 00 00 00 00').fill('+212600000099');
    // login : remplir directement (plus robuste que le bouton Générer)
    await page.getByPlaceholder('a.naji').fill(`mgr.interface.${uniq}`);
    await page.locator('input[type="password"]').first().fill('ManagerInterface2026!');
    await page.locator('input[type="password"]').nth(1).fill('ManagerInterface2026!');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForTimeout(3000);
    console.log('AFTER_STEP2', JSON.stringify(await page.getByText(/Étape .* \/ 6/).allInnerTexts()), JSON.stringify(await page.locator('[role=alert]').allInnerTexts()));

    // Étape 3 — Formule : sélectionner GOLD, durée 2 ans, essai 30j
    await expect(page.getByText('3. Formule, abonnement et période')).toBeVisible({ timeout: 8000 });
    // Attendre le chargement des plans
    await page.waitForTimeout(1500);
    const goldBtn = page.getByRole('button', { name: /GOLD/i }).first();
    if (await goldBtn.isVisible().catch(() => false)) await goldBtn.click();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 4 — Modules : cocher au moins un module
    await expect(page.getByRole('heading', { name: /4. Modules/ })).toBeVisible({ timeout: 8000 });
    const checkboxes = page.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 0) {
      await checkboxes.first().check();
      // Cocher aussi can_view du premier module si présent
      const view = page.locator('input[type="checkbox"]').nth(1);
      if (await view.count() > 0 && !(await view.isChecked())) await view.check().catch(()=>{});
    }
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 5 — Invitation : e-mail coché par défaut
    await expect(page.getByText(/5. Identification et invitation/)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 6 — Récap : créer
    await expect(page.getByText(/6. Récapitulatif/)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /Créer l.abonné/ }).click();

    // Résultat réel
    await expect(page.getByRole('heading', { name: /Création confirmée/ })).toBeVisible({ timeout: 30000 });
    // Vérifier l'ID pro et le login dans le résultat
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/ADY-PRO-[0-9A-F]{6}/);
    console.log('ONBOARDING_UI_OK', body.slice(0, 400));
  });

});

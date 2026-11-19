import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §76 — Unification technique création / modification et compléments.
 * STAGING uniquement, vraie interface, aucun mock réseau.
 */

const SHOTS = 'docs/audits/screenshots-76';
const SA_EMAIL = 'superadmin.ui@autodyali-staging.local';
const SA_PASSWORD = 'SuperAdminUI2026!';

async function login(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill(SA_EMAIL);
  await page.getByPlaceholder(/mot de passe/i).fill(SA_PASSWORD);
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
}

async function ouvrirPremiereFiche(page: Page) {
  await page.goto('/super-admin/entreprises/');
  await expect(page.getByRole('button', { name: /Actions pour/ }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Actions pour/ }).first().click();
  await page.getByRole('menuitem', { name: 'Consulter' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText('Chargement de la fiche')).toHaveCount(0, { timeout: 15000 });
  return dialog;
}

test.describe('GV5 §76 — Unification et vérifications complémentaires', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test('création 6 étapes avec champs administratifs dédiés et récapitulatif complet', async ({ page }) => {
    const uniq = Date.now();
    await page.goto('/super-admin/onboarding/');
    await expect(page.getByRole('heading', { name: /1. Identification de l.entreprise/ })).toBeVisible({ timeout: 10000 });

    // Étape 1 — établissement (primitives partagées Champ3D)
    await page.getByPlaceholder('Garage Atlas SARL').fill('Garage Unification 76 SARL');
    await page.getByPlaceholder('Garage Atlas', { exact: true }).fill(`Garage Unification ${uniq}`);
    await page.getByPlaceholder('garage-atlas').fill(`garage-unification-${uniq}`);
    await page.getByRole('button', { name: 'Générer' }).first().click();
    await page.locator('input[placeholder*="carrosserie"]').fill('Mécanique générale');
    await page.locator('input[placeholder*="Rue de la"]').fill('12 Avenue Unification');
    await page.getByPlaceholder('Casablanca').first().fill('Rabat');
    await page.getByPlaceholder('Casablanca-Settat').fill('Rabat-Salé');
    await page.getByPlaceholder('contact@garage.com').fill(`contact.unification.${uniq}@autodyali-staging.local`);
    await page.getByPlaceholder('Forme juridique, registre, statuts…').fill('SARL — RC 123456');
    await page.getByPlaceholder('ICE, TVA, patente…').fill('ICE 987654321');
    await page.getByPlaceholder('ICE, RC, patente, etc. (si disponibles)').fill('Patente 76');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('2. Création du Manager')).toBeVisible({ timeout: 15000 });

    // Étape 2 — Manager
    await page.getByPlaceholder('Ahmed', { exact: true }).fill('Manager');
    await page.getByPlaceholder('Naji', { exact: true }).fill('Unification');
    await page.getByPlaceholder('ahmed.naji@garage.com').fill(`manager.unification.${uniq}@autodyali-staging.local`);
    await page.getByPlaceholder('+212 6 00 00 00 00').fill('+212600000076');
    await page.getByPlaceholder('a.naji').fill(`mgr.unification.${uniq}`);
    await page.locator('input[type="password"]').first().fill('ManagerUnification2026!');
    await page.locator('input[type="password"]').nth(1).fill('ManagerUnification2026!');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText(/3. Formule, abonnement et période/)).toBeVisible({ timeout: 15000 });

    // Étape 3 — formule
    await page.waitForTimeout(1200);
    const gold = page.getByRole('button', { name: /GOLD/i }).first();
    if (await gold.isVisible().catch(() => false)) await gold.click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('heading', { name: /4. Modules/ })).toBeVisible({ timeout: 15000 });

    // Étape 4 — modules / permissions
    const boxes = page.locator('input[type="checkbox"]');
    if (await boxes.count() > 0) {
      await boxes.first().check({ timeout: 10000 });
      const view = boxes.nth(1);
      if (await view.count() > 0 && !(await view.isChecked())) await view.check({ timeout: 10000 }).catch(() => undefined);
    }
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText(/5. Identification et invitation/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText(/6. Récapitulatif/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Récapitulatif complet')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/01-recapitulatif-creation.png` });

    await page.getByRole('button', { name: /Créer l.abonné/ }).click();
    await expect(page.getByRole('heading', { name: /Création confirmée/ })).toBeVisible({ timeout: 30000 });
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/02-creation-confirmee.png` });

    // Preuve de persistance des colonnes dédiées dans la fiche du nouvel abonné
    const dialog = await ouvrirPremiereFiche(page);
    await expect(dialog.getByRole('textbox', { name: 'Pays' })).toHaveValue('Maroc');
    await expect(dialog.getByRole('textbox', { name: 'Informations juridiques' })).toHaveValue('SARL — RC 123456');
    await expect(dialog.getByRole('textbox', { name: 'Informations fiscales' })).toHaveValue('ICE 987654321');
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/03-champs-admin-persistes.png` });
  });

  test('modification : récapitulatif explicite puis confirmation journalisée', async ({ page }) => {
    const dialog = await ouvrirPremiereFiche(page);
    const ville = dialog.getByRole('textbox', { name: 'Ville' });
    const original = await ville.inputValue();

    await dialog.getByRole('button', { name: "Modifier l'établissement" }).click();
    await ville.fill('VILLE-RECAP-76');
    await dialog.getByRole('button', { name: 'Enregistrer' }).first().click();

    // Le récapitulatif doit bloquer l'écriture jusqu'à confirmation explicite.
    await expect(dialog.getByText("Confirmer la modification de l'établissement")).toBeVisible();
    await expect(dialog.getByText(/→ VILLE-RECAP-76/)).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/04-recap-modification.png` });
    await dialog.getByRole('button', { name: 'Confirmer et enregistrer' }).click();
    await expect(page.getByText('Établissement enregistré')).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('textbox', { name: 'Ville' })).toHaveValue('VILLE-RECAP-76');

    // Restauration non destructive
    await dialog.getByRole('button', { name: "Modifier l'établissement" }).click();
    await dialog.getByRole('textbox', { name: 'Ville' }).fill(original);
    await dialog.getByRole('button', { name: 'Enregistrer' }).first().click();
    await dialog.getByRole('button', { name: 'Confirmer et enregistrer' }).click();
    await expect(page.getByText('Établissement enregistré')).toBeVisible({ timeout: 15000 });
  });

  test('tablette 768 et 1024 px : cinq espaces, menu Actions, aucun débordement', async ({ page }) => {
    for (const largeur of [768, 1024]) {
      await page.setViewportSize({ width: largeur, height: 1024 });
      await page.goto('/super-admin/entreprises/');
      await expect(page.getByRole('button', { name: /Actions pour/ }).first()).toBeVisible({ timeout: 15000 });
      await page.screenshot({ animations: 'disabled', path: `${SHOTS}/05-liste-tablette-${largeur}.png` });
      const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largeurPage).toBeLessThanOrEqual(largeur + 2);

      await page.getByRole('button', { name: /Actions pour/ }).first().click();
      await expect(page.getByRole('menu').first()).toBeVisible();
      await page.screenshot({ animations: 'disabled', path: `${SHOTS}/06-menu-actions-tablette-${largeur}.png` });
      await page.getByRole('menuitem', { name: 'Consulter' }).first().click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });
      await expect(dialog.getByText('Chargement de la fiche')).toHaveCount(0, { timeout: 15000 });
      const onglets = ['Établissement', 'Manager', 'Abonnement', 'Modules & droits', 'Invitations & historique'];
      for (const [i, o] of onglets.entries()) {
        await dialog.getByRole('tab', { name: o }).click();
        await expect(dialog.getByRole('tab', { name: o })).toHaveAttribute('aria-selected', 'true');
        if (i === 0) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/07-fiche-tablette-${largeur}.png` });
        if (i === 3) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/08-modules-tablette-${largeur}.png` });
      }
      const largeurDialogue = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(largeurDialogue).toBeLessThanOrEqual(2);
      await dialog.getByRole('button', { name: /Fermer/ }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});

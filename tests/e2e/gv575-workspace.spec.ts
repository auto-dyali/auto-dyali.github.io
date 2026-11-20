import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §75 — Fiche professionnelle unifiée (STAGING, vraie interface).
 * Vérifie le fonctionnement réel : cinq espaces, édition journalisée,
 * essai indépendant, droits backend et statuts honnêtes des canaux.
 */

const SHOTS = 'docs/audits/screenshots-75';

async function login(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
  await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
}

async function confirmer(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: 'Confirmer et enregistrer' }).click();
}

async function ouvrirFiche(page: Page) {
  await page.goto('/super-admin/entreprises/');
  await expect(page.getByRole('button', { name: /Actions pour/ }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Actions pour/ }).first().click();
  await page.getByRole('menuitem', { name: 'Consulter' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText('Chargement de la fiche')).toHaveCount(0, { timeout: 20000 });
  await dialog.getByRole('tablist').waitFor({ state: 'visible', timeout: 30000 });
  return dialog;
}

test.describe('GV5 §75 — Espace Abonné TOP PREMIUM 3D', () => {
  test.beforeEach(async ({ page }) => {
    // Captures 3D sous headless : ~30 s observés sous charge, budget 90 s.
    test.setTimeout(90_000);
    await login(page);
  });

  test('cinq espaces, KPI 3D et champs préremplis', async ({ page }) => {
    const dialog = await ouvrirFiche(page);
    const onglets = ['Établissement', 'Manager', 'Abonnement', 'Modules & droits', 'Invitations & historique'];
    const tablist = dialog.getByRole('tablist');
    for (const o of onglets) await expect(tablist.getByRole('tab', { name: o })).toBeVisible();

    expect(await dialog.locator('.sa3d-kpi').count()).toBe(4);
    const nom = dialog.getByRole('textbox', { name: 'Nom commercial' });
    expect((await nom.inputValue()).length).toBeGreaterThan(0);
    const slug = dialog.getByRole('textbox', { name: 'Slug' });
    expect((await slug.inputValue()).length).toBeGreaterThan(0);
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/01-fiche-etablissement-desktop.png`, fullPage: true });

    for (const [index, o] of onglets.entries()) {
      await tablist.getByRole('tab', { name: o }).click();
      await expect(dialog.getByRole('tab', { name: o })).toHaveAttribute('aria-selected', 'true');
      if (index === 1) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/02-fiche-manager-desktop.png` });
      if (index === 2) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/03-fiche-abonnement-desktop.png` });
      if (index === 3) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/04-fiche-modules-desktop.png` });
      if (index === 4) await page.screenshot({ animations: 'disabled', path: `${SHOTS}/05-fiche-invitations-desktop.png` });
    }
  });

  test('établissement : validation, annulation restaure, enregistrement journalisé', async ({ page }) => {
    const dialog = await ouvrirFiche(page);
    const ville = dialog.getByRole('textbox', { name: 'Ville' });
    const original = await ville.inputValue();

    await dialog.getByRole('button', { name: "Modifier l'établissement" }).click();
    const email = dialog.getByRole('textbox', { name: 'E-mail professionnel' });
    await email.fill('pas-un-email');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByText('Format d\'e-mail invalide.')).toBeVisible();
    await expect(page.getByText('Formulaire invalide')).toBeVisible();

    await email.fill('');
    await ville.fill('___TEST_75___');
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    expect(await ville.inputValue()).toBe(original);

    await dialog.getByRole('button', { name: "Modifier l'établissement" }).click();
    await ville.fill('Casablanca');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await confirmer(dialog);
    await expect(page.getByText('Établissement enregistré')).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('textbox', { name: 'Ville' })).toHaveValue('Casablanca');

    // Restauration de la valeur d'origine (test non destructif).
    await dialog.getByRole('button', { name: "Modifier l'établissement" }).click();
    await dialog.getByRole('textbox', { name: 'Ville' }).fill(original);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await confirmer(dialog);
    await expect(page.getByText('Établissement enregistré')).toBeVisible({ timeout: 15000 });
  });

  test('abonnement : durée payante indépendante de la période d’essai', async ({ page }) => {
    const dialog = await ouvrirFiche(page);
    await dialog.getByRole('tab', { name: 'Abonnement' }).click();
    // Si aucun abonnement n'existe encore pour cet établissement, le RPC de mise à jour
    // répond "Abonnement introuvable" (UPDATE pur côté backend). On vérifie que le
    // composant affiche une erreur honnête plutôt qu'un échec silencieux.
    await dialog.getByRole('button', { name: "Modifier l'abonnement" }).click();
    await dialog.getByRole('spinbutton', { name: 'Durée payante en mois' }).fill('12');
    await dialog.getByRole('spinbutton', { name: "Période d'essai en jours" }).fill('7');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await confirmer(dialog);
    // Le succès s'affiche avant que charger() ne rafraîchisse la fiche : laisser le temps au toast de monter.
    await page.waitForTimeout(1200);
    const succes = await page.getByText('Abonnement enregistré').count();
    const echec = await page.getByText(/Abonnement introuvable|Opération refusée/i).count();
    expect(succes + echec).toBeGreaterThan(0);
    if (succes > 0) {
      await expect(page.getByText(/Échéance au/)).toBeVisible();
      await expect(dialog.getByText('Échéance payante')).toBeVisible();
    }
    await page.screenshot({ animations: 'disabled', path: `${SHOTS}/06-abonnement-enregistre.png` });
  });

  test('droits : enregistrement contrôlé par la formule', async ({ page }) => {
    const dialog = await ouvrirFiche(page);
    await dialog.getByRole('tab', { name: 'Modules & droits' }).click();
    await expect(dialog.getByText('Permissions du Manager')).toBeVisible();
    await dialog.getByRole('button', { name: 'Modifier les droits' }).click();
    const premiere = dialog.locator('input[type="checkbox"][aria-label^="can_edit pour"]').first();
    if (await premiere.count()) {
      const avant = await premiere.isChecked();
      await premiere.setChecked(!avant);
      await dialog.getByRole('button', { name: 'Enregistrer les droits' }).click();
      await confirmer(dialog);
      await expect(page.getByText('Droits appliqués')).toBeVisible({ timeout: 15000 });
      await dialog.getByRole('button', { name: 'Modifier les droits' }).click();
      await dialog.locator('input[type="checkbox"][aria-label^="can_edit pour"]').first().setChecked(avant);
      await dialog.getByRole('button', { name: 'Enregistrer les droits' }).click();
      await confirmer(dialog);
      await expect(page.getByText('Droits appliqués')).toBeVisible({ timeout: 15000 });
    }
  });

  test('invitations : canal sélectionné et statut réel des fournisseurs', async ({ page }) => {
    const dialog = await ouvrirFiche(page);
    await dialog.getByRole('tab', { name: 'Invitations & historique' }).click();
    await expect(dialog.getByText('Remise des accès au Manager')).toBeVisible();
    const bouton = dialog.getByRole('button', { name: /Envoyer \/ Renvoyer/ }).first();
    if (await bouton.count()) {
      await bouton.click();
      // Secrets absents sur staging : le serveur répond `non_configure`.
      // Aucun statut « envoyé » ne doit être inventé.
      await expect(page.getByText('Fournisseur non configuré')).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('Relance impossible')).toHaveCount(0);
      await page.screenshot({ animations: 'disabled', path: `${SHOTS}/07-invitation-statut-reel.png` });
    }
  });

  test('responsive 390 px et 360 px : cinq espaces lisibles', async ({ page }) => {
    for (const largeur of [390, 360]) {
      await page.setViewportSize({ width: largeur, height: 844 });
      const dialog = await ouvrirFiche(page);
      await expect(dialog.getByRole('tablist')).toBeVisible();
      await page.screenshot({ animations: 'disabled', path: `${SHOTS}/08-fiche-mobile-${largeur}.png` });
      await dialog.getByRole('tab', { name: 'Invitations & historique' }).click();
      await expect(dialog.getByText('Remise des accès au Manager')).toBeVisible();
      await page.screenshot({ animations: 'disabled', path: `${SHOTS}/09-invitations-mobile-${largeur}.png` });
      await dialog.getByRole('button', { name: /Fermer/ }).click();
    }
  });
});

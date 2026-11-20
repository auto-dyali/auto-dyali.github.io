import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §86 — Tests de parcours RÉELS sur staging :
 *   1. Sélecteur recherchable (combobox) : ouverture, recherche, sélection.
 *   2. Menu « Actions » : ouverture en bas de tableau, éléments jamais coupés.
 *   3. Filtre des abonnés archivés.
 *   4. Modale compacte : contenu défilable et boutons joignables en 320 px.
 *   5. Page de définition du mot de passe (Next 16 : searchParams).
 */

async function connexionSA(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
  await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/, { timeout: 20000 });
}

async function connexionManager(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('manager.interface.1795014089951@garage-interface-test.local');
  await page.getByPlaceholder(/mot de passe/i).fill('ManagerFinal2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/, { timeout: 20000 });
}

test.describe('GV5 §86 — Formulaires et sélecteurs', () => {
  test.beforeEach(() => test.setTimeout(300_000));

  test('combobox client : ouverture, recherche et sélection au POS', async ({ page }) => {
    await connexionManager(page);
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 120)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tableau-de-bord/point-de-vente/');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const combo = page.getByRole('button', { name: 'Sélectionner un client' });
    await combo.click();
    const champRecherche = page.getByRole('searchbox', { name: /rechercher dans/i });
    await expect(champRecherche).toBeVisible();

    // Saisie de recherche : le panneau réagit et n'écrase jamais la mise en page.
    await champRecherche.fill('zzzz-inexistant');
    await expect(page.getByText('Aucun client ne correspond.')).toBeVisible();

    // Sélection réelle si des clients existent, sinon repli vide propre.
    await champRecherche.fill('');
    const option = page.locator('[role="listbox"] button').first();
    if (await option.count()) {
      await option.click();
      await expect(combo).not.toHaveText(/Sélectionner un client…/);
    } else {
      await expect(page.locator('[role="listbox"]')).toBeVisible();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(erreurs).toEqual([]);
  });

  test('modale « Nouveau produit » : défilement et boutons joignables en 320 px', async ({ page }) => {
    await connexionManager(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/tableau-de-bord/stock/');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.getByRole('button', { name: /Nouveau produit/i }).click();

    const dialog = page.getByRole('dialog', { name: /Nouveau produit/i });
    await expect(dialog).toBeVisible();
    const mesures = await dialog.evaluate((el) => {
      const boite = el.querySelector('.carte') as HTMLElement | null;
      if (!boite) return { boiteMaxHeight: 'absent', boiteOverflow: 'absent', boiteScrollable: 0 };
      return {
        boiteScrollable: boite.scrollHeight > boite.clientHeight ? boite.scrollHeight - boite.clientHeight : 0,
        boiteMaxHeight: getComputedStyle(boite).maxHeight,
        boiteOverflow: getComputedStyle(boite).overflowY,
      };
    });
    // Le panneau doit être limité par le viewport ET défiler.
    expect(mesures.boiteMaxHeight).not.toBe('none');
    expect(mesures.boiteOverflow).toBe('auto');

    // Le bouton d'enregistrement doit être atteignable (défilement interne).
    const submit = dialog.getByRole('button', { name: /Enregistrer/i });
    await expect(submit).toBeVisible();
    await submit.scrollIntoViewIfNeeded();
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(568);

    // Le bouton Annuler doit fermer la modale.
    await dialog.getByRole('button', { name: /Annuler/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('page /mot-de-passe-traite : rendu sans erreur Next 16', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 150)));
    await page.goto('/mot-de-passe-traite/?reset=1');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByRole('heading', { name: /Nouveau mot de passe/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Au moins 6 caractères/i)).toBeVisible();
    await page.screenshot({ path: 'docs/audits/screenshots-85/mot-de-passe-traite.png', fullPage: true });
    expect(erreurs).toEqual([]);
  });

  test('Super Admin : menu Actions ouvert en bas de liste, aucun élément coupé', async ({ page }) => {
    await connexionSA(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/super-admin/entreprises/');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const boutons = page.getByRole('button', { name: /Actions pour/i });
    const total = await boutons.count();
    expect(total).toBeGreaterThan(0);
    // Dernière ligne : c'est là que le menu bascule vers le haut.
    await boutons.last().click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const items = menu.getByRole('menuitem');
    expect(await items.count()).toBeGreaterThan(2);
    const cible = await menu.boundingBox();
    expect(cible).not.toBeNull();
    expect(cible!.y).toBeGreaterThanOrEqual(0);
    expect(cible!.y + cible!.height).toBeLessThanOrEqual(844);
    expect(cible!.x).toBeGreaterThanOrEqual(0);
    expect(cible!.x + cible!.width).toBeLessThanOrEqual(390);

    // Fermeture par Échap.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('Super Admin : filtre « Archivés » fonctionnel et non destructif', async ({ page }) => {
    await connexionSA(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/super-admin/entreprises/');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const filtre = page.getByRole('combobox', { name: 'État', exact: true });
    await expect(filtre).toBeVisible();

    const compterLignes = async () => page.getByRole('button', { name: /Actions pour/i }).count();
    const nombreActifs = await compterLignes();
    expect(nombreActifs).toBeGreaterThan(0);

    await filtre.selectOption('archives');
    const nombreArchives = await compterLignes();
    // Les abonnés archivés existent et sont consultables séparément.
    expect(nombreArchives).toBeGreaterThan(0);
    expect(nombreArchives).toBeLessThan(nombreActifs);

    await filtre.selectOption('tous');
    await expect(filtre).toHaveValue('tous');
    expect(await compterLignes()).toBe(nombreActifs);
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §80 — Audit ergonomique automatisé de TOUTES les pages.
 * Mesure : débordement horizontal, erreurs console, présence d'un titre.
 * STAGING réel, aucun mock.
 */
const SHOTS = 'docs/audits/screenshots-80';

const SA_PAGES = [
  '/super-admin/', '/super-admin/entreprises/', '/super-admin/garages/',
  '/super-admin/managers/', '/super-admin/plans/', '/super-admin/abonnements/',
  '/super-admin/paiements/', '/super-admin/employes/', '/super-admin/invitations/',
  '/super-admin/pre-achats/', '/super-admin/roles/', '/super-admin/audit/',
  '/super-admin/crm/', '/super-admin/rapports/', '/super-admin/parametres/',
  '/super-admin/integrations/', '/super-admin/whatsapp/', '/super-admin/chatbot/',
  '/super-admin/support/', '/super-admin/sauvegarde/', '/super-admin/onboarding/',
];

const MANAGER_PAGES = [
  '/tableau-de-bord/', '/tableau-de-bord/clients/', '/tableau-de-bord/vehicules/',
  '/tableau-de-bord/stock/', '/tableau-de-bord/point-de-vente/', '/tableau-de-bord/employes/',
];

async function connexion(page: Page, email: string, pw: string) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/mot de passe/i).fill(pw);
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/, { timeout: 20000 });
}

async function auditer(page: Page, route: string, largeur: number) {
  await page.setViewportSize({ width: largeur, height: largeur < 700 ? 844 : 900 });
  const erreurs: string[] = [];
  const onError = (e: Error) => erreurs.push(e.message.slice(0, 120));
  page.on('pageerror', onError);
  await page.goto(route);
  // Attendre la stabilisation du rendu (hydratation + chargement des données)
  // afin de mesurer la mise en page réelle, pas un état transitoire.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);
  const mesure = await page.evaluate(() => ({
    debordement: document.documentElement.scrollWidth - window.innerWidth,
    titre: document.querySelector('h1')?.textContent?.trim() ?? '',
  }));
  page.off('pageerror', onError);
  return { route, largeur, ...mesure, erreurs };
}

test.describe('GV5 §80 — Ergonomie toutes pages', () => {
  test.beforeEach(() => test.setTimeout(360_000));

  test('Super Admin : 21 pages sur PC 1440 et tablette 768', async ({ page }) => {
    await connexion(page, 'superadmin.ui@autodyali-staging.local', 'SuperAdminUI2026!');
    const resultats = [];
    for (const largeur of [1440, 768]) {
      for (const route of SA_PAGES) resultats.push(await auditer(page, route, largeur));
    }
    const debordements = resultats.filter((r) => r.debordement > 2);
    const sansTitre = resultats.filter((r) => !r.titre);
    console.log('SA_AUDIT', JSON.stringify({
      pages: resultats.length, debordements: debordements.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
      sansTitre: sansTitre.map((r) => `${r.largeur}:${r.route}`),
      erreurs: resultats.flatMap((r) => r.erreurs).slice(0, 10),
    }));
    expect(debordements).toEqual([]);
    expect(sansTitre).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/super-admin/entreprises/');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ animations: 'disabled', timeout: 90_000, path: `${SHOTS}/01-entreprises-apres.png` });
  });

  test('Manager : pages métier sur tablette 768 et mobile 390', async ({ page }) => {
    await connexion(page, 'manager.interface.1795014089951@garage-interface-test.local', 'ManagerFinal2026!');
    const resultats = [];
    for (const largeur of [768, 390]) {
      for (const route of MANAGER_PAGES) resultats.push(await auditer(page, route, largeur));
    }
    const debordements = resultats.filter((r) => r.debordement > 2);
    console.log('MGR_AUDIT', JSON.stringify({
      pages: resultats.length, debordements: debordements.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
    }));
    expect(debordements).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tableau-de-bord/');
    await page.screenshot({ animations: 'disabled', timeout: 90_000, path: `${SHOTS}/02-manager-mobile-apres.png` });
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §81 — Audit responsive des pages NON couvertes en §80.
 * Mesure réelle : débordement horizontal, erreurs console, titre, sur
 * PC 1440 / tablette 768 / smartphone 390. STAGING, aucun mock.
 */
const SHOTS = 'docs/audits/screenshots-81';

const PUBLIQUES = [
  '/', '/connexion/', '/offres/', '/pre-achat/', '/activer/',
  '/changer-mot-de-passe/', '/mot-de-passe-oublie/', '/mot-de-passe-traite/',
  '/reservation/', '/employe/', '/employe/plus/', '/employe/scanner/',
];

const MANAGER_RESTANTES = [
  '/tableau-de-bord/achats', '/tableau-de-bord/assistant', '/tableau-de-bord/atelier',
  '/tableau-de-bord/caisse', '/tableau-de-bord/catalogue', '/tableau-de-bord/cheques',
  '/tableau-de-bord/creances', '/tableau-de-bord/devis', '/tableau-de-bord/facturation',
  '/tableau-de-bord/fournisseurs', '/tableau-de-bord/historique-ventes',
  '/tableau-de-bord/import-export', '/tableau-de-bord/notifications',
  '/tableau-de-bord/parametres', '/tableau-de-bord/permissions', '/tableau-de-bord/planning',
  '/tableau-de-bord/pneumatiques', '/tableau-de-bord/print-pro', '/tableau-de-bord/rapports',
  '/tableau-de-bord/scan-pro', '/tableau-de-bord/support',
];

async function mesurer(page: Page, route: string, largeur: number) {
  await page.setViewportSize({ width: largeur, height: largeur < 700 ? 844 : 900 });
  const erreurs: string[] = [];
  const onError = (e: Error) => erreurs.push(e.message.slice(0, 100));
  page.on('pageerror', onError);
  await page.goto(route);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({
    debordement: document.documentElement.scrollWidth - window.innerWidth,
    titre: document.querySelector('h1')?.textContent?.trim() ?? '',
  }));
  page.off('pageerror', onError);
  return { route, largeur, ...r, erreurs };
}

test.describe('GV5 §81 — Pages restantes', () => {
  test.beforeEach(() => test.setTimeout(900_000));

  test('12 pages publiques sur PC, tablette et smartphone', async ({ page }) => {
    const resultats = [];
    for (const w of [1440, 768, 390]) for (const route of PUBLIQUES) resultats.push(await mesurer(page, route, w));
    const deb = resultats.filter((r) => r.debordement > 2);
    console.log('PUB_AUDIT', JSON.stringify({
      combinaisons: resultats.length,
      debordements: deb.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
      erreurs: resultats.flatMap((r) => r.erreurs).slice(0, 8),
    }));
    expect(deb).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pre-achat/');
    await page.screenshot({ animations: 'disabled', timeout: 90_000, path: `${SHOTS}/01-pre-achat-mobile.png` });
  });

  test('21 pages Manager restantes sur PC, tablette et smartphone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill('manager.interface.1795014089951@garage-interface-test.local');
    await page.getByPlaceholder(/mot de passe/i).fill('ManagerFinal2026!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page).not.toHaveURL(/\/connexion/, { timeout: 20000 });
    const resultats = [];
    for (const w of [1440, 768, 390]) for (const route of MANAGER_RESTANTES) resultats.push(await mesurer(page, route, w));
    const deb = resultats.filter((r) => r.debordement > 2);
    console.log('MGR_AUDIT', JSON.stringify({
      combinaisons: resultats.length,
      debordements: deb.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
      erreurs: resultats.flatMap((r) => r.erreurs).slice(0, 8),
    }));
    expect(deb).toEqual([]);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/tableau-de-bord/atelier/');
    await page.screenshot({ animations: 'disabled', timeout: 90_000, path: `${SHOTS}/02-atelier-tablette.png` });
  });
});

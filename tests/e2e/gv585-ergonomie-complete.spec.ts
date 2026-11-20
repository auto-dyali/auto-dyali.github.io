import { test, expect, type Page } from '@playwright/test';

/**
 * GV5 §85 — Audit ergonomique étendu : 9 largeurs réelles.
 * Mesure objective : débordement horizontal, contenu coupé, erreurs console.
 * STAGING réel, aucun mock.
 */

const SA_PAGES = [
  '/super-admin/', '/super-admin/entreprises/', '/super-admin/garages/',
  '/super-admin/managers/', '/super-admin/plans/', '/super-admin/abonnements/',
  '/super-admin/paiements/', '/super-admin/employes/', '/super-admin/invitations/',
  '/super-admin/pre-achats/', '/super-admin/roles/', '/super-admin/audit/',
  '/super-admin/crm/', '/super-admin/rapports/', '/super-admin/parametres/',
  '/super-admin/integrations/', '/super-admin/whatsapp/', '/super-admin/chatbot/',
  '/super-admin/support/', '/super-admin/sauvegarde/', '/super-admin/onboarding/',
];

const PUBLIQUES = [
  '/', '/connexion/', '/offres/', '/pre-achat/', '/activer/',
  '/changer-mot-de-passe/', '/mot-de-passe-oublie/', '/mot-de-passe-traite/',
  '/reservation/',
];

const LARGEURS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

async function connexion(page: Page, email: string, pw: string) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/mot de passe/i).fill(pw);
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/, { timeout: 20000 });
}

async function mesurer(page: Page, route: string, largeur: number) {
  await page.setViewportSize({ width: largeur, height: largeur < 700 ? 844 : 900 });
  const erreurs: string[] = [];
  const onError = (e: Error) => erreurs.push(e.message.slice(0, 100));
  page.on('pageerror', onError);
  await page.goto(route);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const debordement = doc.scrollWidth - window.innerWidth;
    // Champs dont la largeur dépasse leur conteneur (formulaires coupés).
    const coupes = Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea, button'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && (rect.right > window.innerWidth + 2 || rect.left < -2);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}`);
    return { debordement, coupes };
  });
  page.off('pageerror', onError);
  return { route, largeur, ...r, erreurs };
}

test.describe('GV5 §85 — Ergonomie étendue', () => {
  test.beforeEach(() => test.setTimeout(1_200_000));

  test('pages publiques : 9 largeurs, aucun débordement', async ({ page }) => {
    const resultats = [];
    for (const w of LARGEURS) for (const route of PUBLIQUES) resultats.push(await mesurer(page, route, w));
    const deb = resultats.filter((r) => r.debordement > 2);
    const coupes = resultats.filter((r) => r.coupes.length > 0);
    console.log('GV585_PUB', JSON.stringify({
      combinaisons: resultats.length,
      debordements: deb.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
      coupes: coupes.map((r) => `${r.largeur}:${r.route}=${r.coupes.join(',')}`),
      erreurs: [...new Set(resultats.flatMap((r) => r.erreurs))].slice(0, 10),
    }));
    expect(deb).toEqual([]);
  });

  test('Super Admin : 9 largeurs, aucun débordement ni champ coupé', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await connexion(page, 'superadmin.ui@autodyali-staging.local', 'SuperAdminUI2026!');
    const resultats = [];
    for (const w of LARGEURS) for (const route of SA_PAGES) resultats.push(await mesurer(page, route, w));
    const deb = resultats.filter((r) => r.debordement > 2);
    const coupes = resultats.filter((r) => r.coupes.length > 0);
    console.log('GV585_SA', JSON.stringify({
      combinaisons: resultats.length,
      debordements: deb.map((r) => `${r.largeur}:${r.route}=${r.debordement}`),
      coupes: coupes.map((r) => `${r.largeur}:${r.route}=${r.coupes.join(',')}`),
      erreurs: [...new Set(resultats.flatMap((r) => r.erreurs))].slice(0, 10),
    }));
    expect(deb).toEqual([]);
  });
});

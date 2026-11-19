import { test } from '@playwright/test';
import { mockLoginAs } from './mock-supabase';

const PAGES: Array<[string,string]> = [
  ['01-vue-generale','/super-admin/'],
  ['02-abonnes','/super-admin/entreprises/'],
  ['03-utilisateurs','/super-admin/managers/'],
  ['04-formules','/super-admin/plans/'],
  ['05-crm','/super-admin/crm/'],
  ['06-finance','/super-admin/paiements/'],
  ['07-support','/super-admin/support/'],
  ['08-integrations','/super-admin/integrations/'],
  ['09-securite','/super-admin/roles/'],
  ['10-journal','/super-admin/audit/'],
  ['11-parametres','/super-admin/parametres/'],
];

const RES: Array<[string,number,number]> = [
  ['desktop-1440',1440,900],
  ['desktop-1280',1280,800],
  ['tablet-768',768,1024],
  ['mobile-390',390,844],
  ['mobile-360',360,800],
];

test.describe('GV5 §58 audit visuel', () => {
  for (const [pname, path] of PAGES) {
    for (const [rname, w, h] of RES) {
      test(`${pname} @ ${rname}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
        await page.setViewportSize({ width: w, height: h });
        await mockLoginAs(page, 'saas_admin');
        await page.goto(path);
        await page.waitForTimeout(1200);
        const diag = await page.evaluate(() => {
          const de = document.documentElement;
          const h1 = document.querySelector('h1');
          const banner = document.querySelector('.ad-page-banner');
          return {
            scrollW: de.scrollWidth, clientW: de.clientWidth,
            overflowX: de.scrollWidth > de.clientWidth + 1,
            h1text: h1?.textContent ?? null,
            h1w: h1 ? Math.round(h1.getBoundingClientRect().width) : 0,
            bannerW: banner ? Math.round(banner.getBoundingClientRect().width) : 0,
            bodyTextLen: (document.body.innerText || '').length,
          };
        });
        const shot = `docs/audits/screenshots-58/${pname}-${rname}.png`;
        await page.screenshot({ path: shot, fullPage: false });
        console.log('AUDIT58', JSON.stringify({ page: pname, res: rname, ...diag, errors: errors.length }));
      });
    }
  }
});

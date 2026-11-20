import { test, expect } from '@playwright/test';

/**
 * Parcours pré-achat — tests E2E (simulation locale / mocks réseau).
 * Aucune intégration réelle, aucun paiement réel, aucune mutation distante réelle.
 * Les requêtes Supabase sont interceptées quand nécessaire.
 */

test.describe('Pré-achat commercial (public)', () => {
  test('page /offres/ présente les offres et un CTA pré-achat', async ({ page }) => {
    // Intercepter plans/features pour un rendu stable (simulation)
    await page.route('https://*.supabase.co/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/plans')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
          { code: 'standard', label: 'STANDARD', description: 'Offre de base', price_monthly: 199, price_yearly: 1990, currency: 'MAD', trial_days: 14, max_users: 3, max_sites: 1, storage_mb: 1024, is_active: true },
          { code: 'silver', label: 'SILVER', description: 'Offre intermédiaire', price_monthly: 399, price_yearly: 3990, currency: 'MAD', trial_days: 14, max_users: 10, max_sites: 3, storage_mb: 5120, is_active: true },
        ]) });
      }
      if (url.includes('/rest/v1/plan_features')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto('/offres/');
    await expect(page.getByRole('heading', { name: /comparer les abonnements|plateforme professionnelle/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /demander un pré-achat|pré-acheter|accéder au formulaire/i }).first()).toBeVisible();
  });

  test('page /pre-achat/ affiche le formulaire et valide les champs requis (client)', async ({ page }) => {
    await page.route('https://*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.goto('/pre-achat/');
    await expect(page.getByRole('heading', { name: /formulaire de pré-achat/i })).toBeVisible();
    await page.getByRole('button', { name: /soumettre la demande/i }).click();
    await expect(page.getByText(/corriger les champs/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('soumission pré-achat simulée réussie (mock REST, aucune écriture réelle)', async ({ page }) => {
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request();
      const url = req.url();
      if (url.includes('/rest/v1/pre_purchase_requests') && req.method() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: 'mock-req-1' }]) });
      }
      if (url.includes('/rest/v1/plans')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
          { code: 'standard', label: 'STANDARD', description: '', price_monthly: 199, price_yearly: 1990, currency: 'MAD', trial_days: 14, max_users: 3, max_sites: 1, storage_mb: 1024, is_active: true },
        ]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/pre-achat/');
    await page.getByLabel(/nom commercial/i).fill('Garage Atlas Test');
    await page.getByLabel(/raison sociale/i).fill('Garage Atlas SARL');
    await page.getByLabel(/métier automobile/i).selectOption({ index: 1 });
    await page.getByLabel(/^Adresse \*/i).fill('12 Rue Test');
    await page.getByLabel(/ville/i).fill('Casablanca');
    await page.getByLabel(/téléphone professionnel/i).fill('+212612345678');
    await page.getByLabel(/e-mail professionnel/i).fill('contact@garage-atlas-test.ma');
    await page.getByLabel(/nom du manager/i).fill('Manager Test');
    await page.getByLabel(/accepte les conditions commerciales/i).check();
    await page.getByLabel(/accepte la politique de confidentialité/i).check();
    await page.getByRole('button', { name: /soumettre la demande/i }).click();
    await expect(page.getByRole('heading', { name: /pré-achat soumis avec succès/i })).toBeVisible({ timeout: 15000 });
  });

  test('affiche un message clair si le service serveur pré-achat est indisponible (simulation d\'absence de table)', async ({ page }) => {
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request();
      const url = req.url();
      if (url.includes('/rest/v1/rpc/submit_pre_purchase_request') && req.method() === 'POST') {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'function public.submit_pre_purchase_request does not exist', code: 'PGRST202' }) });
      }
      if (url.includes('/rest/v1/pre_purchase_requests') && req.method() === 'POST') {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: "relation \"public.pre_purchase_requests\" does not exist" }) });
      }
      if (url.includes('/rest/v1/plans')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/pre-achat/');
    await page.getByLabel(/nom commercial/i).fill('Garage Indispo');
    await page.getByLabel(/raison sociale/i).fill('Garage Indispo SARL');
    await page.getByLabel(/métier automobile/i).selectOption({ index: 1 });
    await page.getByLabel(/^Adresse \*/i).fill('Rue A');
    await page.getByLabel(/ville/i).fill('Rabat');
    await page.getByLabel(/téléphone professionnel/i).fill('+212612345679');
    await page.getByLabel(/e-mail professionnel/i).fill('indispo@test.ma');
    await page.getByLabel(/nom du manager/i).fill('Manager X');
    await page.getByLabel(/accepte les conditions commerciales/i).check();
    await page.getByLabel(/accepte la politique de confidentialité/i).check();
    await page.getByRole('button', { name: /soumettre la demande/i }).click();
    await expect(page.getByText(/n'est pas encore disponible côté serveur|n'a pas été enregistrée/i)).toBeVisible({ timeout: 15000 });
  });
});

import { test, expect } from '@playwright/test';
import { installSupabaseMocks, mockLoginAs } from './mock-supabase';

/**
 * Scénarios Super Admin — SIMULATIONS LOCALES AVEC MOCKS RÉSEAU.
 * Aucune requête réelle Supabase, aucune mutation distante, aucune donnée de production.
 */

test.describe('Connexion (simulée, mocks)', () => {
  test('refuse des identifiants invalides (mock)', async ({ page }) => {
    await installSupabaseMocks(page, { loginOk: false });
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill('bad@test.local');
    await page.getByPlaceholder(/mot de passe/i).fill('password123');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page.getByText(/incorrect|invalide|erreur/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('valide les champs requis côté client', async ({ page }) => {
    await installSupabaseMocks(page, { loginOk: true });
    await page.goto('/connexion/');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page.getByText(/email|identifiant|mot de passe/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('refuse un profil non saas_admin (mock manager)', async ({ page }) => {
    await installSupabaseMocks(page, { loginOk: true, profileRole: 'manager' });
    await page.goto('/connexion/');
    await page.getByPlaceholder(/email/i).fill('mgr@test.local');
    await page.getByPlaceholder(/mot de passe/i).fill('password123');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();
    await expect(page).not.toHaveURL(/\/super-admin\/?$/, { timeout: 10000 });
  });

  test('connexion Super Admin simulée redirige vers /super-admin (mock)', async ({ page }) => {
    await mockLoginAs(page, 'saas_admin');
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 15000 });
  });
});

test.describe('Accès Super Admin (simulé, mocks)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockLoginAs(page, 'saas_admin');
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 15000 });
  });

  const modules: Array<[string, string]> = [
    ['Dashboard', '/super-admin/'],
    ['Entreprises', '/super-admin/entreprises/'],
    ['Managers', '/super-admin/managers/'],
    ['Garages', '/super-admin/garages/'],
    ['Plans', '/super-admin/plans/'],
    ['Abonnements', '/super-admin/abonnements/'],
    ['CRM', '/super-admin/crm/'],
    ['Paiements', '/super-admin/paiements/'],
    ['Support', '/super-admin/support/'],
    ['Rapports', '/super-admin/rapports/'],
    ['Sauvegarde', '/super-admin/sauvegarde/'],
    ['Audit', '/super-admin/audit/'],
    ['Rôles', '/super-admin/roles/'],
    ['Paramètres', '/super-admin/parametres/'],
    ['WhatsApp', '/super-admin/whatsapp/'],
    ['Chatbot', '/super-admin/chatbot/'],
    ['Onboarding', '/super-admin/onboarding/'],
    ['Pré-achats', '/super-admin/pre-achats/'],
  ];

  for (const [name, path] of modules) {
    test(`navigation module ${name} (${path}) se charge sans crash (mock)`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('main, [role="main"], .carte, h1, h2').first()).toBeVisible({ timeout: 10000 });
    });
  }

  test('recherche/filtres UI présents sur certains modules (mock)', async ({ page }) => {
    await page.goto('/super-admin/entreprises/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('input[type="search"], input[placeholder*="Recherch"], [role="searchbox"]').first()).toBeVisible({ timeout: 15000 });
    await page.goto('/super-admin/support/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('déconnexion simulée depuis desktop (mock)', async ({ page }) => {
    const logout = page.getByRole('button', { name: /déconnexion/i }).first();
    await expect(logout).toBeVisible({ timeout: 10000 });
    await logout.click();
    await expect(page).toHaveURL(/connexion/, { timeout: 10000 });
  });
});

test.describe('Onboarding (simulation, mocks)', () => {
  test('formulaire onboarding affiche les étapes/champs (mock SA)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockLoginAs(page, 'saas_admin');
    await page.goto('/super-admin/onboarding/');
    await expect(page.locator('form, input, select').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Responsive (simulation, mocks)', () => {
  test('connexion mobile affiche le formulaire', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/connexion/');
    await expect(page.locator('form')).toBeVisible();
  });

  test('module SA en mobile se rend (mock)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockLoginAs(page, 'saas_admin');
    await page.goto('/super-admin/rapports/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('menu mobile peut s’ouvrir (mock)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockLoginAs(page, 'saas_admin');
    await page.goto('/super-admin/');
    const menuBtn = page.getByRole('button', { name: /ouvrir le menu/i });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await expect(page.getByRole('dialog', { name: /menu super admin/i })).toBeVisible({ timeout: 5000 });
    }
  });
});

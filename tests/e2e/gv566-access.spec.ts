import { test, expect } from '@playwright/test';
import { mockLoginAs } from './mock-supabase';

test.describe('GV5 §66 — acces directs WhatsApp / Chatbot', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockLoginAs(page, 'saas_admin');
  });

  test('sidebar contient WhatsApp Business et Chatbot IA une seule fois', async ({ page }) => {
    await page.goto('/super-admin/');
    await expect(page.getByRole('link', { name: 'WhatsApp Business' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Chatbot IA' })).toHaveCount(1);
  });

  test('dashboard affiche les cartes d acces direct avec etat honnete', async ({ page }) => {
    await page.goto('/super-admin/');
    await expect(page.getByText('Non configure', { exact: true })).toBeVisible();
  });

  test('navigation WhatsApp Business fonctionne', async ({ page }) => {
    await page.goto('/super-admin/');
    await page.getByRole('link', { name: 'WhatsApp Business' }).first().click();
    await expect(page).toHaveURL(/\/super-admin\/whatsapp/);
  });

  test('navigation Chatbot IA fonctionne', async ({ page }) => {
    await page.goto('/super-admin/');
    await page.getByRole('link', { name: 'Chatbot IA' }).first().click();
    await expect(page).toHaveURL(/\/super-admin\/chatbot/);
  });

  test('acces directs visibles en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/super-admin/');
    await expect(page.getByRole('link', { name: 'WhatsApp Business' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Chatbot IA' })).toHaveCount(1);
  });
});

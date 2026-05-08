import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Ces tests utilisent une page non-authentifiée — on ignore le storageState global
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentification', () => {
  test('redirige vers /login si non connecté', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('affiche le formulaire de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('affiche une erreur avec des identifiants invalides', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'mauvais@email.com');
    await page.fill('#password', 'mauvais_mot_de_passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.locator('.alert-error')).toBeVisible({ timeout: 8_000 });
  });

  test('login valide redirige vers le dashboard', async ({ page }) => {
    const email = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@pneuma.pos';
    const password = process.env['E2E_ADMIN_PASSWORD'] ?? '';

    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Redirige vers dashboard ou change-password selon must_change_password
    await expect(page).toHaveURL(/\/(dashboard|change-password)/, { timeout: 10_000 });
  });
});

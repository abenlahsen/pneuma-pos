import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER_NAME  = 'USER_E2E_TEST';
const TEST_USER_EMAIL = 'e2e_user_test@pneuma.pos';
const TEST_USER_PASS  = 'Password123!';
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://nginx:80';

function getStoredToken(): string | null {
  try {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const origin = state.origins?.find((o: { origin: string }) => o.origin === BASE_URL);
    const item = origin?.localStorage?.find((i: { name: string }) => i.name === 'auth_token');
    return item?.value ?? null;
  } catch { return null; }
}

test.describe.serial('Gestion des Utilisateurs', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get(`/api/users?search=${encodeURIComponent(TEST_USER_EMAIL)}&per_page=100`, { headers });
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; email: string }[] };
    for (const u of data.data) {
      if (u.email === TEST_USER_EMAIL) {
        await request.delete(`/api/users/${u.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Gestion des Utilisateurs');
  });

  // ── Lecture : admin seedé ─────────────────────────────────────────────────

  test('l\'admin seedé "Admin POS" apparaît dans la liste', async ({ page }) => {
    await expect(page.locator('tbody td', { hasText: 'Admin POS' })).toBeVisible();
    await expect(page.locator('tbody td', { hasText: 'admin@pneuma.pos' })).toBeVisible();
  });

  test('l\'admin a le rôle "Administrator"', async ({ page }) => {
    const adminRow = page.locator('tbody tr', { hasText: 'admin@pneuma.pos' });
    await expect(adminRow.locator('.role-badge', { hasText: 'Administrator' })).toBeVisible();
  });

  test('rechercher "Admin" filtre la liste', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou email..."]', 'Admin');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: 'Admin POS' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un utilisateur avec le rôle Commercial', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel Utilisateur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouvel Utilisateur');

    await page.fill('input[placeholder="Nom complet"]', TEST_USER_NAME);
    await page.fill('input[placeholder="email@example.com"]', TEST_USER_EMAIL);
    await page.fill('input[placeholder="••••••"]', TEST_USER_PASS);
    // Le champ confirmation apparaît après saisie du mot de passe (*ngIf="formPassword()")
    const confirmInput = page.locator('input[placeholder="••••••"]').nth(1);
    await expect(confirmInput).toBeVisible({ timeout: 5_000 });
    await confirmInput.fill(TEST_USER_PASS);

    // Sélectionner le rôle Commercial
    await page.locator('.modal-container').locator('select').last().selectOption({ label: 'Commercial' });

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).toBeVisible();
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher l\'utilisateur créé par email', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou email..."]', TEST_USER_EMAIL);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).toBeVisible();
    await expect(page.locator('tbody td', { hasText: 'Commercial' }).first()).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer l\'utilisateur de test', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom ou email..."]', TEST_USER_EMAIL);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/users') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/users') && r.request().method() === 'DELETE'),
      page.locator('tbody tr', { hasText: TEST_USER_EMAIL }).locator('button[title="Supprimer"]').click(),
    ]);

    // Re-search to get definitive fresh list
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/users') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).not.toBeVisible({ timeout: 10_000 });
  });
});

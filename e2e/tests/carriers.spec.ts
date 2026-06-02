import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_CARRIER     = 'TRANSPORTEUR_E2E_TEST';
const TEST_CARRIER_UPD = 'TRANSPORTEUR_E2E_TEST_MAJ';
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

test.describe.serial('Transporteurs', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get('/api/carriers?per_page=500', { headers });
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; name: string }[] };
    for (const c of data.data) {
      if (c.name === TEST_CARRIER || c.name === TEST_CARRIER_UPD) {
        await request.delete(`/api/carriers/${c.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/carriers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Transporteurs');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche le tableau des transporteurs ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun transporteur trouvé.")');
    await expect(table.or(emptyState).first()).toBeVisible();
  });

  test('le bouton "Nouveau Transporteur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Transporteur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau transporteur', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Transporteur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Transporteur');

    await page.fill('input[name="name"]', TEST_CARRIER);
    await page.fill('input[name="phone"]', '0522111111');
    await page.fill('input[name="email"]', 'e2e@transporteur.test');

    // Pre-register GET listener before submit so we don't miss the auto-refresh
    const refreshPromise = page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() !== 'GET'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);
    await refreshPromise;
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tbody td.fw-semibold', { hasText: TEST_CARRIER }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le transporteur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td.fw-semibold', { hasText: TEST_CARRIER }).first()).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le transporteur créé', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    await page.locator('tbody tr', { hasText: TEST_CARRIER })
      .locator('button[title="Modifier"]')
      .click();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Transporteur');

    await page.fill('input[name="name"]', TEST_CARRIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() !== 'GET'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);

    // Re-search to get definitive fresh list
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('tbody td', { hasText: TEST_CARRIER_UPD })).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le transporteur de test', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'DELETE'),
      page.locator('tbody tr', { hasText: TEST_CARRIER_UPD }).locator('button[title="Supprimer"]').click(),
    ]);

    // Re-search to get definitive fresh list
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('tbody td', { hasText: TEST_CARRIER_UPD })).not.toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_BRAND = 'MARQUE_E2E_TEST';
const TEST_BRAND_UPDATED = 'MARQUE_E2E_TEST_MAJ';
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

test.describe.serial('Marques', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    for (const name of [TEST_BRAND, TEST_BRAND_UPDATED]) {
      const res = await request.get(`/api/brands?search=${encodeURIComponent(name)}&per_page=100`, { headers });
      if (!res.ok()) continue;
      const data = await res.json() as { data: { id: number; name: string }[] };
      for (const b of data.data) {
        if (b.name === name) {
          await request.delete(`/api/brands/${b.id}`, { headers });
        }
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/brands', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Marques', { timeout: 15_000 });
    // Ensure initial loadBrands() GET completes before test body — prevents it from
    // racing with search GETs and overwriting results.
    await expect(page.locator('tbody')).not.toContainText('Chargement', { timeout: 15_000 });
  });

  // ── Lecture : données seedées ────────────────────────────────────────────

  test('affiche les marques seedées (MICHELIN, GOODYEAR, CONTINENTAL)', async ({ page }) => {
    // Vérifier que des lignes existent
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows).not.toHaveCount(0);
    // Rechercher MICHELIN (peut être en page 2+ selon le nb de marques)
    await page.fill('input[placeholder="Nom de la marque..."]', 'MICHELIN');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td .fw-semibold', { hasText: 'MICHELIN' }).first()).toBeVisible();
    // Réinitialiser pour ne pas affecter le beforeEach du test suivant
    await page.click('button[title="Réinitialiser"]');
    await page.waitForLoadState('networkidle');
  });

  test('rechercher "MICHELIN" retourne exactement 1 résultat', async ({ page }) => {
    await page.fill('input[placeholder="Nom de la marque..."]', 'MICHELIN');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.url().includes('search') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows).toHaveCount(1);
    await expect(page.locator('td .fw-semibold')).toContainText('MICHELIN');
  });

  test('réinitialiser les filtres restaure la liste complète', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom de la marque..."]', 'XXXXXXNOTFOUND');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('td:has-text("Aucune marque trouvée.")')).toBeVisible();

    await page.click('button[title="Réinitialiser"]');
    await expect(page.locator('td:has-text("Aucune marque trouvée.")')).not.toBeVisible({ timeout: 15_000 });
  });

  // ── Création ─────────────────────────────────────────────────────────────

  test('créer une nouvelle marque', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouvelle Marque' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();

    await page.fill('input[name="name"]', TEST_BRAND);
    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'POST'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);
    expect(postResp.status(), `POST /api/brands returned ${postResp.status()}`).toBeLessThan(400);

    // Reload for a clean list — bypasses Angular CD timing issues after creation
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Marques', { timeout: 15_000 });
    await expect(page.locator('tbody')).not.toContainText('Chargement', { timeout: 15_000 });
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.url().includes('search') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND })).toBeVisible({ timeout: 10_000 });
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier la marque créée', async ({ page }) => {
    // Chercher la marque de test
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Cliquer sur le bouton Modifier de la ligne
    await page.locator('tr', { hasText: TEST_BRAND }).locator('button[title="Modifier"]').click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier');

    // Changer le nom
    await page.fill('input[name="name"]', TEST_BRAND_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'POST'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);
    await page.waitForLoadState('networkidle');

    // Vérifier le nouveau nom
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND_UPDATED);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND_UPDATED })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer la marque de test', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND_UPDATED })).toBeVisible({ timeout: 5_000 });

    // Confirmer la boite de dialogue native (window.confirm)
    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'DELETE'),
      page.locator('tr', { hasText: TEST_BRAND_UPDATED }).locator('button[title="Supprimer"]').click(),
    ]);

    // Re-search to get a definitive fresh list (avoids race with the component's auto-refresh GET)
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND_UPDATED })).not.toBeVisible({ timeout: 10_000 });
  });
});

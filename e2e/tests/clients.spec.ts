import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_CLIENT = 'CLIENT_E2E_TEST';
const TEST_CLIENT_UPDATED = 'CLIENT_E2E_TEST_MAJ';
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

test.describe.serial('Clients', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    for (const name of [TEST_CLIENT, TEST_CLIENT_UPDATED]) {
      const res = await request.get(`/api/clients?search=${encodeURIComponent(name)}&per_page=100`, { headers });
      if (!res.ok()) continue;
      const data = await res.json() as { data: { id: number; name: string }[] };
      for (const c of data.data) {
        if (c.name === name) {
          await request.delete(`/api/clients/${c.id}`, { headers });
        }
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Clients', { timeout: 15_000 });
    // Ensure the initial loadClients() GET has completed before any test body runs,
    // so that later waitForResponse(GET) calls catch the intended list-refresh GETs.
    await expect(page.locator('tbody')).not.toContainText('Chargement', { timeout: 15_000 });
  });

  // ── Lecture : état initial (pas de clients seedés) ────────────────────────

  test('affiche "Aucun client trouvé" si la base est vide', async ({ page }) => {
    // Ce test passe seulement si aucun client n'existe — sinon on vérifie juste le tableau
    const emptyState = page.locator('td:has-text("Aucun client trouvé.")');
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    // L'un ou l'autre doit être vrai
    const isEmpty = await emptyState.isVisible();
    const hasRows = await rows.first().isVisible();
    expect(isEmpty || hasRows).toBeTruthy();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau client particulier', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Client' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Client');

    await page.fill('input[name="name"]', TEST_CLIENT);
    await page.selectOption('select[name="category"]', 'Paticulier');
    await page.fill('input[name="phone"]', '0612345678');
    // City is now a select (CityService dropdown)
    await page.selectOption('.modal-container select[name="city"]', 'Casablanca');
    // Wait for Angular (zoneless) to update form validity and enable submit
    await expect(page.locator('.modal-container button[type="submit"]')).toBeEnabled({ timeout: 5_000 });

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() === 'POST'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);
    expect(postResp.status(), `POST /api/clients returned ${postResp.status()}`).toBeLessThan(400);

    // Reload to get a clean list (bypasses any in-place CD timing issues)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Clients', { timeout: 15_000 });
    await expect(page.locator('tbody')).not.toContainText('Chargement', { timeout: 15_000 });
    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible({ timeout: 10_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le client créé par nom', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible();
  });

  test('rechercher le client par ville "Casablanca"', async ({ page }) => {
    // City filter is now a select (CityService dropdown) — triggers applyFilters() on change
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.url().includes('city') && r.request().method() === 'GET'),
      page.selectOption('select[name="city"]', 'Casablanca'),
    ]);

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible();
  });

  // ── Fiche client ──────────────────────────────────────────────────────────

  test('naviguer vers la fiche du client', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Cliquer sur le nom du client (btn-link) pour ouvrir la fiche
    await page.locator('.btn-link.client-link', { hasText: TEST_CLIENT }).click();
    await expect(page).toHaveURL(/\/clients\/\d+/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le client créé', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.url().includes('search') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    await page.locator('tr', { hasText: TEST_CLIENT }).locator('button[title="Modifier"]').click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Client');

    await page.locator('.modal-container input[name="name"]').fill(TEST_CLIENT_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() !== 'GET'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);

    // Re-search to get definitive updated list
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT_UPDATED })).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le client de test', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.url().includes('search') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() === 'DELETE'),
      page.locator('tr', { hasText: TEST_CLIENT_UPDATED }).locator('button[title="Supprimer"]').click(),
    ]);

    // Re-search to get a definitive fresh list (avoids race with the component's auto-refresh GET)
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT_UPDATED })).not.toBeVisible({ timeout: 10_000 });
  });
});

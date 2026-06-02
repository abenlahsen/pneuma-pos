import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_SUPPLIER      = 'FOURNISSEUR_E2E_TEST';
const TEST_SUPPLIER_UPD  = 'FOURNISSEUR_E2E_TEST_MAJ';
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

test.describe.serial('Fournisseurs', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get('/api/suppliers?per_page=500', { headers });
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; name: string }[] };
    for (const s of data.data) {
      if (s.name === TEST_SUPPLIER || s.name === TEST_SUPPLIER_UPD) {
        await request.delete(`/api/suppliers/${s.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Annuaire Fournisseurs');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche le tableau des fournisseurs ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun fournisseur trouvé.")');
    await expect(table.or(emptyState).first()).toBeVisible();
  });

  test('le bouton "Nouveau Fournisseur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Fournisseur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau fournisseur', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Fournisseur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Fournisseur');

    await page.fill('input[name="name"]', TEST_SUPPLIER);
    await page.fill('input[name="contact_person"]', 'Mohamed E2E');
    await page.fill('input[name="phone"]', '0522000000');
    await page.fill('#supplier-email', 'e2e@fournisseur.test');

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() === 'POST'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le fournisseur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom, contact ou email..."]', TEST_SUPPLIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER }).first()).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le fournisseur créé', async ({ page }) => {
    test.setTimeout(60_000);

    await page.fill('input[placeholder="Nom, contact ou email..."]', TEST_SUPPLIER);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);

    await page.locator('tbody tr', { hasText: TEST_SUPPLIER })
      .locator('button[title="Modifier"]')
      .click();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Fournisseur');

    await page.fill('input[name="name"]', TEST_SUPPLIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() !== 'GET'),
      page.click('button[type="submit"]:has-text("Enregistrer")'),
    ]);

    // Re-search to get definitive fresh list
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() === 'GET'),
      page.click('button[title="Rechercher"]'),
    ]);
    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER_UPD }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le fournisseur de test', async ({ page }) => {
    await page.fill('input[placeholder="Nom, contact ou email..."]', TEST_SUPPLIER_UPD);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tbody tr', { hasText: TEST_SUPPLIER_UPD })
      .locator('button[title="Supprimer"]')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER_UPD })).not.toBeVisible();
  });
});

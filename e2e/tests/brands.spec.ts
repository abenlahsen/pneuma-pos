import { test, expect, Page } from '@playwright/test';
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

/**
 * Marques — refonte 2b, étape 11. Motif de ligne au lieu d'un tableau, la
 * barre de recherche du mixin (Entrée lance la recherche), le formulaire dans
 * la modale de référentiel 15b, activer et supprimer derrière le menu ⋯, la
 * suppression dans la confirmation 15c.
 */
const SEARCH = 'Nom de la marque…';

/** Les vraies lignes — les squelettes n'ont pas de nom. */
const brandRows = (page: Page) => page.locator('.brands-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });

const brandRow = (page: Page, name: string) =>
  brandRows(page).filter({ has: page.locator('.list-grid-name', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });

/** Recherche une marque et attend la réponse. */
async function searchBrand(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder(SEARCH).fill(name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'GET'),
    page.getByPlaceholder(SEARCH).press('Enter'),
  ]);
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
    await expect(brandRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  // ── Lecture : données seedées ────────────────────────────────────────────

  test('affiche les marques seedées (MICHELIN, GOODYEAR, CONTINENTAL)', async ({ page }) => {
    await expect(brandRows(page)).not.toHaveCount(0);
    await expect(page.locator('.filter-result-count')).toContainText(/\d+ marque\(s\)/);
    for (const name of ['MICHELIN', 'GOODYEAR', 'CONTINENTAL']) {
      await searchBrand(page, name);
      await expect(brandRow(page, name)).toBeVisible();
    }
  });

  test('rechercher "MICHELIN" retourne exactement 1 résultat', async ({ page }) => {
    await searchBrand(page, 'MICHELIN');
    await expect(brandRows(page)).toHaveCount(1);
    await expect(brandRows(page).first().locator('.list-grid-name')).toHaveText(/MICHELIN/);
  });

  test('une recherche sans résultat, puis « Tout effacer », restaure la liste', async ({ page }) => {
    test.setTimeout(60_000);

    await searchBrand(page, 'XXXXXXNOTFOUND');
    const empty = page.locator('app-list-empty');
    await expect(empty).toContainText('Aucune marque ne correspond');

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'GET'),
      empty.getByRole('button', { name: 'Tout effacer' }).click(),
    ]);
    await expect(empty).toHaveCount(0);
    await expect(brandRows(page)).not.toHaveCount(0);
  });

  // ── Création ─────────────────────────────────────────────────────────────

  test('créer une nouvelle marque', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouvelle Marque' }).click();
    const modal = page.getByRole('dialog', { name: 'Nouvelle marque' });
    await expect(modal).toBeVisible();

    await modal.locator('input[name="name"]').fill(TEST_BRAND);
    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Enregistrer' }).click(),
    ]);
    expect(postResp.status(), `POST /api/brands returned ${postResp.status()}`).toBeLessThan(400);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await searchBrand(page, TEST_BRAND);
    await expect(brandRow(page, TEST_BRAND)).toBeVisible({ timeout: 10_000 });
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier la marque créée', async ({ page }) => {
    await searchBrand(page, TEST_BRAND);
    await brandRow(page, TEST_BRAND).locator('button[title="Modifier"]').click();

    const modal = page.getByRole('dialog', { name: `Modifier ${TEST_BRAND}` });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="name"]').fill(TEST_BRAND_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands/') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Enregistrer' }).click(),
    ]);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await searchBrand(page, TEST_BRAND_UPDATED);
    await expect(brandRow(page, TEST_BRAND_UPDATED)).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer la marque de test', async ({ page }) => {
    test.setTimeout(60_000);

    await searchBrand(page, TEST_BRAND_UPDATED);
    const row = brandRow(page, TEST_BRAND_UPDATED);
    await expect(row).toBeVisible();

    // Le menu ⋯ (gabarit 14a) n'existe que sous le seuil de réduction ; au-dessus,
    // ses actions sont en ligne. Puis la confirmation 15c.
    const more = row.getByRole('button', { name: 'Autres actions' });
    if (await more.isVisible()) await more.click();
    await row.locator('button[title="Supprimer"]').click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_BRAND_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/brands/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await searchBrand(page, TEST_BRAND_UPDATED);
    await expect(brandRow(page, TEST_BRAND_UPDATED)).toHaveCount(0, { timeout: 10_000 });
  });
});

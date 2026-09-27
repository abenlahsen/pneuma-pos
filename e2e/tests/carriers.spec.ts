import { test, expect, Page } from '@playwright/test';
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

/**
 * Transporteurs — refonte 2b, étape 11. Motif de ligne au lieu d'un tableau,
 * la barre de recherche du mixin (Entrée lance la recherche), le formulaire
 * dans la modale de référentiel 15b, la suppression dans la confirmation 15c.
 */
const SEARCH = 'Nom ou téléphone…';

/** Les vraies lignes — les squelettes n'ont pas de nom. */
const carrierRows = (page: Page) => page.locator('.carriers-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });

const carrierRow = (page: Page, name: string) =>
  carrierRows(page).filter({ has: page.locator('.list-grid-name', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });

/** Recherche un transporteur et attend la réponse. */
async function searchCarrier(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder(SEARCH).fill(name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'GET'),
    page.getByPlaceholder(SEARCH).press('Enter'),
  ]);
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
    await expect(page.locator('h1')).toContainText('Transporteurs', { timeout: 15_000 });
    await expect(carrierRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche les transporteurs ou un état vide', async ({ page }) => {
    await expect(carrierRows(page).first().or(page.locator('app-list-empty'))).toBeVisible();
  });

  test('le bouton "Nouveau Transporteur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Transporteur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau transporteur', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Transporteur' }).click();
    const modal = page.getByRole('dialog', { name: 'Nouveau transporteur' });
    await expect(modal).toBeVisible();

    await modal.locator('input[name="name"]').fill(TEST_CARRIER);
    await modal.locator('input[name="phone"]').fill('0522111111');
    await modal.locator('input[name="email"]').fill('e2e@transporteur.test');

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Enregistrer' }).click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await searchCarrier(page, TEST_CARRIER);
    await expect(carrierRow(page, TEST_CARRIER)).toBeVisible({ timeout: 10_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le transporteur créé, par son nom puis son téléphone', async ({ page }) => {
    await searchCarrier(page, TEST_CARRIER);
    await expect(carrierRow(page, TEST_CARRIER)).toBeVisible();

    await searchCarrier(page, '0522111111');
    await expect(carrierRow(page, TEST_CARRIER)).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le transporteur créé', async ({ page }) => {
    test.setTimeout(60_000);

    await searchCarrier(page, TEST_CARRIER);
    await carrierRow(page, TEST_CARRIER).locator('button[title="Modifier"]').click();

    const modal = page.getByRole('dialog', { name: `Modifier ${TEST_CARRIER}` });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="name"]').fill(TEST_CARRIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers/') && r.request().method() === 'PUT'),
      modal.getByRole('button', { name: 'Enregistrer' }).click(),
    ]);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await searchCarrier(page, TEST_CARRIER_UPD);
    await expect(carrierRow(page, TEST_CARRIER_UPD)).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le transporteur de test', async ({ page }) => {
    test.setTimeout(60_000);

    await searchCarrier(page, TEST_CARRIER_UPD);
    await carrierRow(page, TEST_CARRIER_UPD).locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_CARRIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/carriers/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await searchCarrier(page, TEST_CARRIER_UPD);
    await expect(carrierRow(page, TEST_CARRIER_UPD)).toHaveCount(0, { timeout: 10_000 });
  });
});

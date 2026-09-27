import { test, expect, Page } from '@playwright/test';
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

/**
 * Clients — refonte 2b. Motif de ligne au lieu d'un tableau (le nom est un
 * lien vers la fiche), la saisie dans un éditeur routé (/clients/new,
 * /clients/:id/edit) qui ramène sur la fiche, la suppression dans la
 * confirmation 15c.
 */
const SEARCH = 'Nom, téléphone, ville ou email...';

/** Les vraies lignes — les squelettes n'ont pas de lien. */
const clientRows = (page: Page) => page.locator('.clients-grid.list-grid-row').filter({ has: page.locator('.list-grid-name a') });

const clientRow = (page: Page, name: string) =>
  clientRows(page).filter({ has: page.getByRole('link', { name, exact: true }) });

/** Recherche un client et attend la réponse. */
async function searchClient(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder(SEARCH).fill(name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/clients') && r.url().includes('search=') && r.request().method() === 'GET'),
    page.getByPlaceholder(SEARCH).press('Enter'),
  ]);
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
    // Le chargement initial d'abord : les recherches suivantes attendent leur propre réponse.
    await expect(clientRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche les clients ou un état vide', async ({ page }) => {
    await expect(clientRows(page).first().or(page.locator('app-list-empty'))).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau client particulier', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Client' }).click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator('.cf-title')).toHaveText('Nouveau client', { timeout: 15_000 });

    await page.fill('input[name="name"]', TEST_CLIENT);
    await page.selectOption('select[name="category"]', 'Particulier');
    await page.fill('input[name="phone"]', '0612345678');
    await page.selectOption('select[name="city"]', 'Casablanca');
    const create = page.getByRole('button', { name: 'Créer le client' });
    await expect(create).toBeEnabled({ timeout: 5_000 });

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.request().method() === 'POST'),
      create.click(),
    ]);
    expect(postResp.status(), `POST /api/clients returned ${postResp.status()}`).toBeLessThan(400);

    // La création ramène sur la fiche neuve.
    await expect(page).toHaveURL(/\/clients\/\d+$/, { timeout: 10_000 });
    await expect(page.locator('.cd-name')).toHaveText(TEST_CLIENT, { timeout: 15_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le client créé par nom', async ({ page }) => {
    await searchClient(page, TEST_CLIENT);
    await expect(clientRow(page, TEST_CLIENT)).toBeVisible();
  });

  test('rechercher le client par ville "Casablanca"', async ({ page }) => {
    // La ville est une liste (CityService) : la changer relance la recherche.
    await page.getByPlaceholder(SEARCH).fill(TEST_CLIENT);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients') && r.url().includes('city=') && r.request().method() === 'GET'),
      page.selectOption('.filters-section select[name="city"]', 'Casablanca'),
    ]);
    await expect(clientRow(page, TEST_CLIENT)).toBeVisible();
  });

  // ── Fiche client ──────────────────────────────────────────────────────────

  test('naviguer vers la fiche du client', async ({ page }) => {
    await searchClient(page, TEST_CLIENT);
    await clientRow(page, TEST_CLIENT).getByRole('link', { name: TEST_CLIENT, exact: true }).click();
    await expect(page).toHaveURL(/\/clients\/\d+$/);
    await expect(page.locator('.cd-name')).toHaveText(TEST_CLIENT, { timeout: 15_000 });
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le client créé', async ({ page }) => {
    test.setTimeout(60_000);

    await searchClient(page, TEST_CLIENT);
    await clientRow(page, TEST_CLIENT).locator('button[title="Modifier"]').click();
    await expect(page).toHaveURL(/\/clients\/\d+\/edit$/);
    await expect(page.locator('.cf-title')).toHaveText(`Modifier ${TEST_CLIENT}`, { timeout: 15_000 });

    await page.fill('input[name="name"]', TEST_CLIENT_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients/') && r.request().method() !== 'GET'),
      page.getByRole('button', { name: 'Mettre à jour' }).click(),
    ]);

    // L'éditeur ramène sur la fiche ; l'annuaire doit montrer le nouveau nom.
    await expect(page.locator('.cd-name')).toHaveText(TEST_CLIENT_UPDATED, { timeout: 15_000 });
    await page.goto('/clients', { waitUntil: 'domcontentloaded' });
    await expect(clientRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
    await searchClient(page, TEST_CLIENT_UPDATED);
    await expect(clientRow(page, TEST_CLIENT_UPDATED)).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le client de test', async ({ page }) => {
    test.setTimeout(60_000);

    await searchClient(page, TEST_CLIENT_UPDATED);
    await clientRow(page, TEST_CLIENT_UPDATED).locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_CLIENT_UPDATED);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/clients/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await searchClient(page, TEST_CLIENT_UPDATED);
    await expect(clientRow(page, TEST_CLIENT_UPDATED)).toHaveCount(0, { timeout: 10_000 });
  });
});

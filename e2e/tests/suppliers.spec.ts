import { test, expect, Page } from '@playwright/test';
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

/**
 * Refonte 2b : l'annuaire passe au motif de ligne (`.list-grid-row`), la
 * saisie à un écran routé (/suppliers/new, /suppliers/:id/edit, étape 8) qui
 * ramène sur la fiche, et la suppression à la confirmation partagée 15c.
 */
const SEARCH = 'input[placeholder="Nom, contact ou email..."]';

/** La ligne d'annuaire d'un fournisseur, par son nom. */
const supplierRow = (page: Page, name: string) =>
  page.locator('.suppliers-grid.list-grid-row').filter({ has: page.getByRole('button', { name, exact: true }) });

/** Recherche dans l'annuaire et attend la réponse. */
async function searchSupplier(page: Page, name: string): Promise<void> {
  await page.fill(SEARCH, name);
  // Entrée plutôt que la loupe : sous la table des impayés, la loupe tombe
  // au ras de la fenêtre, où la barre du bas la recouvre.
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/suppliers') && r.url().includes('search=') && r.request().method() === 'GET'),
    page.press(SEARCH, 'Enter'),
  ]);
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

  test('affiche l\'annuaire des fournisseurs ou un état vide', async ({ page }) => {
    const rows = page.locator('.suppliers-grid.list-grid-row').filter({ has: page.locator('.list-grid-name button') });
    await expect(rows.first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  test('le bouton "Nouveau Fournisseur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Fournisseur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau fournisseur', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: 'Nouveau Fournisseur' }).click();
    await expect(page).toHaveURL(/\/suppliers\/new$/);
    await expect(page.locator('.sf-title')).toHaveText('Nouveau fournisseur');

    await page.fill('input[name="name"]', TEST_SUPPLIER);
    await page.fill('input[name="contact_person"]', 'Mohamed E2E');
    await page.fill('input[name="phone"]', '0522000000');
    await page.fill('#supplier-email', 'e2e@fournisseur.test');

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Créer le fournisseur' }).click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    // La création ramène sur la fiche neuve.
    await expect(page).toHaveURL(/\/suppliers\/\d+$/, { timeout: 10_000 });
    await expect(page.getByText(TEST_SUPPLIER).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le fournisseur créé', async ({ page }) => {
    await searchSupplier(page, TEST_SUPPLIER);
    await expect(supplierRow(page, TEST_SUPPLIER)).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le fournisseur créé', async ({ page }) => {
    test.setTimeout(60_000);

    await searchSupplier(page, TEST_SUPPLIER);
    await supplierRow(page, TEST_SUPPLIER).locator('button[title="Modifier"]').click();
    await expect(page).toHaveURL(/\/suppliers\/\d+\/edit$/);
    await expect(page.locator('.sf-title')).toHaveText(`Modifier ${TEST_SUPPLIER}`);

    await page.fill('input[name="name"]', TEST_SUPPLIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Mettre à jour' }).click(),
    ]);

    // L'éditeur ramène sur la fiche ; l'annuaire doit montrer le nouveau nom.
    await expect(page).toHaveURL(/\/suppliers\/\d+$/, { timeout: 10_000 });
    await page.goto('/suppliers');
    await searchSupplier(page, TEST_SUPPLIER_UPD);
    await expect(supplierRow(page, TEST_SUPPLIER_UPD)).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le fournisseur de test', async ({ page }) => {
    await searchSupplier(page, TEST_SUPPLIER_UPD);
    await supplierRow(page, TEST_SUPPLIER_UPD).locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_SUPPLIER_UPD);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/suppliers/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await expect(supplierRow(page, TEST_SUPPLIER_UPD)).toHaveCount(0, { timeout: 10_000 });
  });
});

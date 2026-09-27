import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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
 * Rôles — refonte 2b. Motif de ligne au lieu d'un tableau (le nombre de
 * permissions en sous-ligne, les modules en colonne), le rôle système
 * verrouillé, le formulaire de rôle en éditeur 15a, la suppression dans la
 * confirmation 15c.
 */
const SEEDED_ROLES = ['Administrator', 'Manager', 'Commercial', 'Driver'];
const TEST_ROLE = 'ROLE_E2E_TEST';

/** Les vraies lignes — les squelettes n'ont pas de nom. */
const roleRows = (page: Page) => page.locator('.roles-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });
const roleRow = (page: Page, name: string) =>
  roleRows(page).filter({ has: page.locator('.list-grid-name', { hasText: new RegExp(`^\\s*${name}(\\s*SYSTÈME)?\\s*$`) }) });

test.describe.serial('Gestion des Rôles', () => {
  // Un rôle de test resté d'un passage interrompu : on le supprime.
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const res = await request.get('/api/roles', { headers });
    if (!res.ok()) return;
    const body = await res.json();
    const roles = (Array.isArray(body) ? body : body.data ?? []) as { id: number; name: string }[];
    for (const r of roles) {
      if (r.name === TEST_ROLE) await request.delete(`/api/roles/${r.id}`, { headers });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/roles');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Gestion des Rôles', { timeout: 15_000 });
    await expect(roleRows(page).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── Lecture : rôles seedés ────────────────────────────────────────────────

  test('affiche les 4 rôles seedés', async ({ page }) => {
    for (const role of SEEDED_ROLES) {
      await expect(roleRow(page, role)).toBeVisible();
    }
  });

  test('le rôle Administrator est un rôle système, verrouillé, avec des permissions', async ({ page }) => {
    const admin = roleRow(page, 'Administrator');
    await expect(admin.locator('.list-grid-tag', { hasText: 'SYSTÈME' })).toBeVisible();
    await expect(admin.locator('.list-cell--identity .list-grid-sub')).toContainText(/\d+/);
    await expect(admin.locator('button[title="Modifier"]')).toHaveCount(0);
    await expect(admin.locator('button[title="Supprimer"]')).toHaveCount(0);
  });

  test('affiche les boutons "Nouveau Rôle" et "Nouvelle Permission"', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Rôle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle Permission' })).toBeVisible();
  });

  // ── Détail d'un rôle ──────────────────────────────────────────────────────

  test('ouvrir le rôle Commercial affiche l\'éditeur de ses permissions', async ({ page }) => {
    await roleRow(page, 'Commercial').locator('button[title="Modifier"]').click();
    await expect(page.locator('.rfm-title')).toHaveText('Modifier Commercial');
    await expect(page.locator('.rfm-meta')).toContainText(/\d+ permission\(s\) accordée\(s\) sur \d+/);

    await page.locator('.rfm-editor').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('.rfm-editor')).toHaveCount(0);
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau rôle', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau Rôle' }).click();
    await expect(page.locator('.rfm-title')).toHaveText('Nouveau rôle');

    await page.getByPlaceholder('Ex: Manager').fill(TEST_ROLE);
    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/roles') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Créer le rôle' }).click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(page.locator('.rfm-editor')).toHaveCount(0, { timeout: 10_000 });
    await expect(roleRow(page, TEST_ROLE)).toBeVisible({ timeout: 10_000 });
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le rôle de test', async ({ page }) => {
    test.setTimeout(60_000);

    await roleRow(page, TEST_ROLE).locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_ROLE);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/roles/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await expect(roleRow(page, TEST_ROLE)).toHaveCount(0, { timeout: 10_000 });
  });
});

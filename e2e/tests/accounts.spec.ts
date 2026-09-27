import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_ACCOUNT = 'COMPTE_E2E_TEST';
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
 * Comptes — refonte 2b, 7b. Une bande de soldes, les comptes en lignes
 * sélectionnables (`.ac-row`), la fiche d'un compte dans la même page, le
 * formulaire dans la modale de référentiel 15b, la suppression dans la
 * confirmation 15c.
 */
const accountRow = (page: Page, name: string) =>
  page.locator('button.ac-row').filter({ has: page.locator('.ac-name-main', { hasText: new RegExp(`^${name}$`) }) });

test.describe.serial('Comptes & Trésorerie', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get(`/api/accounts?search=${encodeURIComponent(TEST_ACCOUNT)}&per_page=100`, { headers });
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; name: string }[] };
    for (const a of data.data) {
      if (a.name === TEST_ACCOUNT) {
        await request.delete(`/api/accounts/${a.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await expect(page.locator('h1')).toContainText('Comptes', { timeout: 25_000 });
    await expect(page.locator('.ac-loading')).toHaveCount(0, { timeout: 25_000 });
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche la bande des soldes et la liste des comptes, ou un état vide', async ({ page }) => {
    for (const label of ['Solde total', 'Caisse', 'Banque', 'Comptes actifs']) {
      await expect(page.locator('.ac-label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    await expect(page.locator('button.ac-row').first().or(page.locator('.ac-empty'))).toBeVisible();
  });

  test('affiche les boutons "+ Nouveau Compte" et "Nouveau Transfert"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouveau Compte/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nouveau Transfert/ })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('ouvre le formulaire de création de compte', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    const modal = page.getByRole('dialog', { name: 'Nouveau compte' });
    await expect(modal).toBeVisible();
    await expect(modal.getByPlaceholder('ex: Caisse principale')).toBeVisible();

    await modal.getByRole('button', { name: 'Annuler' }).click();
    await expect(modal).toBeHidden();
  });

  test('créer un compte de trésorerie', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    const modal = page.getByRole('dialog', { name: 'Nouveau compte' });
    await modal.getByPlaceholder('ex: Caisse principale').fill(TEST_ACCOUNT);

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/accounts') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Ajouter' }).click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(modal).toBeHidden({ timeout: 10_000 });
    await expect(accountRow(page, TEST_ACCOUNT)).toBeVisible({ timeout: 10_000 });
  });

  // ── Détail du compte ──────────────────────────────────────────────────────

  test('cliquer sur un compte affiche ses soldes et ses transactions', async ({ page }) => {
    await accountRow(page, TEST_ACCOUNT).click();
    await expect(page.locator('h1')).toHaveText(TEST_ACCOUNT);
    for (const label of ['Solde actuel', 'Total entrées', 'Total sorties', 'Prévisionnel']) {
      await expect(page.locator('.ac-label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    // Un compte neuf : aucune transaction.
    await expect(page.locator('.ac-empty', { hasText: 'Aucune transaction sur ce compte.' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.locator('h1')).toHaveText('Comptes');
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le compte de test', async ({ page }) => {
    await accountRow(page, TEST_ACCOUNT).locator('[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(TEST_ACCOUNT);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/accounts/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await expect(accountRow(page, TEST_ACCOUNT)).toHaveCount(0, { timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
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
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Comptes');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche la liste des comptes ou un état vide', async ({ page }) => {
    // Soit des cartes compte, soit un état vide
    const accountCards = page.locator('.account-card, .card').filter({ hasNotText: 'Chargement' });
    const emptyState   = page.locator(':has-text("Aucun compte")');
    await expect(accountCards.first().or(emptyState)).toBeVisible();
  });

  test('affiche les boutons "+ Nouveau Compte" et "🔄 Nouveau Transfert"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouveau Compte/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nouveau Transfert/ })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('ouvre le formulaire de création de compte', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    await expect(page.locator('.modal-overlay, .modal-container').first()).toBeVisible();
    await expect(page.locator('label:has-text("Nom"), label:has-text("Type")').first()).toBeVisible();
    // Fermer proprement la modale
    await page.locator('.modal-overlay').locator('.btn-close, button:has-text("Annuler")').first().click();
  });

  test('créer un compte de trésorerie', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    await expect(page.locator('.modal-content')).toBeVisible();

    // Utiliser le placeholder pour trouver le champ Nom de manière fiable
    await page.getByPlaceholder('ex: Caisse principale').fill(TEST_ACCOUNT);

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/accounts') && r.request().method() === 'POST'),
      page.locator('.modal-content').locator('button[type="submit"]').click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.account-card', { hasText: TEST_ACCOUNT }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Détail du compte ──────────────────────────────────────────────────────

  test('cliquer sur un compte affiche ses détails et transactions', async ({ page }) => {
    // Cliquer sur la première carte de compte disponible
    const firstAccount = page.locator('.account-card, button.account-item, tr.account-row').first();
    if (await firstAccount.isVisible()) {
      await firstAccount.click();
      await page.waitForLoadState('networkidle');
      // Page de détail : cards Solde Actuel, Total Entrées, Total Sorties
      await expect(page.locator(':has-text("Solde Actuel"), :has-text("Total Entrées")').first()).toBeVisible();
    }
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le compte de test', async ({ page }) => {
    // Chercher le compte créé
    const accountItem = page.locator(':has-text("' + TEST_ACCOUNT + '")').first();
    if (await accountItem.isVisible()) {
      // Chercher le bouton Supprimer dans la même zone
      const deleteBtn = page.locator('button[title="Supprimer"], button:has-text("Supprimer")')
        .filter({ hasText: '' })
        .first();
      if (await deleteBtn.isVisible()) {
        page.once('dialog', (dialog) => dialog.accept());
        await deleteBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator(':has-text("' + TEST_ACCOUNT + '")').first()).not.toBeVisible();
      }
    }
  });
});

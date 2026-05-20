import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DESCRIPTION = 'E2E_TEST_TRANSACTION';
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

test.describe.serial('Cash Flow', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get(
      `/api/transactions?search=${encodeURIComponent(TEST_DESCRIPTION)}&per_page=100`,
      { headers },
    );
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; description: string }[] };
    for (const tx of data.data) {
      if (tx.description === TEST_DESCRIPTION) {
        await request.delete(`/api/transactions/${tx.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/cash-flow');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Cash Flow', { timeout: 15_000 });
  });

  // ── Lecture ────────────────────────────────────────────────────────────────

  test('affiche les 3 cartes de résumé (Revenus, Dépenses, Solde)', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: 'Revenus' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Dépenses' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Solde' })).toBeVisible();
  });

  test('affiche la section "Transactions réalisées"', async ({ page }) => {
    await expect(page.locator('.section-title, .section-header', { hasText: 'Transactions réalisées' })).toBeVisible();
  });

  test('affiche le tableau des transactions ou un état vide', async ({ page }) => {
    const table = page.locator('table.table');
    const emptyState = page.locator('td:has-text("Aucune transaction trouvée.")');
    await expect(table.first().or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test('affiche tous les filtres attendus', async ({ page }) => {
    await expect(page.locator('label:has-text("Rechercher")')).toBeVisible();
    await expect(page.locator('label:has-text("Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Compte")')).toBeVisible();
    await expect(page.locator('label:has-text("Catégorie")')).toBeVisible();
    await expect(page.locator('label:has-text("Personne")')).toBeVisible();
    await expect(page.locator('label:has-text("Partenaire")')).toBeVisible();
    await expect(page.locator('label:has-text("Du")')).toBeVisible();
    await expect(page.locator('label:has-text("Au")')).toBeVisible();
    await expect(page.locator('label:has-text("Montant min")')).toBeVisible();
    await expect(page.locator('label:has-text("Montant max")')).toBeVisible();
  });

  test('affiche le bouton "+ Nouvelle Transaction"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle Transaction/ })).toBeVisible();
  });

  // ── Formulaire de création ─────────────────────────────────────────────────

  test('ouvre le formulaire de nouvelle transaction', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    await expect(page.locator('label:has-text("Date")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Montant")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Méthode")').first()).toBeVisible();
  });

  test('le champ Partenaire est un select (pas un champ texte libre)', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    // Il doit exister un <select> pour le partenaire, pas un <input type=text>
    const partnerSelect = page.locator('#txn-partner');
    await expect(partnerSelect).toBeVisible();
    const tagName = await partnerSelect.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('select');
  });

  test('la liste des méthodes de paiement contient "Carte bancaire"', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    const methodSelect = page.locator('#txn-method');
    await expect(methodSelect).toBeVisible();
    const options = await methodSelect.locator('option').allTextContents();
    expect(options).toContain('Carte bancaire');
  });

  test('ferme le formulaire avec Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    await page.locator('.modal-overlay').getByRole('button', { name: /Annuler/ }).first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer une transaction de dépense (Espèces)', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-content')).toBeVisible();

    // Type → Dépense
    await page.locator('.toggle-btn', { hasText: 'Dépense' }).click();

    // Date → aujourd'hui (pré-remplie, on laisse)
    // Montant
    await page.locator('#txn-amount').fill('150');
    // Compte (premier compte disponible)
    const accountSelect = page.locator('#txn-account');
    await accountSelect.selectOption({ index: 1 });
    // Catégorie
    await page.locator('#txn-category').selectOption({ index: 1 });
    // Méthode
    await page.locator('#txn-method').selectOption({ label: 'Espèces' });
    // Personne
    await page.locator('#txn-person').selectOption({ index: 1 });
    // Description
    await page.locator('#txn-description').fill(TEST_DESCRIPTION);

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
      page.locator('.modal-content').locator('button[type="submit"]').click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 });
    // La transaction doit apparaître dans les transactions réalisées
    await expect(page.locator('td', { hasText: TEST_DESCRIPTION }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Filtres ────────────────────────────────────────────────────────────────

  test('filtrer par type "Dépenses" retrouve la transaction créée', async ({ page }) => {
    const typeSelect = page.locator('label:has-text("Type")').locator('..').locator('select');
    await typeSelect.selectOption({ value: 'expense' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td', { hasText: TEST_DESCRIPTION }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('filtrer par recherche texte retrouve la transaction créée', async ({ page }) => {
    const searchInput = page.locator('label:has-text("Rechercher")').locator('..').locator('input');
    await searchInput.fill(TEST_DESCRIPTION);
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td', { hasText: TEST_DESCRIPTION }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('réinitialiser les filtres efface la recherche', async ({ page }) => {
    const searchInput = page.locator('label:has-text("Rechercher")').locator('..').locator('input');
    await searchInput.fill('quelque chose qui ne correspond pas');
    await page.getByRole('button', { name: '✕' }).last().click();
    await page.waitForLoadState('networkidle');
    // Après reset, le champ doit être vide
    await expect(searchInput).toHaveValue('');
  });

  // ── Section "Transactions à venir" ────────────────────────────────────────

  test('la section "Transactions à venir" est conditionnellement visible', async ({ page }) => {
    // La section n'apparaît que s'il y a des transactions pending
    const pendingSection = page.locator('.pending-section');
    const isVisible = await pendingSection.isVisible();
    // On ne force pas l'assertion — juste vérifier que si elle est visible, le header aussi
    if (isVisible) {
      await expect(page.locator('.pending-title', { hasText: 'Transactions à venir' })).toBeVisible();
    }
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  test('supprimer la transaction de test', async ({ page }) => {
    test.setTimeout(30_000);

    // Chercher via le filtre description pour isoler notre transaction
    const searchInput = page.locator('label:has-text("Rechercher")').locator('..').locator('input');
    await searchInput.fill(TEST_DESCRIPTION);
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');

    const deleteBtn = page.locator('tr', { hasText: TEST_DESCRIPTION })
      .locator('button[title="Supprimer"]')
      .first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });

    const [delResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/transactions/') && r.request().method() === 'DELETE'),
      page.once('dialog', d => d.accept()) as unknown as Promise<void>,
      deleteBtn.click(),
    ]);
    expect(delResp.status()).toBeLessThan(400);

    await expect(page.locator('td', { hasText: TEST_DESCRIPTION })).not.toBeVisible({ timeout: 10_000 });
  });
});

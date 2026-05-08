import { test, expect } from '@playwright/test';

const TEST_CARRIER     = 'TRANSPORTEUR_E2E_TEST';
const TEST_CARRIER_UPD = 'TRANSPORTEUR_E2E_TEST_MAJ';

test.describe.serial('Transporteurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carriers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Transporteurs');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche le tableau des transporteurs ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun transporteur trouvé.")');
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('le bouton "Nouveau Transporteur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Transporteur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau transporteur', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau Transporteur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Transporteur');

    await page.fill('input[name="name"]', TEST_CARRIER);
    await page.fill('input[name="phone"]', '0522111111');
    await page.fill('input[name="email"]', 'e2e@transporteur.test');

    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator('tbody td', { hasText: TEST_CARRIER })).toBeVisible();
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le transporteur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_CARRIER })).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le transporteur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr', { hasText: TEST_CARRIER })
      .locator('button[title="Modifier"]')
      .click();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Transporteur');

    await page.fill('input[name="name"]', TEST_CARRIER_UPD);
    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_CARRIER_UPD })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le transporteur de test', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou téléphone..."]', TEST_CARRIER_UPD);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tbody tr', { hasText: TEST_CARRIER_UPD })
      .locator('button[title="Supprimer"]')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_CARRIER_UPD })).not.toBeVisible();
  });
});

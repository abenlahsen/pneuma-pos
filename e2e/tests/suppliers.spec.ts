import { test, expect } from '@playwright/test';

const TEST_SUPPLIER      = 'FOURNISSEUR_E2E_TEST';
const TEST_SUPPLIER_UPD  = 'FOURNISSEUR_E2E_TEST_MAJ';

test.describe.serial('Fournisseurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Annuaire Fournisseurs');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche le tableau des fournisseurs ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun fournisseur trouvé.")');
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('le bouton "Nouveau Fournisseur" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Fournisseur' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau fournisseur', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau Fournisseur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Fournisseur');

    await page.fill('input[name="name"]', TEST_SUPPLIER);
    await page.fill('input[name="contact_person"]', 'Mohamed E2E');
    await page.fill('input[name="phone"]', '0522000000');
    await page.fill('#supplier-email', 'e2e@fournisseur.test');

    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER })).toBeVisible();
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le fournisseur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom, contact ou email..."]', TEST_SUPPLIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER })).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le fournisseur créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom, contact ou email..."]', TEST_SUPPLIER);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr', { hasText: TEST_SUPPLIER })
      .locator('button[title="Modifier"]')
      .click();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Fournisseur');

    await page.fill('input[name="name"]', TEST_SUPPLIER_UPD);
    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_SUPPLIER_UPD })).toBeVisible();
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

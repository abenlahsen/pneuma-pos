import { test, expect } from '@playwright/test';

const TEST_BRAND = 'MARQUE_E2E_TEST';
const TEST_BRAND_UPDATED = 'MARQUE_E2E_TEST_MAJ';

test.describe.serial('Marques', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brands');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Marques');
  });

  // ── Lecture : données seedées ────────────────────────────────────────────

  test('affiche les marques seedées (MICHELIN, GOODYEAR, CONTINENTAL)', async ({ page }) => {
    // 31 marques seedées → pagination donc on vérifie juste que des lignes existent
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows).not.toHaveCount(0);
    // Les grandes marques doivent être visibles quelque part (peut-être pagination)
    await expect(page.locator('td .fw-semibold', { hasText: 'MICHELIN' }).first()).toBeVisible();
  });

  test('rechercher "MICHELIN" retourne exactement 1 résultat', async ({ page }) => {
    await page.fill('input[placeholder="Nom de la marque..."]', 'MICHELIN');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows).toHaveCount(1);
    await expect(page.locator('td .fw-semibold')).toContainText('MICHELIN');
  });

  test('réinitialiser les filtres restaure la liste complète', async ({ page }) => {
    await page.fill('input[placeholder="Nom de la marque..."]', 'XXXXXXNOTFOUND');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td:has-text("Aucune marque trouvée.")')).toBeVisible();

    await page.click('button[title="Réinitialiser"]');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td:has-text("Aucune marque trouvée.")')).not.toBeVisible();
  });

  // ── Création ─────────────────────────────────────────────────────────────

  test('créer une nouvelle marque', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle Marque' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();

    await page.fill('input[name="name"]', TEST_BRAND);
    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    // Le modal se ferme et la marque apparaît dans la liste
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND })).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier la marque créée', async ({ page }) => {
    // Chercher la marque de test
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Cliquer sur le bouton Modifier de la ligne
    await page.locator('tr', { hasText: TEST_BRAND }).locator('button[title="Modifier"]').click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier');

    // Changer le nom
    await page.fill('input[name="name"]', TEST_BRAND_UPDATED);
    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    // Vérifier le nouveau nom
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND_UPDATED);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND_UPDATED })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer la marque de test', async ({ page }) => {
    await page.fill('input[placeholder="Nom de la marque..."]', TEST_BRAND_UPDATED);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Confirmer la boite de dialogue native (window.confirm)
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tr', { hasText: TEST_BRAND_UPDATED }).locator('button[title="Supprimer"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('td .fw-semibold', { hasText: TEST_BRAND_UPDATED })).not.toBeVisible();
  });
});

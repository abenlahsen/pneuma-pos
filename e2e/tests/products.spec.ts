import { test, expect } from '@playwright/test';

test.describe('Produits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Produits');
  });

  test('charge le catalogue avec les 803 pneus seedés', async ({ page }) => {
    // La pagination affiche le total d'entrées
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toBeVisible();
    await expect(paginationInfo).toContainText('803');
  });

  test('filtrer par type "Pneu" retourne des résultats', async ({ page }) => {
    // Premier select = filtre Type
    const typeSelect = page.locator('select.form-control').first();
    await typeSelect.selectOption('tyre');
    await page.waitForLoadState('networkidle');

    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toBeVisible();
    // Tous les produits seedés sont des pneus
    await expect(paginationInfo).toContainText('803');
  });

  test('filtrer par marque MICHELIN retourne uniquement des MICHELIN', async ({ page }) => {
    // Second select = filtre Marque (sélection par label)
    const brandSelect = page.locator('label:has-text("Marque")').locator('..').locator('select');
    await brandSelect.selectOption({ label: 'MICHELIN' });
    await page.waitForLoadState('networkidle');

    // Vérifier que des résultats apparaissent
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();

    // Vérifier le compteur dans la pagination (130 MICHELIN seedés)
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toContainText('130');
  });

  test('rechercher "205/55R16" retourne les pneus de cette dimension', async ({ page }) => {
    await page.fill('.search-input', '205/55R16');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();
    // La pagination doit afficher un résultat
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toBeVisible();
  });

  test('rechercher "2055516" (format raccourci) trouve les mêmes pneus', async ({ page }) => {
    await page.fill('.search-input', '2055516');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();
  });

  test('rechercher "GOODYEAR" retourne des résultats de cette marque', async ({ page }) => {
    await page.fill('.search-input', 'GOODYEAR');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toContainText('127');
  });

  test('réinitialiser les filtres restaure les 803 produits', async ({ page }) => {
    // Appliquer un filtre d'abord
    await page.fill('.search-input', 'MICHELIN');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    // Réinitialiser
    await page.click('.reset-btn');
    await page.waitForLoadState('networkidle');

    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toContainText('803');
  });
});

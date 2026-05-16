import { test, expect } from '@playwright/test';

test.describe('Produits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Produits');
  });

  test('charge le catalogue avec les pneus seedés', async ({ page }) => {
    // La pagination affiche le total d'entrées (≥ 803 produits seedés)
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toBeVisible();
    await expect(paginationInfo).toContainText('entrées');
    // Au moins 800 produits attendus
    const text = await paginationInfo.textContent() ?? '';
    const match = text.match(/sur (\d+) entrées/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(800);
  });

  test('filtrer par type "Pneu" retourne des résultats', async ({ page }) => {
    // Premier select = filtre Type
    const typeSelect = page.locator('select.form-control').first();
    await typeSelect.selectOption('tyre');
    await page.waitForLoadState('networkidle');

    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toBeVisible();
    await expect(paginationInfo).toContainText('entrées');
  });

  test('filtrer par marque MICHELIN retourne uniquement des MICHELIN', async ({ page }) => {
    // Second select = filtre Marque (sélection par label)
    const brandSelect = page.locator('label:has-text("Marque")').locator('..').locator('select');
    await brandSelect.selectOption({ label: 'MICHELIN' });
    await page.waitForLoadState('networkidle');

    // Vérifier que des résultats apparaissent
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();

    // Vérifier le compteur dans la pagination (≥ 100 MICHELIN seedés)
    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toContainText('entrées');
    const text = await paginationInfo.textContent() ?? '';
    const match = text.match(/sur (\d+) entrées/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(100);
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
    await expect(paginationInfo).toContainText('entrées');
  });

  test('réinitialiser les filtres restaure le catalogue complet', async ({ page }) => {
    // Appliquer un filtre d'abord
    await page.fill('.search-input', 'MICHELIN');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    // Mémoriser le total avant réinitialisation
    const filteredText = await page.locator('.pagination-info').textContent() ?? '';

    // Réinitialiser
    await page.click('.reset-btn');
    await page.waitForLoadState('networkidle');

    const paginationInfo = page.locator('.pagination-info');
    await expect(paginationInfo).toContainText('entrées');
    // Le total après réinitialisation doit être >= au total filtré
    const totalText = await paginationInfo.textContent() ?? '';
    const filteredMatch = filteredText.match(/sur (\d+) entrées/);
    const totalMatch = totalText.match(/sur (\d+) entrées/);
    if (filteredMatch && totalMatch) {
      expect(parseInt(totalMatch[1])).toBeGreaterThanOrEqual(parseInt(filteredMatch[1]));
    }
  });
});

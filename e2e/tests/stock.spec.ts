import { test, expect } from '@playwright/test';

test.describe('Stock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stock');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Stock');
  });

  test('affiche les cartes de résumé (Articles, Quantité, Valeur)', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: 'Articles' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Quantité totale' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: "Valeur d'achat" })).toBeVisible();

    // 803 lots seedés
    const articlesValue = page.locator('.summary-card').filter({ hasText: 'Articles' }).locator('.card-value');
    await expect(articlesValue).toContainText('803');
  });

  test('rechercher "MICHELIN" filtre les résultats', async ({ page }) => {
    await page.fill('.search-input', 'MICHELIN');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();
  });

  test('rechercher "205/55R16" retourne des résultats', async ({ page }) => {
    await page.fill('.search-input', '205/55R16');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    await expect(rows.first()).toBeVisible();
  });

  test('rechercher "2055516" (format raccourci) affiche un hint de décodage', async ({ page }) => {
    await page.fill('.search-input', '2055516');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    // Le hint doit afficher la dimension décodée
    const hint = page.locator('.search-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('205');
  });

  test('réinitialiser affiche les 803 lots de stock', async ({ page }) => {
    await page.fill('.search-input', 'MICHELIN');
    await page.click('.search-btn');
    await page.waitForLoadState('networkidle');

    await page.click('.reset-btn');
    await page.waitForLoadState('networkidle');

    const articlesValue = page.locator('.summary-card').filter({ hasText: 'Articles' }).locator('.card-value');
    await expect(articlesValue).toContainText('803');
  });

  test('le bouton "Exporter le stock disponible" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Exporter le stock disponible/ })).toBeVisible();
  });
});

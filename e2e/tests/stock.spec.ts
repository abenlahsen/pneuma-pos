import { test, expect } from '@playwright/test';

test.describe('Stock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stock');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Stock', { timeout: 15_000 });
  });

  test('affiche les cartes de résumé (Articles, Quantité, Valeur)', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: 'Articles' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Quantité totale' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: "Valeur d'achat" })).toBeVisible();

    // Wait for spinner to go away and show a non-zero count
    const articlesValue = page.locator('.summary-card').filter({ hasText: 'Articles' }).locator('.card-value');
    await expect(articlesValue).toContainText(/[1-9]/);
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

  test('réinitialiser restaure le stock complet', async ({ page }) => {
    await page.fill('.search-input', 'MICHELIN');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/stocks') && r.request().method() === 'GET'),
      page.click('.search-btn'),
    ]);

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/stocks') && r.request().method() === 'GET'),
      page.click('.reset-btn'),
    ]);

    const articlesValue = page.locator('.summary-card').filter({ hasText: 'Articles' }).locator('.card-value');
    // /[1-9]/ rules out both "0" (zero articles) and "..." (loading spinner) — no separate parseInt needed
    await expect(articlesValue).toContainText(/[1-9]/, { timeout: 15_000 });
  });

  test('le bouton "Exporter le stock disponible" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Exporter le stock disponible/ })).toBeVisible();
  });
});

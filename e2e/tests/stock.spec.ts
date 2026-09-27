import { test, expect, Page } from '@playwright/test';

/**
 * Stock — refonte 2b. Une ligne par référence (`.ref-row`), ses lots
 * dépliables dessous, et un bandeau de cadrans (`.kpi-cell`) à la place des
 * anciennes cartes de résumé.
 */

/** Les vraies lignes de référence — les squelettes n'ont pas de dimension. */
const refRows = (page: Page) => page.locator('.ref-row').filter({ has: page.locator('.ref-dimension') });

/** Le cadran « Quantité », une fois chargé (« — » tant qu'il ne l'est pas). */
const quantityDial = (page: Page) => page.locator('.kpi-cell', { has: page.locator('.kpi-label', { hasText: /^Quantité$/ }) }).locator('.kpi-value');

/** Lance la recherche et attend la liste groupée qui la porte. */
async function search(page: Page, query: string): Promise<void> {
  await page.fill('.search-input', query);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/stocks-grouped') && r.url().includes('search=') && r.request().method() === 'GET'),
    page.click('.search-btn'),
  ]);
}

test.describe('Stock', () => {
  test.beforeEach(async ({ page }) => {
    // Pas d'attente du chargement initial : les recherches partent aussitôt,
    // pendant qu'il est encore en vol. La page doit l'abandonner — une réponse
    // initiale plus lente écrasait autrefois le résultat filtré.
    await page.goto('/stock');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Stock', { timeout: 15_000 });
  });

  test('affiche les cadrans (valeur, quantité, sous seuil, rotation, dormant)', async ({ page }) => {
    for (const label of ['Valeur du stock', 'Quantité', 'Sous seuil', 'Rotation']) {
      await expect(page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    await expect(page.locator('.kpi-label', { hasText: /^Dormant/ })).toBeVisible();

    // « — » tant que le résumé n'est pas chargé : /[1-9]/ attend un vrai chiffre.
    await expect(quantityDial(page)).toContainText(/[1-9]/, { timeout: 15_000 });
  });

  test('rechercher "MICHELIN" filtre les résultats', async ({ page }) => {
    await search(page, 'MICHELIN');

    await expect(refRows(page).first()).toBeVisible();
    const count = await refRows(page).count();
    for (let i = 0; i < count; i++) {
      await expect(refRows(page).nth(i).locator('.ref-object')).toContainText(/MICHELIN/i);
    }
  });

  test('rechercher "205/55R16" retourne des résultats de cette dimension', async ({ page }) => {
    await search(page, '205/55R16');

    await expect(refRows(page).first()).toBeVisible();
    await expect(refRows(page).first().locator('.ref-dimension')).toContainText('205/55R16');
  });

  test('rechercher "2055516" (format raccourci) affiche un hint de décodage', async ({ page }) => {
    await search(page, '2055516');

    // Le hint doit afficher la dimension décodée
    const hint = page.locator('.search-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('205');
  });

  test('réinitialiser restaure le stock complet', async ({ page }) => {
    await search(page, 'MICHELIN');
    await expect(refRows(page).first()).toBeVisible();

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/stocks-grouped') && !r.url().includes('search=MICHELIN') && r.request().method() === 'GET'),
      page.click('.reset-btn'),
    ]);

    await expect(page.locator('.search-input')).toHaveValue('');
    await expect(quantityDial(page)).toContainText(/[1-9]/, { timeout: 15_000 });
    await expect(refRows(page).first()).toBeVisible();
  });

  test('déplier une référence montre ses lots', async ({ page }) => {
    await expect(refRows(page).first()).toBeVisible({ timeout: 15_000 });
    await refRows(page).first().locator('.ref-toggle').click();
    await expect(page.locator('.lot-object').first()).toContainText(/^Lot \d+/);
  });

  test('le bouton "Exporter le stock disponible" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Exporter le stock disponible/ })).toBeVisible();
  });
});

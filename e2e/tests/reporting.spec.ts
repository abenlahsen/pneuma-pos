import { test, expect } from '@playwright/test';

/**
 * Reporting mensuel — refonte 2b. Chaque section est un tableau à quatre
 * colonnes (poste, mois, mois précédent, variation) au lieu de cartes KPI ;
 * les tableaux de détail suivent.
 */
test.describe('Reporting mensuel', () => {
  test('la page charge avec les sections et la navigation par mois', async ({ page }) => {
    test.slow();
    await page.goto('/reporting', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Reporting Mensuel', { timeout: 20_000 });

    const monthLabel = page.locator('.month-nav .month-label');
    const prevBtn = page.getByRole('button', { name: 'Mois précédent' });
    const nextBtn = page.getByRole('button', { name: 'Mois suivant' });

    await expect(monthLabel).toContainText(/\d{4}/);
    await expect(nextBtn).toBeDisabled();

    const titles = page.locator('.rep-block .rep-title');
    await expect(titles.first()).toHaveText('Ventes', { timeout: 20_000 });
    for (const title of ['Achats', 'Marge', 'Masse salariale', 'Trésorerie']) {
      await expect(titles.filter({ hasText: new RegExp(`^${title}$`) })).toBeVisible();
    }
    for (const label of ['CA Ventes', 'Marge nette', 'Masse salariale']) {
      await expect(page.locator('.rep-table .rep-label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }

    // Les colonnes nomment le mois affiché et le précédent ; la variation suit.
    const firstHead = page.locator('.rep-table thead th');
    await expect(firstHead.nth(1)).toHaveText((await monthLabel.textContent())!.trim());
    await expect(page.locator('.rep-delta').first()).toBeVisible();

    const before = (await monthLabel.textContent())!.trim();
    await prevBtn.click();
    await expect(monthLabel).not.toHaveText(before);
    await expect(nextBtn).toBeEnabled();
    // Le tableau suit le mois choisi, jamais un mois périmé.
    await expect(firstHead.nth(1)).toHaveText((await monthLabel.textContent())!.trim(), { timeout: 20_000 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Reporting mensuel', () => {
  test('la page charge avec les sections KPI et la navigation par mois', async ({ page }) => {
    await page.goto('/reporting', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Reporting Mensuel', { timeout: 20_000 });

    const monthLabel = page.locator('.month-nav .month-label');
    const prevBtn = page.locator('.month-nav .nav-btn').first();
    const nextBtn = page.locator('.month-nav .nav-btn').nth(1);

    await expect(monthLabel).toContainText(/\d{4}/);
    await expect(nextBtn).toBeDisabled();

    await expect(page.locator('.kpi-group-title').first()).toContainText('Ventes');
    await expect(page.locator('.kpi-card').first()).toBeVisible();
    await expect(page.locator('.kpi-card', { hasText: 'Masse salariale' })).toBeVisible();
    await expect(page.locator('.kpi-card', { hasText: 'Marge nette' })).toBeVisible();
    await expect(page.locator('.kpi-delta').first()).toBeVisible();

    const before = await monthLabel.textContent();
    await prevBtn.click();
    await expect(monthLabel).not.toHaveText(before ?? '');
    await expect(nextBtn).toBeEnabled();
    await expect(page.locator('.kpi-card').first()).toBeVisible();
  });
});

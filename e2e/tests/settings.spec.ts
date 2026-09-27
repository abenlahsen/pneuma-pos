import { test, expect, Page } from '@playwright/test';

/**
 * Paramètres — refonte 2b, gabarit 17a. Une barre de titre (`.st-title`, pas
 * de `h1`), la liste de sections à gauche, le contenu à droite, et un pied
 * d'enregistrement propre à la section affichée. Le personnalisateur de thème
 * est retiré.
 */
const section = (page: Page, label: string) => page.locator('.st-nav').getByRole('button', { name: label, exact: true });
const save = (page: Page) => page.locator('.st-foot').getByRole('button', { name: /Enregistrer cette section|Enregistrement…/ });

test.describe('Paramètres Entreprise', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.st-title')).toHaveText('Paramètres', { timeout: 15_000 });
    // La section Identité s'ouvre par défaut, une fois les paramètres chargés.
    await expect(page.locator('#company_name')).toBeVisible({ timeout: 25_000 });
  });

  test('ouvre sur la section « Identité et contact »', async ({ page }) => {
    await expect(page.locator('.st-head-title')).toHaveText('Identité et contact');
    await expect(section(page, 'Identité et contact')).toHaveClass(/st-entry--on/);
    for (const block of ['Raison sociale', 'Identifiants légaux', 'Contact et siège']) {
      await expect(page.locator('.st-block-title', { hasText: block })).toBeVisible();
    }
  });

  test('affiche les champs société remplis ou vides', async ({ page }) => {
    for (const id of ['#company_name', '#email', '#phone', '#address', '#city']) {
      await expect(page.locator(id)).toBeVisible();
    }
  });

  test('affiche les champs légaux (ICE, RC, Patente)', async ({ page }) => {
    await expect(page.locator('#ice')).toBeVisible();
    await expect(page.locator('#rc')).toBeVisible();
    await expect(page.locator('#patente')).toBeVisible();
  });

  // Refonte 2b, 17a : le personnalisateur de thème est retiré de l'écran. Ses
  // trois sélecteurs de couleur ne pilotaient plus aucune règle CSS et son
  // sélecteur de disposition portait sur un menu supprimé à l'étape 3. Ce qui
  // se vérifie ici désormais, c'est la liste de sections qui l'a remplacé.
  test('affiche la liste de sections et pas de contrôle de thème', async ({ page }) => {
    await expect(page.locator('#primary_color')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /thème/i })).toHaveCount(0);
    for (const label of ['Identité et contact', 'Jours de fermeture', 'Documents et logo', 'Objectifs et primes']) {
      await expect(section(page, label)).toBeVisible();
    }
    // Les référentiels ne sont pas réimplémentés : la liste y navigue.
    await expect(page.locator('.st-nav a.st-entry--link', { hasText: 'Marques' })).toHaveAttribute('href', '/brands');
  });

  test("chaque section a son propre pied d'enregistrement", async ({ page }) => {
    await expect(save(page)).toBeDisabled();

    await page.locator('#legal_name').fill('TEST_E2E_LEGAL');
    await expect(save(page)).toBeEnabled();

    // « Annuler » ne touche que la section affichée.
    await page.locator('.st-foot').getByRole('button', { name: 'Annuler' }).click();
    await expect(save(page)).toBeDisabled();
  });

  test('modifier le nom de l\'entreprise et enregistrer', async ({ page }) => {
    const nameInput = page.locator('#company_name');
    const originalValue = await nameInput.inputValue();

    await nameInput.fill('TEST_E2E_SHOP');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/settings/company') && r.request().method() !== 'GET'),
      save(page).click(),
    ]);
    await expect(page.locator('.st-foot .st-ok')).toHaveText('Identité et contact · enregistré.', { timeout: 8_000 });
    await expect(page.locator('.st-sub')).toContainText('TEST_E2E_SHOP');

    // Remettre la valeur d'origine (cleanup)
    await nameInput.fill(originalValue || '');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/settings/company') && r.request().method() !== 'GET'),
      save(page).click(),
    ]);
    await expect(page.locator('.st-foot .st-ok')).toBeVisible({ timeout: 8_000 });
  });

  test('la section « Jours de fermeture » porte la fermeture hebdomadaire et les fermetures exceptionnelles', async ({ page }) => {
    await section(page, 'Jours de fermeture').click();
    await expect(page.locator('.st-head-title')).toHaveText('Jours de fermeture');
    await expect(page.locator('.st-block-title', { hasText: 'Fermeture hebdomadaire' })).toBeVisible();
    await expect(page.locator('.st-block-title', { hasText: 'Fermetures exceptionnelles' })).toBeVisible();
  });

  test('les blocs logo et favicon sont dans « Documents et logo »', async ({ page }) => {
    await section(page, 'Documents et logo').click();
    await expect(page.locator('.st-head-title')).toHaveText('Documents et logo');
    await expect(page.locator('.st-block-title', { hasText: /^Logo$/ })).toBeVisible();
    await expect(page.locator('.st-block-title', { hasText: /^Favicon$/ })).toBeVisible();
  });
});

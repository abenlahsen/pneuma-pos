import { test, expect } from '@playwright/test';

test.describe('Paramètres Entreprise', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Paramètres', { timeout: 15_000 });
    // Wait for settings form to load (inside *ngIf="!loading()")
    await expect(page.locator('#company_name')).toBeVisible({ timeout: 25_000 });
  });

  test('affiche les 2 sections : Informations société et Thème', async ({ page }) => {
    await expect(page.locator('h2, h3').filter({ hasText: 'Informations société' })).toBeVisible();
    // Theme section is inside *ngIf="!loading()" — wait for API response
    await expect(page.locator('h2, h3').filter({ hasText: "Thème de l'application" })).toBeVisible({ timeout: 15_000 });
  });

  test('affiche les champs société remplis ou vides', async ({ page }) => {
    await expect(page.locator('#company_name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Identité et contact' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Documents et logo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Objectifs et primes' })).toBeVisible();
  });

  test('chaque section a son propre pied d'enregistrement', async ({ page }) => {
    const save = page.getByRole('button', { name: 'Enregistrer cette section' });
    await expect(save).toBeDisabled();

    await page.locator('#legal_name').fill('TEST_E2E_LEGAL');
    await expect(save).toBeEnabled();

    // « Annuler » ne touche que la section affichée.
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(save).toBeDisabled();
  });

  test('modifier le nom de l\'entreprise et enregistrer', async ({ page }) => {
    const nameInput = page.locator('#company_name');
    const originalValue = await nameInput.inputValue();

    await nameInput.fill('TEST_E2E_SHOP');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');

    // Un message de succès doit apparaître
    await expect(page.locator('.alert-success, .success, [class*="success"]').first()).toBeVisible({ timeout: 8_000 });

    // Remettre la valeur d'origine (cleanup)
    await nameInput.fill(originalValue || '');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('le bouton "Réinitialiser le thème" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Réinitialiser le thème' })).toBeVisible();
  });

  test('les sections logo et favicon sont visibles', async ({ page }) => {
    await expect(page.locator('h3', { hasText: "Logo de l'entreprise" })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Favicon' })).toBeVisible();
  });
});

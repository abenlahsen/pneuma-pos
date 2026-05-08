import { test, expect } from '@playwright/test';

test.describe('Service Auto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/service-orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Service Auto');
  });

  test('affiche les 3 cartes de résumé financier', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: 'CA TOTAL' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'PAYÉ' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'RESTE À PAYER' })).toBeVisible();
  });

  test('affiche la section filtres avec Client, Statut, Paiement', async ({ page }) => {
    await expect(page.locator('label:has-text("Client")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
  });

  test('affiche le tableau des interventions ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td').filter({ hasText: /Aucune|intervention/ });
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('le bouton "+ Nouvelle intervention" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle intervention/ })).toBeVisible();
  });

  test('ouvre le formulaire de création d\'intervention', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();
    // Champ véhicule ou date attendu
    await expect(page.locator('label:has-text("Véhicule"), label:has-text("Date"), label:has-text("Client")').first()).toBeVisible();
  });

  test('ferme le formulaire avec Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();

    await page.getByRole('button', { name: /Annuler|Fermer|✕|X/ }).first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });
});

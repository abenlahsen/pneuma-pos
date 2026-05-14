import { test, expect } from '@playwright/test';

test.describe('Ventes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Ventes');
  });

  test('affiche les 5 cartes de résumé', async ({ page }) => {
    const cards = page.locator('.summary-card');
    await expect(cards).toHaveCount(5);
    await expect(page.locator('.card-label', { hasText: 'Pneus vendus aujourd\'hui' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Pneus vendus ce mois' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Montant impayé' })).toBeVisible();
  });

  test('affiche la section filtres avec les champs attendus', async ({ page }) => {
    await expect(page.locator('.filters-section')).toBeVisible();
    // Champs de filtre attendus
    await expect(page.locator('label:has-text("Commercial")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
  });

  test('affiche le tableau des ventes ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucune vente")');
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('le bouton "Nouvelle Vente" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouvelle Vente' })).toBeVisible();
  });

  test('ouvre le formulaire de création de vente', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    // Le formulaire doit avoir un champ date et un champ client
    await expect(page.locator('label:has-text("Date"), label:has-text("Client")').first()).toBeVisible();
  });

  test('fermer le modal avec le bouton Annuler', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.getByRole('button', { name: /Annuler|Fermer|✕|X/ }).first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('le bouton Visualiser ouvre la modale de détail', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Détail de la vente' })).toBeVisible();
  });

  test('le bouton Modifier dans le détail ouvre le formulaire de modification', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    const modifierBtn = page.locator('.modal-footer button', { hasText: 'Modifier' });
    await expect(modifierBtn).toBeVisible();
    await modifierBtn.click();

    await expect(page.locator('h2', { hasText: 'Modifier la vente' })).toBeVisible();
  });
});
